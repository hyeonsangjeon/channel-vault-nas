"""Seed an isolated SQLite/NAS fixture for browser smoke tests."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))


def _sqlite_url(database_path: Path) -> str:
    return f"sqlite+aiosqlite:///{database_path}"


def _reset_path(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def _write_sidecar(video_dir: Path, payload: dict[str, object], media_name: str, media_size: int) -> None:
    video_dir.mkdir(parents=True, exist_ok=True)
    (video_dir / "video.info.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (video_dir / media_name).write_bytes(b"0" * media_size)
    (video_dir / "thumbnail.jpg").write_bytes(b"thumb")
    (video_dir / "video.ko.srt").write_text("1\n00:00:00,000 --> 00:00:01,000\nChannel Vault\n", encoding="utf-8")
    (video_dir / "video.nfo").write_text("<movie><title>Channel Vault NAS</title></movie>", encoding="utf-8")


async def seed() -> None:
    database_path = Path(os.environ.get("CVN_E2E_DB_PATH", "/tmp/channel-vault-nas-e2e/app.db"))
    archive_root = Path(os.environ.get("CVN_E2E_ARCHIVE_DIR", "/tmp/channel-vault-nas-e2e/archive"))
    database_path.parent.mkdir(parents=True, exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        _reset_path(Path(f"{database_path}{suffix}"))
    _reset_path(archive_root)
    archive_root.mkdir(parents=True, exist_ok=True)

    os.environ["CVN_DATABASE_URL"] = _sqlite_url(database_path)
    os.environ["CVN_DOWNLOAD_DIR"] = str(archive_root)

    import app.models  # noqa: F401
    from app.database import Base
    from app.models.archive import Channel, ChannelPolicy, DownloadJob, MediaFile, SyncJob, Video

    engine = create_async_engine(_sqlite_url(database_path), future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime.now(UTC)

    signal_dir = Path("channels/@signalvaultlab [UC_CVN_E2E]/2026/2026-05-29 - Golden hour archive [cvnE2E01]")
    _write_sidecar(
        archive_root / signal_dir,
        {
            "id": "cvnE2E01",
            "title": "Golden hour archive",
            "channel": "Signal Lab",
            "channel_id": "UC_CVN_E2E",
            "upload_date": "20260529",
        },
        "video.mp4",
        4096,
    )
    recovered_dir = Path(
        "channels/@recoveredvault [UC_CVN_RECOVERED]/2026/2026-05-28 - Recovered night run [cvnE2E04]"
    )
    _write_sidecar(
        archive_root / recovered_dir,
        {
            "id": "cvnE2E04",
            "title": "Recovered night run",
            "channel": "Recovered Vault",
            "channel_id": "UC_CVN_RECOVERED",
            "upload_date": "20260528",
        },
        "video.webm",
        2048,
    )

    async with Session() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@signalvaultlab",
            external_id="UC_CVN_E2E",
            handle="@signalvaultlab",
            title="Signal Lab",
            description="A deterministic creator-owned archive fixture for Channel Vault NAS.",
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
        session.add(channel)
        await session.flush()

        session.add(
            ChannelPolicy(
                channel_id=channel.id,
                auto_download=False,
                max_quality="1080p",
                audio_only=False,
                subtitles_enabled=True,
                subtitle_languages=["ko", "en"],
                retention_policy="keep",
                created_at=now - timedelta(days=30),
                updated_at=now,
            )
        )

        videos = [
            Video(
                channel_id=channel.id,
                external_id="cvnE2E01",
                title="Golden hour archive",
                description="Already indexed local media.",
                published_at=now - timedelta(days=1),
                upload_date=date(2026, 5, 29),
                duration_seconds=672,
                thumbnail_url=None,
                view_count=1200,
                source_state="available",
                last_seen_in_source_at=now,
                tags=["e2e", "archive"],
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
                external_id="cvnE2E02",
                title="Queue calibration pass",
                description="Missing media with a candidate queue row.",
                published_at=now - timedelta(days=8),
                upload_date=date(2026, 5, 22),
                duration_seconds=1240,
                thumbnail_url=None,
                view_count=840,
                source_state="available",
                last_seen_in_source_at=now,
                tags=["e2e", "queue"],
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
                external_id="cvnE2E03",
                title="Queued rescue window",
                description="Missing media already armed in the queue.",
                published_at=now - timedelta(days=15),
                upload_date=date(2026, 5, 15),
                duration_seconds=985,
                thumbnail_url=None,
                view_count=650,
                source_state="available",
                last_seen_in_source_at=now,
                tags=["e2e", "queued"],
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
        session.add_all(videos)
        await session.flush()

        session.add(
            MediaFile(
                video_id=videos[0].id,
                relative_path=f"{signal_dir.as_posix()}/video.mp4",
                filename="video.mp4",
                size_bytes=(archive_root / signal_dir / "video.mp4").stat().st_size,
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
        session.add_all(
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
                    preflight_status="unchecked",
                    estimated_bytes=420_000_000,
                    error_message=None,
                    attempt_count=1,
                    created_at=now - timedelta(minutes=31),
                    updated_at=now - timedelta(minutes=9),
                ),
            ]
        )
        session.add(
            SyncJob(
                channel_id=channel.id,
                status="completed",
                started_at=now - timedelta(minutes=8),
                completed_at=now - timedelta(minutes=7),
                videos_seen=3,
                videos_created=0,
                error_message=None,
                created_at=now - timedelta(minutes=8),
            )
        )
        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
