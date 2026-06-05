"""Safe download worker planning before media transfer is enabled."""

from __future__ import annotations

import asyncio
import shlex
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadWorkerRun,
    MediaFile,
    Video,
)
from app.schemas.jobs import (
    DownloadJobActionResult,
    DownloadJobRead,
    DownloadWorkerPlan,
    DownloadWorkerPlanJob,
    DownloadWorkerRunRead,
    DownloadWorkerRunRequest,
    DownloadWorkerRunResult,
    DownloadWorkerRunSummaryFile,
    DownloadWorkerRunSummaryRead,
)
from app.services.archive_paths import video_archive_dir
from app.services.archive_rescan import apply_rescan_target
from app.services.download_queue import DownloadJobNotFoundError, to_download_job
from app.services.event_bus import event_bus
from app.services.ytdlp_progress import parse_ytdlp_progress_line

OUTPUT_TEMPLATE = "video.%(ext)s"
_RUNNING_PROCESSES: dict[int, asyncio.subprocess.Process] = {}


async def build_download_worker_plan(
    *,
    db: AsyncSession,
    channel_id: int | None = None,
    limit: int | None = None,
) -> DownloadWorkerPlan:
    """Return queued jobs in the exact shape a future worker can claim."""
    effective_limit = max(1, min(limit or settings.download_worker_plan_limit, 20))
    rows = (
        await db.execute(
            _queued_download_query(channel_id=channel_id)
            .order_by(DownloadJob.priority.desc(), DownloadJob.updated_at.asc(), DownloadJob.created_at.asc())
            .limit(effective_limit)
        )
    ).all()
    queued_count = await db.scalar(_queued_download_count(channel_id=channel_id))
    running_count = await db.scalar(_running_download_count(channel_id=channel_id))
    running_rows = (
        await db.execute(
            _running_download_query(channel_id=channel_id)
            .order_by(DownloadJob.started_at.asc(), DownloadJob.updated_at.asc())
            .limit(5)
        )
    ).all()
    locked_reason = None
    if not settings.download_worker_enabled:
        locked_reason = "Media worker is disabled. Set CVN_DOWNLOAD_WORKER_ENABLED=true before starting real transfers."
    paused_reason = await _paused_reason(db=db, channel_id=channel_id)
    if paused_reason is not None:
        locked_reason = paused_reason

    jobs = [_to_worker_plan_job(job=job, video=video, channel=channel) for job, video, channel in rows]
    running_jobs = [
        _to_worker_plan_job(job=job, video=video, channel=channel) for job, video, channel in running_rows
    ]
    return DownloadWorkerPlan(
        enabled=settings.download_worker_enabled,
        dry_run=True,
        channel_id=channel_id,
        limit=effective_limit,
        queued_count=int(queued_count or 0),
        claimable_count=len(jobs),
        running_count=int(running_count or 0),
        locked_reason=locked_reason,
        running_jobs=running_jobs,
        jobs=jobs,
    )


