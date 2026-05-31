"""Tests for DB backup and sidecar recovery contracts."""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import delete, select

from app.database import AsyncSessionLocal, init_db, run_migrations
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadWorkerRun,
    MediaFile,
    SyncJob,
    Video,
)
from app.services.archive_rescan import apply_rescan_plan, apply_rescan_target, build_rescan_plan
from app.services.library_index import list_library_files
from app.services.media_probe import MediaProbe
from app.services.storage_guard import backup_sqlite_database, sqlite_path_from_url
from app.services.storage_scanner import build_storage_scan


def test_sqlite_path_from_url_resolves_relative_path(tmp_path: Path) -> None:
    resolved = sqlite_path_from_url("sqlite+aiosqlite:///./metadata/app.db", cwd=tmp_path)

    assert resolved == tmp_path / "metadata" / "app.db"


def test_backup_sqlite_database_creates_timestamped_copy(tmp_path: Path) -> None:
    metadata_dir = tmp_path / "metadata"
    metadata_dir.mkdir()
    database_path = metadata_dir / "app.db"
    database_path.write_text("sqlite bytes", encoding="utf-8")

    backup_path = backup_sqlite_database(
        f"sqlite+aiosqlite:///{database_path}",
        metadata_dir,
        now=datetime(2026, 5, 30, 11, 30, 0, tzinfo=UTC),
    )

    assert backup_path == metadata_dir / "db-backups" / "app.backup-20260530-113000.db"
    assert backup_path.read_text(encoding="utf-8") == "sqlite bytes"


def test_archive_rescan_plan_discovers_video_info_sidecars(tmp_path: Path) -> None:
    video_dir = (
        tmp_path
        / "channels"
        / "@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]"
        / "2022"
        / "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]"
    )
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        """
        {
          "id": "6lXl1hkEgcA",
          "title": "HEAVY BAG DRILLS",
          "channel": "wingnut987S",
          "channel_id": "UCmLADXQtWVuzOnOK5TNrWaw",
          "upload_date": "20220520"
        }
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "thumbnail.jpg").write_text("thumbnail", encoding="utf-8")
    (video_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")
    (video_dir / "video.nfo").write_text("nfo", encoding="utf-8")

    plan = build_rescan_plan(tmp_path)

    assert plan.candidate_count == 1
    assert plan.warnings == []
    candidate = plan.candidates[0]
    assert candidate.video_id == "6lXl1hkEgcA"
    assert candidate.channel_id == "UCmLADXQtWVuzOnOK5TNrWaw"
    assert candidate.title == "HEAVY BAG DRILLS"
    assert candidate.media_files == [
        "channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022/"
        "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]/video.mp4"
    ]
    assert candidate.nfo is not None


def test_storage_scan_summarizes_real_archive_and_orphan_sidecars(tmp_path: Path) -> None:
    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Signal clip [sig01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "video.info.json").write_text("{}", encoding="utf-8")
    orphan_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "orphan"
    orphan_dir.mkdir(parents=True)
    (orphan_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")

    scan = build_storage_scan(tmp_path)

    assert scan.volume.exists is True
    assert scan.volume.file_count == 3
    assert scan.volume.archive_bytes > 0
    assert scan.channels[0].relative_path == "channels/signal [UC_SIGNAL]"
    assert scan.channels[0].media_count == 1
    assert scan.channels[0].sidecar_count == 2
    assert scan.channels[0].orphan_sidecar_count == 1
    assert scan.top_extensions[0].count >= 1
    assert scan.orphan_sidecars[0].kind == "subtitle"
    assert any(node.relative_path == "channels" for node in scan.folder_tree)


@pytest.mark.asyncio
async def test_archive_rescan_apply_indexes_sidecars_into_db(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()

    video_dir = (
        tmp_path
        / "channels"
        / "@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]"
        / "2022"
        / "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]"
    )
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        """
        {
          "id": "6lXl1hkEgcA",
          "title": "HEAVY BAG DRILLS",
          "channel": "wingnut987S",
          "channel_id": "UCmLADXQtWVuzOnOK5TNrWaw",
          "upload_date": "20220520"
        }
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "thumbnail.jpg").write_text("thumbnail", encoding="utf-8")
    (video_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")

    async def fake_probe(path: Path) -> MediaProbe:
        assert path.name == "video.mp4"
        return MediaProbe(
            container="mp4",
            video_codec="h264",
            audio_codec="aac",
            fps=29.97,
            width=1920,
            height=1080,
            duration_seconds=61,
        )

    monkeypatch.setattr("app.services.archive_rescan.probe_media_file", fake_probe)

    async with AsyncSessionLocal() as session:
        result = await apply_rescan_plan(session, tmp_path)
        await session.commit()

    assert result.candidates_seen == 1
    assert result.channels_created == 1
    assert result.videos_created == 1
    assert result.media_files_indexed == 1
    assert result.thumbnails_indexed == 1
    assert result.subtitles_indexed == 1

    async with AsyncSessionLocal() as session:
        channel = await session.scalar(select(Channel))
        video = await session.scalar(select(Video))
        media = await session.scalar(select(MediaFile))

    assert channel is not None
    assert channel.archived_count == 1
    assert channel.missing_count == 0
    assert video is not None
    assert video.external_id == "6lXl1hkEgcA"
    assert video.duration_seconds == 61
    assert media is not None
    assert media.size_bytes == 5
    assert media.container == "mp4"
    assert media.video_codec == "h264"
    assert media.audio_codec == "aac"
    assert media.fps == 29.97
    assert media.width == 1920
    assert media.height == 1080
    assert media.duration_seconds == 61
    assert media.thumbnail_path is not None

    async with AsyncSessionLocal() as session:
        library_files = await list_library_files(db=session, video_id=video.id, download_dir=tmp_path)

    assert library_files is not None
    assert library_files[0].exists is True
    assert library_files[0].integrity_state == "complete"
    assert library_files[0].info_json_exists is True
    assert library_files[0].thumbnail_exists is True
    assert {sidecar.kind for sidecar in library_files[0].sidecars} == {"info_json", "thumbnail", "subtitle"}


@pytest.mark.asyncio
async def test_archive_rescan_target_indexes_only_requested_video_folder(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()

    target_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Target clip [target01]"
    stray_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Stray clip [stray01]"
    _write_sidecar_video(target_dir, video_id="target01", title="Target clip")
    _write_sidecar_video(stray_dir, video_id="stray01", title="Stray clip")

    async with AsyncSessionLocal() as session:
        result = await apply_rescan_target(session, tmp_path, target_dir)
        await session.commit()

    assert result.candidates_seen == 1
    assert result.channels_created == 1
    assert result.videos_created == 1
    assert result.media_files_indexed == 1
    assert result.warnings == []

    async with AsyncSessionLocal() as session:
        videos = (await session.execute(select(Video).order_by(Video.external_id))).scalars().all()
        media_files = (await session.execute(select(MediaFile))).scalars().all()

    assert [video.external_id for video in videos] == ["target01"]
    assert len(media_files) == 1
    assert media_files[0].relative_path.endswith("Target clip [target01]/video.mp4")


def _write_sidecar_video(video_dir: Path, *, video_id: str, title: str) -> None:
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        f"""
        {{
          "id": "{video_id}",
          "title": "{title}",
          "channel": "Signal Lab",
          "channel_id": "UC_SIGNAL",
          "upload_date": "20260530"
        }}
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
