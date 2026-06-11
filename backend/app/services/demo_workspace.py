"""Safe first-run demo workspace seed."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadSchedulerTick,
    LibraryView,
    MediaFile,
    MetadataSyncTick,
    StorageChannelPressureSnapshot,
    StoragePressureSnapshot,
    SyncJob,
    Video,
)
from app.schemas.operations import DemoWorkspaceClearResult, DemoWorkspaceResult
from app.services.event_bus import event_bus

DEMO_EXTERNAL_ID = "UC_CVN_DEMO_SIGNAL"
DEMO_HANDLE = "@signalvaultlab"
DEMO_TITLE = "Signal Lab"
DEMO_LIBRARY_VIEW_NAME = "Demo media triage"


def demo_channel_relative_dir() -> Path:
    """Return the demo channel root relative to the archive root."""
    return Path(f"channels/{DEMO_HANDLE} [{DEMO_EXTERNAL_ID}]")


async def seed_demo_workspace(*, db: AsyncSession, download_dir: str) -> DemoWorkspaceResult:
    """Seed a deterministic demo only when the workspace is empty."""
    root = Path(download_dir)
    existing_demo = await db.scalar(select(Channel).where(Channel.external_id == DEMO_EXTERNAL_ID))
    if existing_demo:
        return DemoWorkspaceResult(
            created=False,
            skipped_reason="demo already exists",
            channel_id=existing_demo.id,
            channel_title=existing_demo.title,
            archive_root=str(root),
        )

    existing_channels = await db.scalar(select(func.count(Channel.id)))
    if existing_channels:
        return DemoWorkspaceResult(
            created=False,
            skipped_reason="workspace already has registered channels",
            archive_root=str(root),
        )

    root.mkdir(parents=True, exist_ok=True)
    files_created = _write_demo_files(root)
    now = datetime.now(UTC)
    signal_dir = _signal_video_dir()

    channel = Channel(
        source_type="channel",
        source_url="https://www.youtube.com/@signalvaultlab",
        external_id=DEMO_EXTERNAL_ID,
        handle=DEMO_HANDLE,
        title=DEMO_TITLE,
        description="A deterministic creator-owned demo fixture for Channel Vault NAS.",
        thumbnail_url=None,
        status="active",
        last_synced_at=now - timedelta(minutes=7),
        sync_interval_minutes=360,
        source_video_count=3,
        source_counts_updated_at=now - timedelta(minutes=7),
        archived_count=1,
        missing_count=2,
        removed_saved_count=1,
        first_video_published_at=now - timedelta(days=21),
        latest_video_published_at=now - timedelta(days=1),
        avg_upload_interval_days=7.0,
        typical_upload_dow=4,
        typical_upload_hour=21,
        created_at=now - timedelta(days=30),
        updated_at=now,
    )
    db.add(channel)
    await db.flush()

    db.add(
        ChannelPolicy(
            channel_id=channel.id,
            auto_download=True,
            max_quality="1080p",
            audio_only=False,
            subtitles_enabled=True,
            subtitle_languages=["ko", "en"],
            retention_policy="keep",
            worker_paused=False,
            created_at=now - timedelta(days=30),
            updated_at=now,
        )
    )

    videos = [
        Video(
            channel_id=channel.id,
            external_id="cvnDemo01",
            title="Golden hour archive",
            description="Already indexed local media.",
            published_at=now - timedelta(days=1),
            upload_date=date(2026, 5, 29),
            duration_seconds=672,
            thumbnail_url=None,
            view_count=1200,
            source_state="available",
            last_seen_in_source_at=now,
            tags=["demo", "archive"],
            categories=["Science & Technology"],
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=f"{signal_dir.as_posix()}/video.info.json",
            discovered_at=now - timedelta(days=1),
            created_at=now - timedelta(days=1),
            updated_at=now,
        ),
        Video(
            channel_id=channel.id,
            external_id="cvnDemo02",
            title="Queue calibration pass",
            description="Missing media with a candidate queue row.",
            published_at=now - timedelta(days=8),
            upload_date=date(2026, 5, 22),
            duration_seconds=1240,
            thumbnail_url=None,
            view_count=840,
            source_state="available",
            last_seen_in_source_at=now,
            tags=["demo", "queue"],
            categories=["Science & Technology"],
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
            discovered_at=now - timedelta(days=8),
            created_at=now - timedelta(days=8),
            updated_at=now,
        ),
        Video(
            channel_id=channel.id,
            external_id="cvnDemo03",
            title="Queued rescue window",
            description="Missing media already armed in the queue.",
            published_at=now - timedelta(days=15),
            upload_date=date(2026, 5, 15),
            duration_seconds=985,
            thumbnail_url=None,
            view_count=650,
            source_state="available",
            last_seen_in_source_at=now,
            tags=["demo", "queued"],
            categories=["Science & Technology"],
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
            discovered_at=now - timedelta(days=15),
            created_at=now - timedelta(days=15),
            updated_at=now,
        ),
    ]
    db.add_all(videos)
    await db.flush()

    media_path = root / signal_dir / "video.mp4"
    db.add(
        MediaFile(
            video_id=videos[0].id,
            relative_path=f"{signal_dir.as_posix()}/video.mp4",
            filename="video.mp4",
            size_bytes=media_path.stat().st_size if media_path.exists() else 0,
            container="mp4",
            video_codec="h264",
            audio_codec="aac",
            fps=30.0,
            width=1920,
            height=1080,
            duration_seconds=672,
            info_json_path=f"{signal_dir.as_posix()}/video.info.json",
            nfo_path=f"{signal_dir.as_posix()}/video.nfo",
            thumbnail_path=f"{signal_dir.as_posix()}/thumbnail.jpg",
            checksum=None,
            created_at=now - timedelta(hours=3),
        )
    )
    db.add_all(
        [
            DownloadJob(
                video_id=videos[1].id,
                status="candidate",
                progress=0,
                quality="1080p",
                priority=50,
                preflight_status="unchecked",
                estimated_bytes=750_000_000,
                error_message=None,
                attempt_count=0,
                created_at=now - timedelta(minutes=19),
                updated_at=now - timedelta(minutes=19),
            ),
            DownloadJob(
                video_id=videos[2].id,
                status="queued",
                progress=0,
                quality="720p",
                priority=70,
                preflight_status="ready",
                estimated_bytes=420_000_000,
                error_message=None,
                attempt_count=1,
                preflight_checked_at=now - timedelta(minutes=10),
                created_at=now - timedelta(minutes=31),
                updated_at=now - timedelta(minutes=9),
            ),
        ]
    )
    await _add_demo_audit_rows(db=db, channel=channel, root=root, now=now)
    await db.flush()
    await event_bus.publish(
        "demo.workspace_seeded",
        {"channel_id": channel.id, "channel_title": channel.title, "videos_created": len(videos), "jobs_created": 2},
    )

    return DemoWorkspaceResult(
        created=True,
        channel_id=channel.id,
        channel_title=channel.title,
        videos_created=len(videos),
        jobs_created=2,
        files_created=files_created,
        archive_root=str(root),
    )


async def clear_demo_workspace(*, db: AsyncSession, download_dir: str) -> DemoWorkspaceClearResult:
    """Remove only the deterministic demo workspace and its demo archive folder."""
    root = Path(download_dir)
    demo_channel = await db.scalar(select(Channel).where(Channel.external_id == DEMO_EXTERNAL_ID))
    if not demo_channel:
        return DemoWorkspaceClearResult(
            cleared=False,
            skipped_reason="demo workspace not found",
            archive_root=str(root),
        )

    demo_root = root / demo_channel_relative_dir()
    if not _is_within_root(root=root, target=demo_root):
        return DemoWorkspaceClearResult(
            cleared=False,
            skipped_reason="demo archive path is outside the configured archive root",
            channel_id=demo_channel.id,
            channel_title=demo_channel.title,
            archive_root=str(root),
        )

    files_removed = _count_files(demo_root)
    db_rows_removed = await _delete_demo_rows(db=db, channel_id=demo_channel.id, root=root)
    if demo_root.exists():
        shutil.rmtree(demo_root)

    await event_bus.publish(
        "demo.workspace_cleared",
        {"channel_id": demo_channel.id, "channel_title": demo_channel.title, "files_removed": files_removed},
    )
    return DemoWorkspaceClearResult(
        cleared=True,
        channel_id=demo_channel.id,
        channel_title=demo_channel.title,
        db_rows_removed=db_rows_removed,
        files_removed=files_removed,
        archive_root=str(root),
    )


def _signal_video_dir() -> Path:
    return Path("channels/@signalvaultlab [UC_CVN_DEMO_SIGNAL]/2026/2026-05-29 - Golden hour archive [cvnDemo01]")


def _write_demo_files(root: Path) -> int:
    signal_dir = root / _signal_video_dir()
    signal_dir.mkdir(parents=True, exist_ok=True)
    info = {
        "id": "cvnDemo01",
        "title": "Golden hour archive",
        "channel": DEMO_TITLE,
        "channel_id": DEMO_EXTERNAL_ID,
        "upload_date": "20260529",
    }
    written = 0
    text_files = {
        "video.info.json": json.dumps(info, indent=2),
        "video.ko.srt": "1\n00:00:00,000 --> 00:00:01,000\nChannel Vault\n",
        "video.nfo": "<movie><title>Channel Vault NAS</title></movie>",
    }
    binary_files = {
        "video.mp4": b"0" * 4096,
        "thumbnail.jpg": b"thumb",
    }
    for filename, payload in text_files.items():
        (signal_dir / filename).write_text(payload, encoding="utf-8")
        written += 1
    for filename, payload in binary_files.items():
        (signal_dir / filename).write_bytes(payload)
        written += 1

    orphan_dir = root / "channels/@signalvaultlab [UC_CVN_DEMO_SIGNAL]/2026/orphan-sidecars"
    orphan_dir.mkdir(parents=True, exist_ok=True)
    (orphan_dir / "video.en.srt").write_text("1\n00:00:00,000 --> 00:00:01,000\nOrphan subtitle\n", encoding="utf-8")
    return written + 1


async def _add_demo_audit_rows(*, db: AsyncSession, channel: Channel, root: Path, now: datetime) -> None:
    db.add_all(
        [
            SyncJob(
                channel_id=channel.id,
                trigger="manual",
                status="completed",
                started_at=now - timedelta(minutes=8),
                completed_at=now - timedelta(minutes=7),
                videos_seen=3,
                videos_created=0,
                candidates_created=0,
                error_message=None,
                created_at=now - timedelta(minutes=8),
            ),
            SyncJob(
                channel_id=channel.id,
                trigger="scheduler",
                status="completed",
                started_at=now - timedelta(minutes=43, seconds=20),
                completed_at=now - timedelta(minutes=43),
                videos_seen=3,
                videos_created=1,
                candidates_created=1,
                error_message=None,
                created_at=now - timedelta(minutes=43, seconds=20),
            ),
            DownloadSchedulerTick(
                trigger="scheduler",
                status="skipped",
                scheduler_enabled=True,
                worker_enabled=False,
                interval_seconds=300,
                limit=2,
                started_count=0,
                completed_count=0,
                failed_count=0,
                skipped_reason="worker disabled",
                started_at=now - timedelta(minutes=20, seconds=1),
                completed_at=now - timedelta(minutes=20),
                next_tick_at=now - timedelta(minutes=15),
                created_at=now - timedelta(minutes=20, seconds=1),
            ),
            MetadataSyncTick(
                trigger="scheduler",
                status="completed",
                scheduler_enabled=True,
                interval_seconds=900,
                limit=2,
                due_channel_count=1,
                synced_count=1,
                failed_count=0,
                videos_seen_count=3,
                videos_created_count=1,
                candidates_created_count=1,
                started_at=now - timedelta(minutes=43, seconds=20),
                completed_at=now - timedelta(minutes=43),
                next_tick_at=now - timedelta(minutes=28),
                created_at=now - timedelta(minutes=43, seconds=20),
            ),
            LibraryView(
                name=DEMO_LIBRARY_VIEW_NAME,
                query="",
                integrity_filter="media_only",
                sidecar_filter="all",
                codec_filter="h264",
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            ),
        ]
    )
    pressure = StoragePressureSnapshot(
        root=str(root),
        archive_bytes=6_200,
        used_bytes=612_000_006_200,
        free_bytes=407_000_000_000,
        total_bytes=1_000_000_000_000,
        pressure_percent=61.5,
        file_count=18,
        dir_count=11,
        channel_count=1,
        orphan_sidecar_count=1,
        unindexed_media_count=0,
        indexed_missing_count=0,
        scanned_at=now - timedelta(hours=3),
        created_at=now - timedelta(hours=3),
    )
    db.add(pressure)
    await db.flush()
    db.add(
        StorageChannelPressureSnapshot(
            snapshot_id=pressure.id,
            root=str(root),
            channel_relative_path="channels/@signalvaultlab [UC_CVN_DEMO_SIGNAL]",
            title=DEMO_TITLE,
            bytes=5_900,
            file_count=7,
            media_count=1,
            sidecar_count=4,
            orphan_sidecar_count=1,
            video_folder_count=1,
            pressure_score=54,
            scanned_at=now - timedelta(hours=3),
            created_at=now - timedelta(hours=3),
        )
    )


async def _delete_demo_rows(*, db: AsyncSession, channel_id: int, root: Path) -> int:
    video_ids = list((await db.scalars(select(Video.id).where(Video.channel_id == channel_id))).all())
    snapshot_ids = list(
        (
            await db.scalars(
                select(StorageChannelPressureSnapshot.snapshot_id).where(
                    StorageChannelPressureSnapshot.channel_relative_path == demo_channel_relative_dir().as_posix()
                )
            )
        ).all()
    )
    deleted = 0
    if video_ids:
        deleted += (await db.execute(delete(DownloadJob).where(DownloadJob.video_id.in_(video_ids)))).rowcount or 0
        deleted += (await db.execute(delete(MediaFile).where(MediaFile.video_id.in_(video_ids)))).rowcount or 0
    deleted += (await db.execute(delete(SyncJob).where(SyncJob.channel_id == channel_id))).rowcount or 0
    deleted += (await db.execute(delete(ChannelPolicy).where(ChannelPolicy.channel_id == channel_id))).rowcount or 0
    deleted += (await db.execute(delete(Video).where(Video.channel_id == channel_id))).rowcount or 0
    deleted += (await db.execute(delete(LibraryView).where(LibraryView.name == DEMO_LIBRARY_VIEW_NAME))).rowcount or 0
    deleted += (
        await db.execute(
            delete(StorageChannelPressureSnapshot).where(
                StorageChannelPressureSnapshot.channel_relative_path == demo_channel_relative_dir().as_posix()
            )
        )
    ).rowcount or 0
    if snapshot_ids:
        deleted += (
            await db.execute(
                delete(StoragePressureSnapshot).where(
                    StoragePressureSnapshot.id.in_(snapshot_ids),
                    StoragePressureSnapshot.root == str(root),
                    StoragePressureSnapshot.channel_count <= 1,
                    StoragePressureSnapshot.archive_bytes <= 100_000,
                )
            )
        ).rowcount or 0
    deleted += (await db.execute(delete(Channel).where(Channel.id == channel_id))).rowcount or 0
    await db.flush()
    return deleted


def _is_within_root(*, root: Path, target: Path) -> bool:
    try:
        target.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def _count_files(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for child in path.rglob("*") if child.is_file())