async def run_download_worker_once(
    *,
    db: AsyncSession,
    payload: DownloadWorkerRunRequest,
) -> DownloadWorkerRunResult:
    """Run one bounded worker pass, defaulting to a non-mutating dry-run."""
    plan = await build_download_worker_plan(db=db, channel_id=payload.channel_id, limit=payload.limit)
    planned_job_ids = [item.job.id for item in plan.jobs]
    if payload.dry_run or not settings.download_worker_enabled:
        skipped_reason = plan.locked_reason if not settings.download_worker_enabled else "dry-run requested"
        audit = DownloadWorkerRun(
            channel_id=payload.channel_id,
            status="locked" if not settings.download_worker_enabled else "dry_run",
            dry_run=True,
            started_count=0,
            completed_count=0,
            failed_count=0,
            planned_job_ids=planned_job_ids,
            started_job_ids=[],
            completed_job_ids=[],
            failed_job_ids=[],
            skipped_reason=skipped_reason,
            started_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
        )
        db.add(audit)
        await db.flush()
        return DownloadWorkerRunResult(
            enabled=settings.download_worker_enabled,
            dry_run=True,
            started=0,
            completed=0,
            failed=0,
            skipped_reason=skipped_reason,
            plan=plan,
            jobs=[item.job for item in plan.jobs],
        )

    audit = DownloadWorkerRun(
        channel_id=payload.channel_id,
        status="running",
        dry_run=False,
        started_count=0,
        completed_count=0,
        failed_count=0,
        planned_job_ids=planned_job_ids,
        started_job_ids=[],
        completed_job_ids=[],
        failed_job_ids=[],
        skipped_reason=None,
        started_at=datetime.now(UTC),
        completed_at=None,
        created_at=datetime.now(UTC),
    )
    db.add(audit)
    await _commit_worker_state(db)

    started = 0
    completed = 0
    failed = 0
    started_job_ids: list[int] = []
    completed_job_ids: list[int] = []
    failed_job_ids: list[int] = []
    results = []
    for item in plan.jobs:
        row = await db.execute(
            _queued_download_query(channel_id=payload.channel_id).where(DownloadJob.id == item.job.id)
        )
        result = row.one_or_none()
        if result is None:
            continue
        job, video, channel = result
        started += 1
        started_job_ids.append(job.id)
        ok = await _run_one_job(db=db, job=job, video=video, channel=channel)
        completed += int(ok)
        failed += int(not ok)
        if ok:
            completed_job_ids.append(job.id)
        else:
            failed_job_ids.append(job.id)
        audit.started_count = started
        audit.completed_count = completed
        audit.failed_count = failed
        audit.started_job_ids = list(started_job_ids)
        audit.completed_job_ids = list(completed_job_ids)
        audit.failed_job_ids = list(failed_job_ids)
        await _commit_worker_state(db)
        results.append(to_download_job(job, video, channel))

    audit.status = "completed" if failed == 0 else "failed"
    audit.completed_at = datetime.now(UTC)
    audit.started_count = started
    audit.completed_count = completed
    audit.failed_count = failed
    await _commit_worker_state(db)
    refreshed_plan = await build_download_worker_plan(db=db, channel_id=payload.channel_id, limit=payload.limit)
    return DownloadWorkerRunResult(
        enabled=settings.download_worker_enabled,
        dry_run=False,
        started=started,
        completed=completed,
        failed=failed,
        skipped_reason=None,
        plan=refreshed_plan,
        jobs=results,
    )


async def list_download_worker_runs(
    *,
    db: AsyncSession,
    channel_id: int | None = None,
    status: str | None = None,
    dry_run: bool | None = None,
    failed_only: bool = False,
    limit: int = 10,
) -> list[DownloadWorkerRunRead]:
    """Return newest persisted worker passes."""
    query = select(DownloadWorkerRun, Channel).outerjoin(Channel, DownloadWorkerRun.channel_id == Channel.id)
    if channel_id is not None:
        query = query.where(DownloadWorkerRun.channel_id == channel_id)
    if status:
        query = query.where(DownloadWorkerRun.status == status)
    if dry_run is not None:
        query = query.where(DownloadWorkerRun.dry_run.is_(dry_run))
    if failed_only:
        query = query.where(or_(DownloadWorkerRun.status == "failed", DownloadWorkerRun.failed_count > 0))
    effective_limit = max(1, min(limit, 100))
    rows = (await db.execute(query.order_by(DownloadWorkerRun.created_at.desc()).limit(effective_limit))).all()
    return [_to_worker_run_read(run, channel) for run, channel in rows]


async def get_download_worker_run_summary(
    *,
    db: AsyncSession,
    channel_id: int | None = None,
    run_id: int | None = None,
) -> DownloadWorkerRunSummaryRead:
    """Return a correlated worker pass summary for support and NAS automation."""
    query = select(DownloadWorkerRun, Channel).outerjoin(Channel, DownloadWorkerRun.channel_id == Channel.id)
    if run_id is not None:
        query = query.where(DownloadWorkerRun.id == run_id)
    elif channel_id is not None:
        query = query.where(DownloadWorkerRun.channel_id == channel_id)
    row = (await db.execute(query.order_by(DownloadWorkerRun.created_at.desc()).limit(1))).one_or_none()
    if row is None:
        channel = await db.get(Channel, channel_id) if channel_id is not None else None
        return DownloadWorkerRunSummaryRead(
            generated_at=datetime.now(UTC),
            channel_id=channel_id,
            channel_title=channel.title if channel else None,
            run=None,
            latest_worker_jobs=[],
            completed_jobs=[],
            failed_jobs=[],
            archived_files=[],
        )

    run, channel = row
    run_read = _to_worker_run_read(run, channel)
    latest_job_ids = _ordered_unique(run_read.started_job_ids or run_read.planned_job_ids)
    completed_job_ids = _ordered_unique(run_read.completed_job_ids)
    failed_job_ids = _ordered_unique(run_read.failed_job_ids)
    latest_jobs = await _download_jobs_for_ids(db=db, job_ids=latest_job_ids)
    completed_job_id_set = set(completed_job_ids)
    failed_job_id_set = set(failed_job_ids)
    completed_jobs = [job for job in latest_jobs if job.id in completed_job_id_set]
    failed_jobs = [job for job in latest_jobs if job.id in failed_job_id_set]
    archived_files = await _media_files_for_jobs(db=db, jobs=completed_jobs)

    return DownloadWorkerRunSummaryRead(
        generated_at=datetime.now(UTC),
        channel_id=run.channel_id,
        channel_title=channel.title if channel else None,
        run=run_read,
        latest_worker_jobs=latest_jobs,
        completed_jobs=completed_jobs,
        failed_jobs=failed_jobs,
        archived_files=archived_files,
    )


