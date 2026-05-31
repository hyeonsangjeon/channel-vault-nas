"""Download queue skeleton services."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import PurePosixPath

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.archive import Channel, DownloadJob, MediaFile, Video
from app.schemas.jobs import (
    DownloadCandidateResult,
    DownloadJobActionResult,
    DownloadJobBulkRequest,
    DownloadJobBulkResult,
    DownloadJobRead,
    QueuePreflightPlan,
    VideoDownloadResult,
)
from app.services.archive_paths import video_archive_dir
from app.services.channel_registration import _to_registered_channel
from app.services.event_bus import event_bus

ACTIVE_DOWNLOAD_STATUSES = ("candidate", "queued", "running")
RETRYABLE_DOWNLOAD_STATUSES = ("candidate", "queued", "failed", "cancelled")


class VideoNotFoundError(LookupError):
    """Raised when a video id does not exist."""


class DownloadJobNotFoundError(LookupError):
    """Raised when a download job id does not exist."""


async def create_channel_download_candidates(
    *,
    db: AsyncSession,
    channel_id: int,
    quality: str,
    limit: int,
) -> DownloadCandidateResult | None:
    """Create candidate queue rows for missing videos without starting downloads."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None

    media_exists = select(MediaFile.id).where(MediaFile.video_id == Video.id).exists()
    job_exists = (
        select(DownloadJob.id)
        .where(
            DownloadJob.video_id == Video.id,
            DownloadJob.status.in_(ACTIVE_DOWNLOAD_STATUSES),
        )
        .exists()
    )
    result = await db.execute(
        select(Video)
        .where(Video.channel_id == channel_id)
        .where(~media_exists)
        .where(~job_exists)
        .order_by(Video.published_at.desc(), Video.discovered_at.desc())
        .limit(limit)
    )
    videos = result.scalars().all()

    jobs: list[DownloadJob] = []
    now = datetime.now(UTC)
    for video in videos:
        job = DownloadJob(
            video_id=video.id,
            status="candidate",
            progress=0,
            quality=quality,
            priority=50,
            preflight_status="unchecked",
            estimated_bytes=_estimate_job_bytes(quality),
            created_at=now,
            updated_at=now,
        )
        db.add(job)
        jobs.append(job)

    if jobs:
        await db.flush()
        await event_bus.publish(
            "download.candidates",
            {
                "channel_id": channel.id,
                "channel_title": channel.title,
                "count": len(jobs),
                "quality": quality,
            },
        )

    all_jobs = await list_download_jobs(db=db, channel_id=channel_id)
    return DownloadCandidateResult(
        channel=_to_registered_channel(channel),
        candidates_created=len(jobs),
        total_candidates=sum(1 for job in all_jobs if job.status == "candidate"),
        jobs=all_jobs,
    )


