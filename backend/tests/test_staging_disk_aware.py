"""Disk-aware staging contract tests.

These lock the rule that every "skip or stage for download" surface trusts the
same on-disk truth as Library/Channel/Dashboard. A stale ``MediaFile`` DB row
whose file is gone from disk must be treated as missing/stageable, not
archived/skipped, while videos whose media exists on disk are skipped and active
queue rows still prevent duplicate candidates.
"""

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
from app.services.archive_txt import (
    ARCHIVE_TXT_PLACEHOLDER_PREFIX,
    preview_archive_txt,
    stage_archive_txt,
)
from app.services.download_queue import create_channel_download_candidates

STALE_ID = "staleVID001"
ONDISK_ID = "ondiskVID02"
QUEUED_ID = "queuedVID03"
STALE_RELATIVE = f"channels/@stage [UC_STAGE]/2026/Stale clip [{STALE_ID}]/video.mp4"
ONDISK_RELATIVE = f"channels/@stage [UC_STAGE]/2026/On disk clip [{ONDISK_ID}]/video.mp4"
QUEUED_RELATIVE = f"channels/@stage [UC_STAGE]/2026/Queued clip [{QUEUED_ID}]/video.mp4"


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


async def _seed_channel() -> int:
    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@stage",
            external_id="UC_STAGE",
            handle="@stage",
            title="Staging Lab",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=0,
            archived_count=0,
            missing_count=0,
        )
        session.add(channel)
        await session.flush()
        await session.commit()
        return channel.id