def download_worker_summary_export_rows(summary: DownloadWorkerRunSummaryRead) -> list[dict[str, object]]:
    """Flatten a worker run summary into export-friendly audit rows."""
    rows: list[dict[str, object]] = [
        {
            "row_kind": "summary",
            "generated_at": summary.generated_at.isoformat(),
            "channel_id": summary.channel_id,
            "channel_title": summary.channel_title,
            "run_id": summary.run.id if summary.run else None,
            "run_status": summary.run.status if summary.run else None,
            "started_count": summary.run.started_count if summary.run else 0,
            "completed_count": summary.run.completed_count if summary.run else 0,
            "failed_count": summary.run.failed_count if summary.run else 0,
            "planned_job_ids": summary.run.planned_job_ids if summary.run else [],
            "started_job_ids": summary.run.started_job_ids if summary.run else [],
            "completed_job_ids": summary.run.completed_job_ids if summary.run else [],
            "failed_job_ids": summary.run.failed_job_ids if summary.run else [],
        }
    ]
    completed_job_ids = {job.id for job in summary.completed_jobs}
    failed_job_ids = {job.id for job in summary.failed_jobs}
    for job in summary.latest_worker_jobs:
        rows.append(
            {
                "row_kind": "job",
                "generated_at": summary.generated_at.isoformat(),
                "channel_id": job.channel_id,
                "channel_title": job.channel_title,
                "job_id": job.id,
                "video_id": job.video_id,
                "video_external_id": job.video_external_id,
                "video_title": job.video_title,
                "job_status": job.status,
                "run_result": "failed" if job.id in failed_job_ids else "completed" if job.id in completed_job_ids else "planned",
                "progress": job.progress,
                "quality": job.quality,
                "priority": job.priority,
                "archive_path": job.archive_path,
                "error_message": job.error_message,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            }
        )
    for media in summary.archived_files:
        rows.append(
            {
                "row_kind": "media_file",
                "generated_at": summary.generated_at.isoformat(),
                "channel_id": media.channel_id,
                "channel_title": media.channel_title,
                "video_id": media.video_id,
                "video_external_id": media.video_external_id,
                "video_title": media.video_title,
                "media_file_id": media.id,
                "relative_path": media.relative_path,
                "filename": media.filename,
                "size_bytes": media.size_bytes,
                "size_label": media.size_label,
                "container": media.container,
                "video_codec": media.video_codec,
                "audio_codec": media.audio_codec,
                "width": media.width,
                "height": media.height,
                "duration_seconds": media.duration_seconds,
                "created_at": media.created_at.isoformat(),
            }
        )
    return rows


