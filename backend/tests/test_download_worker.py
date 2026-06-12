"""Download worker execution contract tests."""

import asyncio
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import delete, func, select

from app.config import settings
from app.database import AsyncSessionLocal, init_db, run_migrations
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadSchedulerTick,
    DownloadWorkerRun,
    MediaFile,
    SyncJob,
    Video,
)
from app.schemas.jobs import DownloadWorkerRunRequest
from app.services import download_worker as download_worker_service
from app.services.download_scheduler import (
    get_download_worker_scheduler_status,
    run_download_worker_scheduler_tick,
)
from app.services.download_worker import (
    build_download_worker_plan,
    download_worker_summary_export_rows,
    get_download_worker_run_summary,
    list_download_worker_runs,
    run_download_worker_once,
    stop_running_download_job,
)
from app.services.runtime_settings import list_scheduler_ticks


@pytest.mark.asyncio
async def test_worker_run_once_with_fake_ytdlp_indexes_completed_media(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_db()

    fake_ytdlp = tmp_path / "fake-ytdlp.py"
    archive_root = tmp_path / "archive"
    fake_ytdlp.write_text(
        """#!/usr/bin/env python3
import json
import pathlib
import sys

archive_dir = pathlib.Path(sys.argv[sys.argv.index("-P") + 1])
archive_dir.mkdir(parents=True, exist_ok=True)
(archive_dir / "video.info.json").write_text(json.dumps({
    "id": "workerVideo01",
    "title": "Worker completed fixture",
    "channel": "Worker Channel",
    "channel_id": "UC_WORKER",
    "upload_date": "20260530",
}), encoding="utf-8")
(archive_dir / "video.mp4").write_bytes(b"media")
(archive_dir / "thumbnail.jpg").write_bytes(b"thumb")
print(f"[download] Destination: {archive_dir / 'video.mp4'}", flush=True)
print("[download]  50.0% of 10.00MiB at 1.00MiB/s ETA 00:01", flush=True)
print("[download] 100% of 10.00MiB in 00:00:01 at 10.00MiB/s", flush=True)
""",
        encoding="utf-8",
    )
    fake_ytdlp.chmod(0o755)
    monkeypatch.setattr(settings, "download_worker_enabled", True)
    monkeypatch.setattr(settings, "ytdlp_binary", str(fake_ytdlp))
    monkeypatch.setattr(settings, "download_dir", str(archive_root))

    stray_dir = archive_root / "channels" / "stray" / "2026" / "Stray video [strayVideo]"
    stray_dir.mkdir(parents=True)
    (stray_dir / "video.info.json").write_text(
        """
        {
          "id": "strayVideo",
          "title": "Should not be indexed by a targeted worker pass",
          "channel": "Stray Channel",
          "channel_id": "UC_STRAY",
          "upload_date": "20260530"
        }
        """,
        encoding="utf-8",
    )
    (stray_dir / "video.mp4").write_bytes(b"stray")

    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@worker",
            external_id="UC_WORKER",
            handle="@worker",
            title="Worker Channel",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=1,
            archived_count=0,
            missing_count=1,
            removed_saved_count=0,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(channel)
        await session.flush()
        video = Video(
            channel_id=channel.id,
            external_id="workerVideo01",
            title="Worker completed fixture",
            description=None,
            published_at=datetime(2026, 5, 30, tzinfo=UTC),
            upload_date=date(2026, 5, 30),
            duration_seconds=60,
            thumbnail_url=None,
            view_count=None,
            source_state="available",
            last_seen_in_source_at=datetime.now(UTC),
            tags=None,
            categories=None,
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
        )
        session.add(video)
        await session.flush()
        job = DownloadJob(
            video_id=video.id,
            status="queued",
            progress=0,
            quality="720p",
            priority=90,
            preflight_status="ready",
            estimated_bytes=10_000_000,
            error_message=None,
            attempt_count=0,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(job)
        await session.commit()

    committed_progress: list[int] = []

    async def capture_publish(event_type: str, data: dict[str, object]) -> object | None:
        if event_type == "download.progress":
            async with AsyncSessionLocal() as probe_session:
                visible_job = await probe_session.get(DownloadJob, data["job_id"])
                committed_progress.append(visible_job.progress if visible_job is not None else -1)
        return None

    monkeypatch.setattr(download_worker_service.event_bus, "publish", capture_publish)

    async with AsyncSessionLocal() as session:
        result = await run_download_worker_once(
            db=session,
            payload=DownloadWorkerRunRequest(channel_id=channel.id, limit=1, dry_run=False),
        )
        await session.commit()

    assert result.dry_run is False
    assert result.started == 1
    assert result.completed == 1
    assert result.failed == 0
    assert result.jobs[0].status == "completed"
    assert result.jobs[0].progress == 100
    assert 50 in committed_progress

    async with AsyncSessionLocal() as session:
        media = await session.scalar(select(MediaFile).limit(1))
        completed_job = await session.get(DownloadJob, job.id)
        indexed_video = await session.get(Video, video.id)
        worker_run = await session.scalar(select(DownloadWorkerRun).limit(1))
        video_count = await session.scalar(select(func.count(Video.id)))
        stray_video = await session.scalar(select(Video).where(Video.external_id == "strayVideo"))

    assert media is not None
    assert media.filename == "video.mp4"
    assert media.size_bytes == 5
    assert completed_job is not None
    assert completed_job.status == "completed"
    assert indexed_video is not None
    assert indexed_video.info_json_path is not None
    assert worker_run is not None
    assert worker_run.status == "completed"
    assert worker_run.completed_count == 1
    assert worker_run.planned_job_ids == [job.id]
    assert worker_run.started_job_ids == [job.id]
    assert worker_run.completed_job_ids == [job.id]
    assert worker_run.failed_job_ids == []
    assert video_count == 1
    assert stray_video is None

    async with AsyncSessionLocal() as session:
        summary = await get_download_worker_run_summary(db=session, channel_id=channel.id)

    assert summary.run is not None
    assert summary.run.id == worker_run.id
    assert [item.id for item in summary.latest_worker_jobs] == [job.id]
    assert [item.id for item in summary.completed_jobs] == [job.id]
    assert summary.failed_jobs == []
    assert len(summary.archived_files) == 1
    assert summary.archived_files[0].video_id == video.id
    assert summary.archived_files[0].filename == "video.mp4"
    export_rows = download_worker_summary_export_rows(summary)
    assert [row["row_kind"] for row in export_rows] == ["summary", "job", "media_file"]
    assert export_rows[1]["job_id"] == job.id
    assert export_rows[1]["run_result"] == "completed"
    assert export_rows[2]["filename"] == "video.mp4"


@pytest.mark.asyncio
async def test_worker_stop_terminates_in_process_download(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_db()

    fake_ytdlp = tmp_path / "fake-slow-ytdlp.py"
    archive_root = tmp_path / "archive"
    fake_ytdlp.write_text(
        """#!/usr/bin/env python3
import time

print("[download]  10.0% of 10.00MiB at 1.00MiB/s ETA 00:09", flush=True)
time.sleep(30)
""",
        encoding="utf-8",
    )
    fake_ytdlp.chmod(0o755)
    monkeypatch.setattr(settings, "download_worker_enabled", True)
    monkeypatch.setattr(settings, "ytdlp_binary", str(fake_ytdlp))
    monkeypatch.setattr(settings, "download_dir", str(archive_root))

    async with AsyncSessionLocal() as session:
        channel, _video, job = await _create_queued_worker_job(session)

    progress_seen = asyncio.Event()

    async def capture_publish(event_type: str, data: dict[str, object]) -> object | None:
        if event_type == "download.progress":
            progress_seen.set()
        return None

    monkeypatch.setattr(download_worker_service.event_bus, "publish", capture_publish)

    worker_session = AsyncSessionLocal()
    try:
        worker_task = asyncio.create_task(
            run_download_worker_once(
                db=worker_session,
                payload=DownloadWorkerRunRequest(channel_id=channel.id, limit=1, dry_run=False),
            )
        )
        await asyncio.wait_for(progress_seen.wait(), timeout=5)
        async with AsyncSessionLocal() as stop_session:
            stop_result = await stop_running_download_job(db=stop_session, job_id=job.id)
        result = await asyncio.wait_for(worker_task, timeout=5)
    finally:
        await worker_session.close()

    assert stop_result.job.status == "cancelled"
    assert result.started == 1
    assert result.failed == 1

    async with AsyncSessionLocal() as session:
        stopped_job = await session.get(DownloadJob, job.id)
        worker_run = await session.scalar(select(DownloadWorkerRun).limit(1))

    assert stopped_job is not None
    assert stopped_job.status == "cancelled"
    assert worker_run is not None
    assert worker_run.status == "failed"
    assert worker_run.failed_count == 1


@pytest.mark.asyncio
async def test_worker_plan_respects_paused_channel_policy() -> None:
    run_migrations()
    await init_db()
    await _clear_db()

    async with AsyncSessionLocal() as session:
        channel, _video, _job = await _create_queued_worker_job(session)
        session.add(
            ChannelPolicy(
                channel_id=channel.id,
                auto_download=False,
                max_quality="720p",
                audio_only=False,
                subtitles_enabled=True,
                subtitle_languages=["ko", "en"],
                retention_policy="all",
                worker_paused=True,
                worker_pause_reason="Waiting for NAS maintenance window",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        plan = await build_download_worker_plan(db=session, channel_id=channel.id)

    assert plan.queued_count == 1
    assert plan.claimable_count == 0
    assert plan.jobs == []
    assert plan.locked_reason is not None
    assert "Waiting for NAS maintenance window" in plan.locked_reason


@pytest.mark.asyncio
async def test_worker_run_history_filters_and_duration() -> None:
    run_migrations()
    await init_db()
    await _clear_db()

    started_at = datetime(2026, 5, 31, 12, 0, tzinfo=UTC)
    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@history",
            external_id="UC_WORKER_HISTORY",
            handle="@history",
            title="Worker History Channel",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=0,
            archived_count=0,
            missing_count=0,
            removed_saved_count=0,
            created_at=started_at,
            updated_at=started_at,
        )
        session.add(channel)
        await session.flush()
        session.add_all(
            [
                DownloadWorkerRun(
                    channel_id=channel.id,
                    status="failed",
                    dry_run=False,
                    started_count=1,
                    completed_count=0,
                    failed_count=1,
                    planned_job_ids=[101],
                    started_job_ids=[101],
                    completed_job_ids=[],
                    failed_job_ids=[101],
                    skipped_reason="yt-dlp exited with code 1",
                    started_at=started_at,
                    completed_at=datetime(2026, 5, 31, 12, 0, 7, tzinfo=UTC),
                    created_at=datetime(2026, 5, 31, 12, 0, 7, tzinfo=UTC),
                ),
                DownloadWorkerRun(
                    channel_id=channel.id,
                    status="dry_run",
                    dry_run=True,
                    started_count=0,
                    completed_count=0,
                    failed_count=0,
                    planned_job_ids=[101, 102],
                    started_job_ids=[],
                    completed_job_ids=[],
                    failed_job_ids=[],
                    skipped_reason="dry-run requested",
                    started_at=started_at,
                    completed_at=datetime(2026, 5, 31, 12, 0, 2, tzinfo=UTC),
                    created_at=datetime(2026, 5, 31, 12, 0, 2, tzinfo=UTC),
                ),
                DownloadWorkerRun(
                    channel_id=channel.id,
                    status="completed",
                    dry_run=False,
                    started_count=2,
                    completed_count=2,
                    failed_count=0,
                    planned_job_ids=[201, 202],
                    started_job_ids=[201, 202],
                    completed_job_ids=[201, 202],
                    failed_job_ids=[],
                    skipped_reason=None,
                    started_at=started_at,
                    completed_at=datetime(2026, 5, 31, 12, 0, 5, tzinfo=UTC),
                    created_at=datetime(2026, 5, 31, 12, 0, 5, tzinfo=UTC),
                ),
                DownloadWorkerRun(
                    channel_id=channel.id,
                    status="skipped",
                    dry_run=True,
                    started_count=0,
                    completed_count=0,
                    failed_count=0,
                    planned_job_ids=[],
                    started_job_ids=[],
                    completed_job_ids=[],
                    failed_job_ids=[],
                    skipped_reason="download worker disabled",
                    started_at=started_at,
                    completed_at=datetime(2026, 5, 31, 12, 0, 1, tzinfo=UTC),
                    created_at=datetime(2026, 5, 31, 12, 0, 1, tzinfo=UTC),
                ),
                DownloadWorkerRun(
                    channel_id=channel.id,
                    status="completed",
                    dry_run=False,
                    started_count=1,
                    completed_count=1,
                    failed_count=0,
                    planned_job_ids=[301],
                    started_job_ids=[301],
                    completed_job_ids=[301],
                    failed_job_ids=[],
                    skipped_reason=None,
                    started_at=started_at,
                    completed_at=datetime(2026, 5, 31, 12, 0, 15, tzinfo=UTC),
                    created_at=datetime(2026, 5, 31, 12, 0, 15, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        failed_runs = await list_download_worker_runs(db=session, channel_id=channel.id, failed_only=True)
        dry_runs = await list_download_worker_runs(db=session, channel_id=channel.id, dry_run=True)
        completed_runs = await list_download_worker_runs(db=session, channel_id=channel.id, status="completed")
        skipped_runs = await list_download_worker_runs(db=session, channel_id=channel.id, status="skipped")
        slow_runs = await list_download_worker_runs(db=session, channel_id=channel.id, min_duration_seconds=10)

    assert [run.status for run in failed_runs] == ["failed"]
    assert failed_runs[0].channel_title == "Worker History Channel"
    assert failed_runs[0].duration_seconds == 7
    assert failed_runs[0].skipped_reason == "yt-dlp exited with code 1"
    assert failed_runs[0].planned_job_ids == [101]
    assert failed_runs[0].failed_job_ids == [101]
    assert [run.status for run in dry_runs] == ["dry_run", "skipped"]
    assert dry_runs[0].planned_job_ids == [101, 102]
    assert [run.completed_count for run in completed_runs] == [1, 2]
    assert completed_runs[0].completed_job_ids == [301]
    assert completed_runs[1].completed_job_ids == [201, 202]
    assert [run.status for run in skipped_runs] == ["skipped"]
    assert skipped_runs[0].skipped_reason == "download worker disabled"
    assert [run.duration_seconds for run in slow_runs] == [15]


@pytest.mark.asyncio
async def test_worker_scheduler_tick_respects_paused_channel_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    run_migrations()
    await init_db()
    await _clear_db()
    monkeypatch.setattr(settings, "download_worker_enabled", True)
    monkeypatch.setattr(settings, "download_worker_scheduler_enabled", True)
    monkeypatch.setattr(settings, "download_worker_scheduler_limit", 2)

    async with AsyncSessionLocal() as session:
        channel, _video, job = await _create_queued_worker_job(session)
        session.add(
            ChannelPolicy(
                channel_id=channel.id,
                auto_download=False,
                max_quality="720p",
                audio_only=False,
                subtitles_enabled=True,
                subtitle_languages=["ko", "en"],
                retention_policy="all",
                worker_paused=True,
                worker_pause_reason="NAS maintenance",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        await session.commit()

    result = await run_download_worker_scheduler_tick()

    assert result is not None
    assert result.started == 0
    assert result.completed == 0
    scheduler_status = get_download_worker_scheduler_status()
    assert scheduler_status.state == "armed"
    assert scheduler_status.last_completed_at is not None
    assert scheduler_status.last_result_status == "completed"
    async with AsyncSessionLocal() as session:
        paused_job = await session.get(DownloadJob, job.id)
        worker_run = await session.scalar(select(DownloadWorkerRun).order_by(DownloadWorkerRun.created_at.desc()))

    assert paused_job is not None
    assert paused_job.status == "queued"
    assert worker_run is not None
    assert worker_run.status == "completed"
    assert worker_run.started_count == 0
    async with AsyncSessionLocal() as session:
        scheduler_tick = await session.scalar(
            select(DownloadSchedulerTick).order_by(DownloadSchedulerTick.created_at.desc())
        )

    assert scheduler_tick is not None
    assert scheduler_tick.status == "completed"
    assert scheduler_tick.started_count == 0
    assert scheduler_tick.completed_count == 0


@pytest.mark.asyncio
async def test_worker_scheduler_tick_persists_locked_skip(monkeypatch: pytest.MonkeyPatch) -> None:
    run_migrations()
    await init_db()
    await _clear_db()
    monkeypatch.setattr(settings, "download_worker_enabled", False)
    monkeypatch.setattr(settings, "download_worker_scheduler_enabled", True)
    monkeypatch.setattr(settings, "download_worker_scheduler_interval_seconds", 45)
    monkeypatch.setattr(settings, "download_worker_scheduler_limit", 2)

    result = await run_download_worker_scheduler_tick()

    assert result is None
    async with AsyncSessionLocal() as session:
        scheduler_tick = await session.scalar(
            select(DownloadSchedulerTick).order_by(DownloadSchedulerTick.created_at.desc())
        )

    assert scheduler_tick is not None
    assert scheduler_tick.status == "skipped"
    assert scheduler_tick.skipped_reason == "download worker disabled"
    assert scheduler_tick.worker_enabled is False
    async with AsyncSessionLocal() as session:
        filtered_ticks = await list_scheduler_ticks(
            db=session,
            status="skipped",
            interval_seconds=45,
            worker_limit=2,
            limit=5,
        )
        completed_ticks = await list_scheduler_ticks(db=session, status="completed", limit=5)

    assert filtered_ticks
    assert filtered_ticks[0].status == "skipped"
    assert filtered_ticks[0].interval_seconds == 45
    assert filtered_ticks[0].limit == 2
    assert completed_ticks == []


async def _create_queued_worker_job(session) -> tuple[Channel, Video, DownloadJob]:
    channel = Channel(
        source_type="channel",
        source_url="https://www.youtube.com/@worker",
        external_id="UC_WORKER_STOP",
        handle="@workerstop",
        title="Worker Stop Channel",
        description=None,
        thumbnail_url=None,
        status="active",
        source_video_count=1,
        archived_count=0,
        missing_count=1,
        removed_saved_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(channel)
    await session.flush()
    video = Video(
        channel_id=channel.id,
        external_id="workerStopVideo01",
        title="Worker stop fixture",
        description=None,
        published_at=datetime(2026, 5, 30, tzinfo=UTC),
        upload_date=date(2026, 5, 30),
        duration_seconds=60,
        thumbnail_url=None,
        view_count=None,
        source_state="available",
        last_seen_in_source_at=datetime.now(UTC),
        tags=None,
        categories=None,
        chapters=None,
        is_short=False,
        is_live=False,
        was_livestream=False,
        info_json_path=None,
    )
    session.add(video)
    await session.flush()
    job = DownloadJob(
        video_id=video.id,
        status="queued",
        progress=0,
        quality="720p",
        priority=90,
        preflight_status="ready",
        estimated_bytes=10_000_000,
        error_message=None,
        attempt_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(job)
    await session.commit()
    return channel, video, job


async def _clear_db() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()
