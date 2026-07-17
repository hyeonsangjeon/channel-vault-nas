"""Focused automatic-backup queueing regression tests."""

from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import delete, select

from app.config import settings
from app.database import AsyncSessionLocal, init_db, run_migrations
from app.models.archive import (
    ArchiveEventLog,
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadSchedulerTick,
    DownloadWorkerRun,
    LibraryView,
    MediaFile,
    MetadataSyncTick,
    SyncJob,
    Video,
)
from app.services.download_worker import build_download_worker_plan
from app.services.metadata_scheduler import _auto_create_candidates


async def _reset_archive_tables() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(ArchiveEventLog))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(MetadataSyncTick))
        await session.execute(delete(SyncJob))
        await session.execute(delete(LibraryView))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()


def _video(*, channel_id: int, external_id: str, day: int) -> Video:
    now = datetime.now(UTC)
    return Video(
        channel_id=channel_id,
        external_id=external_id,
        title=f"Video {external_id}",
        description=None,
        published_at=datetime(2026, 7, day, 12, 0, tzinfo=UTC),
        upload_date=date(2026, 7, day),
        duration_seconds=120,
        thumbnail_url=None,
        view_count=None,
        source_state="available",
        last_seen_in_source_at=now,
        tags=None,
        categories=None,
        chapters=None,
        is_short=False,
        is_live=False,
        was_livestream=False,
        info_json_path=None,
        discovered_at=now,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_auto_queue_is_opt_in_disk_aware_and_idempotent(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    monkeypatch.setattr(settings, "metadata_sync_auto_candidates_limit", 10)
    monkeypatch.setattr(settings, "download_worker_enabled", True)

    now = datetime.now(UTC)
    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@auto-queue",
            external_id="UC_AUTO_QUEUE",
            handle="@auto-queue",
            title="Automatic Queue",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=6,
            archived_count=1,
            missing_count=5,
            removed_saved_count=0,
            created_at=now,
            updated_at=now,
        )
        session.add(channel)
        await session.flush()
        policy = ChannelPolicy(
            channel_id=channel.id,
            auto_download=False,
            max_quality="1080p",
            worker_paused=False,
        )
        fresh_video = _video(channel_id=channel.id, external_id="freshAuto01", day=5)
        candidate_video = _video(channel_id=channel.id, external_id="candidate02", day=4)
        running_video = _video(channel_id=channel.id, external_id="runningAuto3", day=3)
        completed_video = _video(channel_id=channel.id, external_id="completed04", day=2)
        failed_video = _video(channel_id=channel.id, external_id="failedAuto06", day=6)
        archived_video = _video(channel_id=channel.id, external_id="archivedAuto5", day=1)
        session.add_all(
            [
                policy,
                fresh_video,
                candidate_video,
                running_video,
                completed_video,
                failed_video,
                archived_video,
            ]
        )
        await session.flush()

        session.add_all(
            [
                DownloadJob(video_id=candidate_video.id, status="candidate", quality="720p"),
                DownloadJob(video_id=running_video.id, status="running", quality="1080p"),
                DownloadJob(video_id=completed_video.id, status="completed", quality="1080p"),
                DownloadJob(video_id=failed_video.id, status="failed", quality="1080p"),
            ]
        )
        archived_relative = "channels/@auto-queue [UC_AUTO_QUEUE]/2026/archivedAuto5/video.mp4"
        archived_path = tmp_path / archived_relative
        archived_path.parent.mkdir(parents=True, exist_ok=True)
        archived_path.write_bytes(b"already archived")
        session.add(
            MediaFile(
                video_id=archived_video.id,
                relative_path=archived_relative,
                filename="video.mp4",
                size_bytes=16,
                container="mp4",
                video_codec="h264",
                audio_codec="aac",
                fps=30.0,
                width=1920,
                height=1080,
                duration_seconds=120,
            )
        )
        off_sync = SyncJob(
            channel_id=channel.id,
            trigger="scheduler",
            status="completed",
            started_at=now,
            completed_at=now,
            created_at=now,
        )
        session.add(off_sync)
        await session.flush()

        created_while_off = await _auto_create_candidates(
            session=session,
            channel_id=channel.id,
            policy=policy,
            sync_job_id=off_sync.id,
        )
        jobs_while_off = (
            await session.execute(select(DownloadJob).order_by(DownloadJob.id))
        ).scalars().all()

        assert created_while_off == 0
        assert fresh_video.id not in {job.video_id for job in jobs_while_off}
        assert next(job for job in jobs_while_off if job.video_id == candidate_video.id).status == "candidate"

        policy.auto_download = True
        auto_sync = SyncJob(
            channel_id=channel.id,
            trigger="scheduler",
            status="completed",
            started_at=now,
            completed_at=now,
            created_at=now,
        )
        session.add(auto_sync)
        await session.flush()
        created_while_on = await _auto_create_candidates(
            session=session,
            channel_id=channel.id,
            policy=policy,
            sync_job_id=auto_sync.id,
        )
        await session.flush()
        worker_plan = await build_download_worker_plan(db=session, channel_id=channel.id, limit=10)

        rerun_sync = SyncJob(
            channel_id=channel.id,
            trigger="scheduler",
            status="completed",
            started_at=now,
            completed_at=now,
            created_at=now,
        )
        session.add(rerun_sync)
        await session.flush()
        created_on_rerun = await _auto_create_candidates(
            session=session,
            channel_id=channel.id,
            policy=policy,
            sync_job_id=rerun_sync.id,
        )
        await session.commit()

        jobs = (await session.execute(select(DownloadJob).order_by(DownloadJob.id))).scalars().all()

    jobs_by_video = {job.video_id: job.status for job in jobs}
    completed_video_statuses = [job.status for job in jobs if job.video_id == completed_video.id]
    assert created_while_on == 2
    assert jobs_by_video[fresh_video.id] == "queued"
    assert jobs_by_video[candidate_video.id] == "candidate"
    assert jobs_by_video[running_video.id] == "running"
    assert completed_video_statuses == ["completed", "queued"]
    assert jobs_by_video[failed_video.id] == "failed"
    assert archived_video.id not in jobs_by_video
    assert auto_sync.candidates_created == 2
    assert worker_plan.queued_count == 2
    assert worker_plan.claimable_count == 2

    assert created_on_rerun == 0
    assert rerun_sync.candidates_created == 0
    assert len(jobs) == 6