async def stop_running_download_job(*, db: AsyncSession, job_id: int) -> DownloadJobActionResult:
    """Stop an in-process running download job, or cancel a queued one."""
    row = _download_job_query(job_id=job_id)
    result = await db.execute(row)
    found = result.one_or_none()
    if found is None:
        raise DownloadJobNotFoundError(f"Download job {job_id} was not found.")
    job, video, channel = found
    now = datetime.now(UTC)

    if job.status in {"candidate", "queued", "running"}:
        previous_status = job.status
        job.status = "cancelled"
        job.error_message = "Stopped by user" if previous_status == "running" else None
        job.completed_at = now
        job.updated_at = now
        process = _RUNNING_PROCESSES.get(job.id)
        if process is not None and process.returncode is None:
            process.terminate()
        await _commit_worker_state(db)
        await event_bus.publish(
            "download.stop_requested" if previous_status == "running" else "download.cancelled",
            {
                "job_id": job.id,
                "video_id": video.id,
                "video_title": video.title,
                "channel_id": channel.id,
                "channel_title": channel.title,
                "previous_status": previous_status,
            },
        )
    else:
        job.error_message = f"Cannot stop a {job.status} job."
        job.updated_at = now
        await _commit_worker_state(db)

    return DownloadJobActionResult(job=to_download_job(job, video, channel))


def _to_worker_run_read(run: DownloadWorkerRun, channel: Channel | None) -> DownloadWorkerRunRead:
    duration_seconds = None
    if run.completed_at is not None:
        duration_seconds = max(0, round((run.completed_at - run.started_at).total_seconds()))
    return DownloadWorkerRunRead(
        id=run.id,
        channel_id=run.channel_id,
        channel_title=channel.title if channel else None,
        status=run.status,
        dry_run=run.dry_run,
        started_count=run.started_count,
        completed_count=run.completed_count,
        failed_count=run.failed_count,
        planned_job_ids=_run_id_list(run.planned_job_ids),
        started_job_ids=_run_id_list(run.started_job_ids),
        completed_job_ids=_run_id_list(run.completed_job_ids),
        failed_job_ids=_run_id_list(run.failed_job_ids),
        skipped_reason=run.skipped_reason,
        duration_seconds=duration_seconds,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
    )


async def _download_jobs_for_ids(*, db: AsyncSession, job_ids: list[int]) -> list[DownloadJobRead]:
    if not job_ids:
        return []
    id_order = {job_id: index for index, job_id in enumerate(job_ids)}
    rows = (
        await db.execute(
            select(DownloadJob, Video, Channel)
            .join(Video, DownloadJob.video_id == Video.id)
            .join(Channel, Video.channel_id == Channel.id)
            .where(DownloadJob.id.in_(job_ids))
        )
    ).all()
    jobs = [to_download_job(job, video, channel) for job, video, channel in rows]
    return sorted(jobs, key=lambda job: id_order.get(job.id, len(id_order)))


async def _media_files_for_jobs(*, db: AsyncSession, jobs: list[DownloadJobRead]) -> list[DownloadWorkerRunSummaryFile]:
    if not jobs:
        return []
    video_order = {job.video_id: index for index, job in enumerate(jobs)}
    rows = (
        await db.execute(
            select(MediaFile, Video, Channel)
            .join(Video, MediaFile.video_id == Video.id)
            .join(Channel, Video.channel_id == Channel.id)
            .where(MediaFile.video_id.in_(list(video_order)))
            .order_by(MediaFile.created_at.desc())
        )
    ).all()
    files = [_to_worker_summary_file(media=media, video=video, channel=channel) for media, video, channel in rows]
    return sorted(files, key=lambda item: (video_order.get(item.video_id, len(video_order)), item.created_at), reverse=False)


def _to_worker_summary_file(*, media: MediaFile, video: Video, channel: Channel) -> DownloadWorkerRunSummaryFile:
    return DownloadWorkerRunSummaryFile(
        id=media.id,
        video_id=video.id,
        video_external_id=video.external_id,
        video_title=video.title,
        channel_id=channel.id,
        channel_title=channel.title,
        relative_path=media.relative_path,
        filename=media.filename,
        size_bytes=media.size_bytes,
        size_label=_format_bytes(media.size_bytes or 0),
        container=media.container,
        video_codec=media.video_codec,
        audio_codec=media.audio_codec,
        fps=media.fps,
        width=media.width,
        height=media.height,
        duration_seconds=media.duration_seconds,
        info_json_path=media.info_json_path,
        nfo_path=media.nfo_path,
        thumbnail_path=media.thumbnail_path,
        created_at=media.created_at,
    )


def _run_id_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int)]


def _ordered_unique(values: list[int]) -> list[int]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(max(0, value))
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{int(size)} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _queued_download_query(*, channel_id: int | None) -> Select[tuple[DownloadJob, Video, Channel]]:
    query = (
        select(DownloadJob, Video, Channel)
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
        .outerjoin(ChannelPolicy, ChannelPolicy.channel_id == Channel.id)
        .where(DownloadJob.status == "queued")
        .where(or_(ChannelPolicy.id.is_(None), ChannelPolicy.worker_paused.is_(False)))
    )
    if channel_id is not None:
        query = query.where(Channel.id == channel_id)
    return query