async def _add_video(*, channel_id: int, external_id: str, published_day: int) -> int:
    async with AsyncSessionLocal() as session:
        video = Video(
            channel_id=channel_id,
            external_id=external_id,
            title=f"Clip {external_id}",
            description=None,
            published_at=datetime(2026, 6, published_day, 12, 0, tzinfo=UTC),
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
        return video.id


async def _add_media_row(*, video_id: int, relative_path: str) -> None:
    async with AsyncSessionLocal() as session:
        session.add(
            MediaFile(
                video_id=video_id,
                relative_path=relative_path,
                filename="video.mp4",
                size_bytes=512_000_000,
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
        )
        await session.commit()


async def _add_active_job(*, video_id: int, status: str) -> None:
    async with AsyncSessionLocal() as session:
        now = datetime.now(UTC)
        session.add(
            DownloadJob(
                video_id=video_id,
                status=status,
                progress=0,
                quality="1080p",
                priority=70,
                preflight_status="unchecked",
                estimated_bytes=1000,
                created_at=now,
                updated_at=now,
            )
        )
        await session.commit()


def _write_media_file(root: Path, relative_path: str) -> None:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"channel-vault-on-disk-media")


@pytest.mark.asyncio
async def test_candidates_include_stale_row_exclude_on_disk_and_dedupe_active_jobs(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id = await _seed_channel()
    stale_video_id = await _add_video(channel_id=channel_id, external_id=STALE_ID, published_day=3)
    ondisk_video_id = await _add_video(channel_id=channel_id, external_id=ONDISK_ID, published_day=2)
    queued_video_id = await _add_video(channel_id=channel_id, external_id=QUEUED_ID, published_day=1)

    # Stale row: DB row exists, file is missing on disk -> stageable.
    await _add_media_row(video_id=stale_video_id, relative_path=STALE_RELATIVE)
    # On disk: DB row and real file -> already archived, must be skipped.
    await _add_media_row(video_id=ondisk_video_id, relative_path=ONDISK_RELATIVE)
    _write_media_file(tmp_path, ONDISK_RELATIVE)
    # Already queued: active job must prevent a duplicate candidate.
    await _add_active_job(video_id=queued_video_id, status="queued")

    async with AsyncSessionLocal() as session:
        result = await create_channel_download_candidates(
            db=session,
            channel_id=channel_id,
            quality="1080p",
            limit=10,
            download_dir=tmp_path,
        )
        await session.commit()

    assert result is not None
    assert result.candidates_created == 1

    async with AsyncSessionLocal() as session:
        jobs_by_video = {
            video_id: status
            for video_id, status in (
                await session.execute(select(DownloadJob.video_id, DownloadJob.status))
            ).all()
        }

    # Only the stale-row video became a new candidate.
    assert jobs_by_video.get(stale_video_id) == "candidate"
    # On-disk video is archived and was skipped.
    assert ondisk_video_id not in jobs_by_video
    # The already-queued video kept its single queued job (no duplicate candidate).
    assert jobs_by_video.get(queued_video_id) == "queued"


@pytest.mark.asyncio
async def test_candidates_without_archive_root_trust_index(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id = await _seed_channel()
    stale_video_id = await _add_video(channel_id=channel_id, external_id=STALE_ID, published_day=3)
    await _add_media_row(video_id=stale_video_id, relative_path=STALE_RELATIVE)

    async with AsyncSessionLocal() as session:
        result = await create_channel_download_candidates(
            db=session,
            channel_id=channel_id,
            quality="1080p",
            limit=10,
            download_dir=None,
        )
        await session.commit()

    # With no archive root the index is trusted, so an indexed row is treated as
    # archived and no candidate is created -- preserving prior behavior.
    assert result is not None
    assert result.candidates_created == 0


@pytest.mark.asyncio
async def test_archive_txt_preview_reports_stale_indexed_media_as_known_missing(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id = await _seed_channel()
    stale_video_id = await _add_video(channel_id=channel_id, external_id=STALE_ID, published_day=3)
    await _add_media_row(video_id=stale_video_id, relative_path=STALE_RELATIVE)

    content = f"youtube {STALE_ID}"
    async with AsyncSessionLocal() as session:
        disk_aware = await preview_archive_txt(
            session, content=content, channel_id=channel_id, download_dir=tmp_path
        )
        index_trusting = await preview_archive_txt(session, content=content, channel_id=channel_id)

    # With a download root configured, the stale indexed row is missing on disk.
    assert disk_aware.archived_count == 0
    assert disk_aware.known_missing_count == 1
    assert [item.state for item in disk_aware.items] == ["known_missing"]

    # Without a configured root the index is trusted, so it reports as archived.
    assert index_trusting.archived_count == 1
    assert index_trusting.known_missing_count == 0


@pytest.mark.asyncio
async def test_archive_txt_stage_creates_candidate_for_stale_indexed_row(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id = await _seed_channel()
    stale_video_id = await _add_video(channel_id=channel_id, external_id=STALE_ID, published_day=3)
    await _add_media_row(video_id=stale_video_id, relative_path=STALE_RELATIVE)

    content = f"youtube {STALE_ID}"
    async with AsyncSessionLocal() as session:
        result = await stage_archive_txt(
            session,
            content=content,
            channel_id=channel_id,
            quality="1080p",
            download_dir=tmp_path,
        )
        await session.commit()

    assert result is not None
    # The stale indexed row is staged, not skipped as archived.
    assert result.videos_created == 0
    assert result.candidates_created == 1
    assert result.skipped_count == 0
    assert result.preview.archived_count == 0
    assert result.preview.known_missing_count == 1

    async with AsyncSessionLocal() as session:
        job = await session.scalar(select(DownloadJob).where(DownloadJob.video_id == stale_video_id))
        channel = await session.get(Channel, channel_id)

    assert job is not None
    assert job.status == "candidate"
    assert job.quality == "1080p"
    # Disk-aware refresh: the stale row is not counted as archived.
    assert channel is not None
    assert channel.source_video_count == 1
    assert channel.archived_count == 0
    assert channel.missing_count == 1


@pytest.mark.asyncio
async def test_archive_txt_stage_skips_video_whose_media_exists_on_disk(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id = await _seed_channel()
    ondisk_video_id = await _add_video(channel_id=channel_id, external_id=ONDISK_ID, published_day=2)
    await _add_media_row(video_id=ondisk_video_id, relative_path=ONDISK_RELATIVE)
    _write_media_file(tmp_path, ONDISK_RELATIVE)

    content = f"youtube {ONDISK_ID}"
    async with AsyncSessionLocal() as session:
        result = await stage_archive_txt(
            session,
            content=content,
            channel_id=channel_id,
            quality="1080p",
            download_dir=tmp_path,
        )
        await session.commit()

    assert result is not None
    # The on-disk video is archived: nothing staged, it is counted as skipped.
    assert result.videos_created == 0
    assert result.candidates_created == 0
    assert result.skipped_count == 1
    assert result.preview.archived_count == 1
    assert result.preview.known_missing_count == 0

    async with AsyncSessionLocal() as session:
        jobs = (await session.execute(select(DownloadJob))).scalars().all()
        channel = await session.get(Channel, channel_id)
        placeholders = (
            await session.execute(
                select(Video).where(Video.title.like(f"{ARCHIVE_TXT_PLACEHOLDER_PREFIX}%"))
            )
        ).scalars().all()

    assert jobs == []
    assert placeholders == []
    assert channel is not None
    assert channel.archived_count == 1
    assert channel.missing_count == 0