async def enqueue_video_download(
    *,
    db: AsyncSession,
    video_id: int,
    quality: str,
) -> VideoDownloadResult:
    """Queue one video explicitly; no media worker runs in this MVP."""
    row = await _video_channel_row(db, video_id)
    if row is None:
        raise VideoNotFoundError(f"Video {video_id} was not found.")
    video, channel = row

    result = await db.execute(
        select(DownloadJob)
        .where(DownloadJob.video_id == video_id)
        .where(DownloadJob.status.in_(ACTIVE_DOWNLOAD_STATUSES))
        .order_by(DownloadJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if job is None:
        job = DownloadJob(
            video_id=video.id,
            status="queued",
            progress=0,
            quality=quality,
            priority=90,
            preflight_status="unchecked",
            estimated_bytes=_estimate_job_bytes(quality),
            created_at=now,
            updated_at=now,
        )
        db.add(job)
        await db.flush()
    else:
        job.status = "queued"
        job.quality = quality
        job.priority = max(job.priority, 90)
        job.preflight_status = "unchecked"
        job.estimated_bytes = _estimate_job_bytes(quality)
        job.updated_at = now

    await event_bus.publish(
        "download.queued",
        {
            "job_id": job.id,
            "video_id": video.id,
            "video_title": video.title,
            "channel_id": channel.id,
            "channel_title": channel.title,
            "quality": quality,
        },
    )
    return VideoDownloadResult(job=to_download_job(job, video, channel))


async def retry_download_job(
    *,
    db: AsyncSession,
    job_id: int,
) -> DownloadJobActionResult:
    """Put a candidate/failed/cancelled job back into queued state."""
    row = await _download_job_row(db, job_id)
    if row is None:
        raise DownloadJobNotFoundError(f"Download job {job_id} was not found.")
    job, video, channel = row
    if job.status not in RETRYABLE_DOWNLOAD_STATUSES:
        job.error_message = f"Cannot retry a {job.status} job."
    else:
        job.status = "queued"
        job.error_message = None
        job.attempt_count += 1
        job.priority = max(job.priority, 70)
        job.preflight_status = "unchecked"
        job.updated_at = datetime.now(UTC)
    await event_bus.publish(
        "download.queued",
        {
            "job_id": job.id,
            "video_id": video.id,
            "video_title": video.title,
            "channel_id": channel.id,
            "channel_title": channel.title,
            "quality": job.quality,
            "attempt_count": job.attempt_count,
        },
    )
    return DownloadJobActionResult(job=to_download_job(job, video, channel))


async def bulk_update_download_jobs(
    *,
    db: AsyncSession,
    payload: DownloadJobBulkRequest,
) -> DownloadJobBulkResult:
    """Apply one metadata-only action to several download jobs."""
    rows = await _download_job_rows(db, list(dict.fromkeys(payload.job_ids)))
    now = datetime.now(UTC)
    updated = 0
    for job, _video, _channel in rows:
        if payload.quality is not None:
            job.quality = payload.quality
            job.estimated_bytes = _estimate_job_bytes(payload.quality)
        if payload.action == "queue" and job.status in RETRYABLE_DOWNLOAD_STATUSES:
            job.status = "queued"
            job.priority = payload.priority if payload.priority is not None else max(job.priority, 70)
            job.preflight_status = "unchecked"
            job.error_message = None
            updated += 1
        elif payload.action == "cancel" and job.status in {"candidate", "queued"}:
            job.status = "cancelled"
            job.error_message = None
            updated += 1
        elif payload.action == "prioritize" and job.status in ACTIVE_DOWNLOAD_STATUSES:
            job.priority = payload.priority if payload.priority is not None else 90
            updated += 1
        elif payload.action == "retry" and job.status in RETRYABLE_DOWNLOAD_STATUSES:
            job.status = "queued"
            job.attempt_count += 1
            job.priority = payload.priority if payload.priority is not None else max(job.priority, 70)
            job.preflight_status = "unchecked"
            job.error_message = None
            updated += 1
        job.updated_at = now

    if updated:
        await event_bus.publish(
            "download.bulk",
            {"action": payload.action, "updated": updated, "job_ids": [job.id for job, _video, _channel in rows]},
        )
    return DownloadJobBulkResult(updated=updated, jobs=[to_download_job(job, video, channel) for job, video, channel in rows])


async def build_queue_preflight_plan(
    *,
    db: AsyncSession,
    channel_id: int | None = None,
    limit: int = 100,
) -> QueuePreflightPlan:
    """Return a launch checklist for candidate and queued jobs without downloading media."""
    jobs = await list_download_jobs(db=db, channel_id=channel_id, limit=limit)
    launchable = [job for job in jobs if job.status in {"candidate", "queued"}]
    candidate_count = sum(1 for job in launchable if job.status == "candidate")
    queued_count = sum(1 for job in launchable if job.status == "queued")
    estimated_bytes = sum(job.estimated_bytes or _estimate_job_bytes(job.quality) for job in launchable)
    sorted_launchable = sorted(launchable, key=lambda item: (-item.priority, item.created_at))
    review_job_ids = set(_preflight_review_job_ids(sorted_launchable))
    ready_job_ids = [job.id for job in sorted_launchable if job.id not in review_job_ids]
    sorted_review_job_ids = [job.id for job in sorted_launchable if job.id in review_job_ids]
    warnings = _preflight_warnings(launchable)
    command_preview = _command_preview(launchable[:3])

    if launchable:
        now = datetime.now(UTC)
        rows = await _download_job_rows(db, [job.id for job in launchable])
        for job, _video, _channel in rows:
            job.preflight_status = "review" if job.id in review_job_ids else "ready"
            job.preflight_checked_at = now
            job.estimated_bytes = job.estimated_bytes or _estimate_job_bytes(job.quality)
        await event_bus.publish(
            "download.preflight",
            {
                "channel_id": channel_id,
                "job_count": len(launchable),
                "estimated_label": _bytes_label(estimated_bytes),
                "warning_count": len(warnings),
            },
        )
        await db.flush()
        jobs = await list_download_jobs(db=db, channel_id=channel_id, limit=limit)

    return QueuePreflightPlan(
        channel_id=channel_id,
        job_count=len(launchable),
        candidate_count=candidate_count,
        queued_count=queued_count,
        estimated_bytes=estimated_bytes,
        estimated_label=_bytes_label(estimated_bytes),
        ready_job_ids=ready_job_ids,
        review_job_ids=sorted_review_job_ids,
        warnings=warnings,
        command_preview=command_preview,
        jobs=jobs,
    )


async def cancel_download_job(
    *,
    db: AsyncSession,
    job_id: int,
) -> DownloadJobActionResult:
    """Cancel a candidate or queued job before a media worker starts."""
    row = await _download_job_row(db, job_id)
    if row is None:
        raise DownloadJobNotFoundError(f"Download job {job_id} was not found.")
    job, video, channel = row
    if job.status in {"candidate", "queued"}:
        job.status = "cancelled"
        job.error_message = None
        job.updated_at = datetime.now(UTC)
        await event_bus.publish(
            "download.cancelled",
            {
                "job_id": job.id,
                "video_id": video.id,
                "video_title": video.title,
                "channel_id": channel.id,
                "channel_title": channel.title,
            },
        )
    return DownloadJobActionResult(job=to_download_job(job, video, channel))


async def list_download_jobs(
    *,
    db: AsyncSession,
    channel_id: int | None = None,
    status: str | None = None,
    preflight_status: str | None = None,
    limit: int = 100,
) -> list[DownloadJobRead]:
    """Return download queue rows with channel and video context."""
    query = _download_job_query()
    if channel_id is not None:
        query = query.where(Channel.id == channel_id)
    if status:
        query = query.where(DownloadJob.status == status)
    if preflight_status:
        query = query.where(DownloadJob.preflight_status == preflight_status)
    result = await db.execute(query.order_by(DownloadJob.created_at.desc()).limit(max(1, min(limit, 200))))
    return [to_download_job(job, video, channel) for job, video, channel in result.all()]


def to_download_job(job: DownloadJob, video: Video, channel: Channel) -> DownloadJobRead:
    """Convert a queue row into API shape."""
    return DownloadJobRead(
        id=job.id,
        video_id=job.video_id,
        video_external_id=video.external_id,
        video_title=video.title,
        channel_id=channel.id,
        channel_title=channel.title,
        status=job.status,
        progress=job.progress,
        quality=job.quality,
        priority=job.priority,
        preflight_status=job.preflight_status,
        estimated_bytes=job.estimated_bytes,
        preflight_checked_at=job.preflight_checked_at,
        error_message=job.error_message,
        attempt_count=job.attempt_count,
        archive_path=_archive_folder_path(video=video, channel=channel),
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


async def _video_channel_row(db: AsyncSession, video_id: int) -> tuple[Video, Channel] | None:
    result = await db.execute(
        select(Video, Channel).join(Channel, Video.channel_id == Channel.id).where(Video.id == video_id)
    )
    row = result.one_or_none()
    if row is None:
        return None
    return row[0], row[1]


async def _download_job_row(db: AsyncSession, job_id: int) -> tuple[DownloadJob, Video, Channel] | None:
    result = await db.execute(_download_job_query().where(DownloadJob.id == job_id))
    row = result.one_or_none()
    if row is None:
        return None
    return row[0], row[1], row[2]


async def _download_job_rows(db: AsyncSession, job_ids: list[int]) -> list[tuple[DownloadJob, Video, Channel]]:
    result = await db.execute(_download_job_query().where(DownloadJob.id.in_(job_ids)))
    return [(job, video, channel) for job, video, channel in result.all()]


def _archive_folder_path(*, video: Video, channel: Channel) -> str:
    if video.info_json_path:
        return PurePosixPath(video.info_json_path).parent.as_posix()
    return _planned_archive_path(video=video, channel=channel)


def _planned_archive_path(*, video: Video, channel: Channel) -> str:
    return video_archive_dir(
        settings.download_dir,
        channel_handle=channel.handle,
        channel_id=channel.external_id,
        channel_title=channel.title,
        video_title=video.title,
        video_id=video.external_id,
        published_at=video.published_at,
        upload_date=video.upload_date,
    ).as_posix()


def _download_job_query() -> Select[tuple[DownloadJob, Video, Channel]]:
    return (
        select(DownloadJob, Video, Channel)
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
    )


def _estimate_job_bytes(quality: str) -> int:
    if quality == "best":
        return 1_200_000_000
    if quality == "720p":
        return 420_000_000
    if quality == "audio":
        return 80_000_000
    return 750_000_000


def _bytes_label(value: int) -> str:
    if value >= 1024**4:
        return f"{value / 1024**4:.1f} TB"
    if value >= 1024**3:
        return f"{value / 1024**3:.1f} GB"
    return f"{value / 1024**2:.0f} MB"


def _preflight_warnings(jobs: list[DownloadJobRead]) -> list[str]:
    warnings: list[str] = []
    if not jobs:
        warnings.append("No candidate or queued jobs are ready.")
    if any(job.quality == "best" for job in jobs):
        warnings.append("Some jobs use best quality and may require more storage.")
    if len(jobs) > 50:
        warnings.append("Large queue batches should be reviewed before launch.")
    return warnings


def _preflight_review_job_ids(jobs: list[DownloadJobRead]) -> list[int]:
    if len(jobs) > 50:
        return [job.id for job in jobs]
    return [job.id for job in jobs if job.quality == "best"]


def _command_preview(jobs: list[DownloadJobRead]) -> list[str]:
    return [
        (
            "yt-dlp --no-overwrites --write-info-json --write-thumbnail "
            f"-f {job.quality} https://www.youtube.com/watch?v={job.video_external_id}"
        )
        for job in jobs
    ]