def _running_download_query(*, channel_id: int | None) -> Select[tuple[DownloadJob, Video, Channel]]:
    query = (
        select(DownloadJob, Video, Channel)
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
        .where(DownloadJob.status == "running")
    )
    if channel_id is not None:
        query = query.where(Channel.id == channel_id)
    return query


def _download_job_query(*, job_id: int) -> Select[tuple[DownloadJob, Video, Channel]]:
    return (
        select(DownloadJob, Video, Channel)
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
        .where(DownloadJob.id == job_id)
        .limit(1)
    )


def _queued_download_count(*, channel_id: int | None) -> Select[tuple[int]]:
    query = (
        select(func.count(DownloadJob.id))
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
        .where(DownloadJob.status == "queued")
    )
    if channel_id is not None:
        query = query.where(Channel.id == channel_id)
    return query


async def _paused_reason(*, db: AsyncSession, channel_id: int | None) -> str | None:
    if channel_id is None:
        return None
    row = await db.execute(
        select(Channel.title, ChannelPolicy.worker_pause_reason)
        .join(ChannelPolicy, ChannelPolicy.channel_id == Channel.id)
        .where(Channel.id == channel_id)
        .where(ChannelPolicy.worker_paused.is_(True))
        .limit(1)
    )
    result = row.one_or_none()
    if result is None:
        return None
    channel_title, reason = result
    suffix = f" Reason: {reason}" if reason else ""
    return f"Worker is paused for {channel_title}.{suffix}"


def _running_download_count(*, channel_id: int | None) -> Select[tuple[int]]:
    query = (
        select(func.count(DownloadJob.id))
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
        .where(DownloadJob.status == "running")
    )
    if channel_id is not None:
        query = query.where(Channel.id == channel_id)
    return query


def _to_worker_plan_job(*, job: DownloadJob, video: Video, channel: Channel) -> DownloadWorkerPlanJob:
    archive_dir, command = _worker_command(job=job, video=video, channel=channel)
    status_note = (
        f"running at {round(job.progress)}%"
        if job.status == "running"
        else "dry-run plan only; no media transfer was started"
    )
    return DownloadWorkerPlanJob(
        job=to_download_job(job, video, channel),
        archive_dir=archive_dir,
        output_template=OUTPUT_TEMPLATE,
        command_preview=shlex.join(command),
        status_note=status_note,
    )


