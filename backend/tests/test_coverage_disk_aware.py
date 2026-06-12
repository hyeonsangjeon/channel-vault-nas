"""Disk-aware coverage/dashboard contract tests.

These lock the behavior that non-Library archive surfaces (channel coverage,
the missing list, and the dashboard headline) trust actual media files on disk
under the archive root instead of stale ``MediaFile`` DB rows. A DB-only row
with no file on disk must not inflate archived/downloaded counts, matching the
Library. Without a configured archive root the counts fall back to the index.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import delete

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
from app.services.archive_metrics import (
    build_channel_coverage_from_db,
    list_missing_videos_from_db,
)
from app.services.channel_sync import get_channel_detail, list_channel_videos
from app.services.dashboard import build_dashboard_snapshot

CHANNEL_DIR = "channels/@coverage [UC_COVERAGE]/2026/Coverage clip [coverage01]"
RELATIVE_MEDIA = f"{CHANNEL_DIR}/video.mp4"


async def _reset_archive_tables() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()


async def _seed_channel_and_video() -> tuple[int, int]:
    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@coverage",
            external_id="UC_COVERAGE",
            handle="@coverage",
            title="Coverage Lab",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=1,
            archived_count=1,
            missing_count=0,
        )
        session.add(channel)
        await session.flush()

        video = Video(
            channel_id=channel.id,
            external_id="coverage01",
            title="Coverage clip",
            description=None,
            published_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
            upload_date=None,
            duration_seconds=42,
            thumbnail_url=None,
            view_count=None,
            source_state="available",
            tags=[],
            categories=[],
            chapters=[],
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
        )
        session.add(video)
        await session.flush()
        await session.commit()
        return channel.id, video.id


async def _add_media_file(*, video_id: int, size_bytes: int) -> int:
    async with AsyncSessionLocal() as session:
        media = MediaFile(
            video_id=video_id,
            relative_path=RELATIVE_MEDIA,
            filename="video.mp4",
            size_bytes=size_bytes,
            container="mp4",
            video_codec="h264",
            audio_codec="aac",
            fps=30.0,
            width=1920,
            height=1080,
            duration_seconds=42,
            info_json_path=None,
            nfo_path=None,
            thumbnail_path=None,
            checksum=None,
            created_at=datetime(2026, 6, 1, 12, 1, tzinfo=UTC),
        )
        session.add(media)
        await session.flush()
        await session.commit()
        return media.id


async def _mark_video_removed(*, channel_id: int, video_id: int) -> None:
    async with AsyncSessionLocal() as session:
        channel = await session.get(Channel, channel_id)
        video = await session.get(Video, video_id)
        assert channel is not None
        assert video is not None
        video.source_state = "removed"
        video.removed_detected_at = datetime(2026, 6, 2, 12, 0, tzinfo=UTC)
        channel.removed_saved_count = 1
        await session.commit()


@pytest.mark.asyncio
async def test_db_only_media_is_not_archived_in_coverage_or_dashboard(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()
    await _add_media_file(video_id=video_id, size_bytes=512_000_000)

    async with AsyncSessionLocal() as session:
        coverage = await build_channel_coverage_from_db(session, channel_id, download_dir=tmp_path)
        missing = await list_missing_videos_from_db(session, channel_id, download_dir=tmp_path)
        videos = await list_channel_videos(session, channel_id, download_dir=tmp_path)
        detail = await get_channel_detail(session, channel_id, download_dir=tmp_path)
        dashboard = await build_dashboard_snapshot(session, download_dir=tmp_path)

    assert coverage is not None
    assert coverage.source == 1
    assert coverage.archived == 0
    assert coverage.missing == 1
    assert coverage.percent == 0.0

    assert missing is not None
    assert [item.id for item in missing] == ["coverage01"]

    assert videos is not None
    assert videos[0].archive_state == "missing"

    assert detail is not None
    assert detail.archived_count == 0
    assert detail.missing_count == 1

    assert dashboard.coverage.source == 1
    assert dashboard.coverage.archived == 0
    assert dashboard.coverage.missing == 1
    assert dashboard.channels[0].new_videos == 1


@pytest.mark.asyncio
async def test_on_disk_media_is_archived_in_coverage_and_dashboard(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()

    payload = b"channel-vault-coverage-media"
    media_dir = tmp_path / CHANNEL_DIR
    media_dir.mkdir(parents=True)
    (media_dir / "video.mp4").write_bytes(payload)
    await _add_media_file(video_id=video_id, size_bytes=len(payload))

    async with AsyncSessionLocal() as session:
        coverage = await build_channel_coverage_from_db(session, channel_id, download_dir=tmp_path)
        missing = await list_missing_videos_from_db(session, channel_id, download_dir=tmp_path)
        videos = await list_channel_videos(session, channel_id, download_dir=tmp_path)
        detail = await get_channel_detail(session, channel_id, download_dir=tmp_path)
        dashboard = await build_dashboard_snapshot(session, download_dir=tmp_path)

    assert coverage is not None
    assert coverage.source == 1
    assert coverage.archived == 1
    assert coverage.missing == 0
    assert coverage.percent == 100.0

    assert missing == []
    assert videos is not None
    assert videos[0].archive_state == "archived"

    assert detail is not None
    assert detail.archived_count == 1
    assert detail.missing_count == 0

    assert dashboard.coverage.source == 1
    assert dashboard.coverage.archived == 1
    assert dashboard.coverage.missing == 0
    assert dashboard.channels[0].new_videos == 0


@pytest.mark.asyncio
async def test_removed_saved_requires_existing_media_file(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()
    await _add_media_file(video_id=video_id, size_bytes=512_000_000)
    await _mark_video_removed(channel_id=channel_id, video_id=video_id)

    async with AsyncSessionLocal() as session:
        stale_coverage = await build_channel_coverage_from_db(session, channel_id, download_dir=tmp_path)
        stale_dashboard = await build_dashboard_snapshot(session, download_dir=tmp_path)

    assert stale_coverage is not None
    assert stale_coverage.archived == 0
    assert stale_coverage.missing == 0
    assert stale_coverage.removed_saved == 0
    assert stale_dashboard.coverage.archived == 0
    assert stale_dashboard.coverage.missing == 0
    assert stale_dashboard.coverage.removed_saved == 0
    assert stale_dashboard.channels[0].new_videos == 0

    media_dir = tmp_path / CHANNEL_DIR
    media_dir.mkdir(parents=True)
    (media_dir / "video.mp4").write_bytes(b"removed-local-copy")

    async with AsyncSessionLocal() as session:
        saved_coverage = await build_channel_coverage_from_db(session, channel_id, download_dir=tmp_path)
        saved_dashboard = await build_dashboard_snapshot(session, download_dir=tmp_path)

    assert saved_coverage is not None
    assert saved_coverage.archived == 1
    assert saved_coverage.missing == 0
    assert saved_coverage.removed_saved == 1
    assert saved_dashboard.coverage.archived == 1
    assert saved_dashboard.coverage.missing == 0
    assert saved_dashboard.coverage.removed_saved == 1


@pytest.mark.asyncio
async def test_coverage_without_archive_root_trusts_index() -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()
    await _add_media_file(video_id=video_id, size_bytes=512_000_000)

    async with AsyncSessionLocal() as session:
        coverage = await build_channel_coverage_from_db(session, channel_id)
        detail = await get_channel_detail(session, channel_id)

    # With no archive root the index is trusted, preserving the indexed counts
    # for callers that intentionally opt out of the disk-aware check.
    assert coverage is not None
    assert coverage.archived == 1
    assert coverage.missing == 0
    # The detail without a download_dir keeps the persisted index counts.
    assert detail is not None
    assert detail.archived_count == 1
    assert detail.missing_count == 0