async def _run_one_job(*, db: AsyncSession, job: DownloadJob, video: Video, channel: Channel) -> bool:
    archive_dir, command = _worker_command(job=job, video=video, channel=channel)
    Path(archive_dir).mkdir(parents=True, exist_ok=True)
    now = datetime.now(UTC)
    job.status = "running"
    job.started_at = now
    job.updated_at = now
    job.progress = 0
    job.attempt_count += 1
    job.error_message = None
    await _commit_worker_state(db)
    await event_bus.publish(
        "download.started",
        {
            "job_id": job.id,
            "video_id": video.id,
            "video_title": video.title,
            "channel_id": channel.id,
            "channel_title": channel.title,
            "archive_dir": archive_dir,
            "quality": job.quality,
        },
    )

    last_line = ""
    process: asyncio.subprocess.Process | None = None
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        _RUNNING_PROCESSES[job.id] = process
        assert process.stdout is not None
        while True:
            raw = await asyncio.wait_for(process.stdout.readline(), timeout=settings.download_worker_timeout_seconds)
            if not raw:
                break
            last_line = raw.decode("utf-8", errors="replace").strip()
            parsed = parse_ytdlp_progress_line(last_line)
            if parsed is not None and parsed.percent is not None:
                job.progress = max(0, min(parsed.percent, 100))
                job.updated_at = datetime.now(UTC)
                await _commit_worker_state(db)
                await event_bus.publish(
                    "download.progress",
                    {
                        "job_id": job.id,
                        "video_id": video.id,
                        "video_title": video.title,
                        "channel_id": channel.id,
                        "channel_title": channel.title,
                        "archive_dir": archive_dir,
                        "quality": job.quality,
                        "percent": job.progress,
                        "eta": parsed.eta,
                        "speed": parsed.speed,
                    },
                )
        return_code = await process.wait()
    except Exception as exc:  # pragma: no cover - requires a real yt-dlp process
        await _terminate_process(process)
        await _refresh_job_state(db, job)
        if job.status == "cancelled":
            job.completed_at = job.completed_at or datetime.now(UTC)
            job.updated_at = datetime.now(UTC)
            await _commit_worker_state(db)
            await event_bus.publish(
                "download.cancelled",
                {
                    "job_id": job.id,
                    "video_id": video.id,
                    "video_title": video.title,
                    "channel_id": channel.id,
                    "channel_title": channel.title,
                    "archive_dir": archive_dir,
                },
            )
            return False
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.now(UTC)
        job.updated_at = job.completed_at
        await _commit_worker_state(db)
        await event_bus.publish(
            "download.failed",
            {
                "job_id": job.id,
                "video_id": video.id,
                "video_title": video.title,
                "channel_id": channel.id,
                "channel_title": channel.title,
                "archive_dir": archive_dir,
                "error": str(exc),
            },
        )
        return False
    finally:
        _RUNNING_PROCESSES.pop(job.id, None)

    job.completed_at = datetime.now(UTC)
    job.updated_at = job.completed_at
    if return_code == 0:
        job.status = "completed"
        job.progress = 100
        await apply_rescan_target(db, settings.download_dir, archive_dir)
        await _commit_worker_state(db)
        await event_bus.publish(
            "download.completed",
            {
                "job_id": job.id,
                "video_id": video.id,
                "video_title": video.title,
                "channel_id": channel.id,
                "channel_title": channel.title,
                "archive_dir": archive_dir,
                "quality": job.quality,
            },
        )
        return True

    await _refresh_job_state(db, job)
    if job.status == "cancelled":
        job.completed_at = job.completed_at or datetime.now(UTC)
        job.updated_at = datetime.now(UTC)
        await _commit_worker_state(db)
        await event_bus.publish(
            "download.cancelled",
            {
                "job_id": job.id,
                "video_id": video.id,
                "video_title": video.title,
                "channel_id": channel.id,
                "channel_title": channel.title,
                "archive_dir": archive_dir,
            },
        )
        return False

    job.status = "failed"
    job.completed_at = datetime.now(UTC)
    job.updated_at = job.completed_at
    job.error_message = last_line or f"yt-dlp exited with code {return_code}"
    await _commit_worker_state(db)
    await event_bus.publish(
        "download.failed",
        {
            "job_id": job.id,
            "video_id": video.id,
            "video_title": video.title,
            "channel_id": channel.id,
            "channel_title": channel.title,
            "archive_dir": archive_dir,
            "error": job.error_message,
        },
    )
    return False


def _worker_command(*, job: DownloadJob, video: Video, channel: Channel) -> tuple[str, list[str]]:
    archive_dir = _archive_dir(channel=channel, video=video)
    return archive_dir, [
        settings.ytdlp_binary,
        "--no-overwrites",
        "--continue",
        "--write-info-json",
        "--write-thumbnail",
        "--write-sub",
        "--sub-langs",
        "ko,en",
        "-P",
        archive_dir,
        "-o",
        OUTPUT_TEMPLATE,
        "-f",
        job.quality,
        f"https://www.youtube.com/watch?v={video.external_id}",
    ]


def _archive_dir(*, channel: Channel, video: Video) -> str:
    path = video_archive_dir(
        settings.download_dir,
        channel_handle=channel.handle,
        channel_id=channel.external_id,
        channel_title=channel.title,
        video_title=video.title,
        video_id=video.external_id,
        published_at=video.published_at,
        upload_date=video.upload_date,
    )
    return path.as_posix()


async def _commit_worker_state(db: AsyncSession) -> None:
    """Make worker state visible to polling clients before long subprocesses finish."""
    await db.flush()
    await db.commit()


async def _refresh_job_state(db: AsyncSession, job: DownloadJob) -> None:
    await db.refresh(job)


async def _terminate_process(process: asyncio.subprocess.Process | None) -> None:
    if process is None or process.returncode is not None:
        return
    process.terminate()
    try:
        await asyncio.wait_for(process.wait(), timeout=5)
    except TimeoutError:
        process.kill()
        await process.wait()
