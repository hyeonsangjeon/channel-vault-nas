"""Channel metadata sync and detail services."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, MediaFile, SyncJob, Video
from app.schemas.jobs import (
    ChannelDetail,
    ChannelSettingsUpdate,
    ChannelSyncRequest,
    ChannelSyncResult,
    ChannelVideoRead,
    SyncJobRead,
)
from app.schemas.source import ChannelProbeRequest
from app.services.channel_registration import apply_probe_to_channel
from app.services.event_bus import event_bus
from app.services.ytdlp_probe import ChannelProbeError, probe_channel_source


class ChannelNotFoundError(LookupError):
    """Raised when a channel id does not exist."""


async def get_channel_detail(db: AsyncSession, channel_id: int) -> ChannelDetail | None:
    """Return one registered channel detail row."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None
    latest_auto_sync = await db.scalar(
        select(SyncJob)
        .where(SyncJob.channel_id == channel_id)
        .where(SyncJob.trigger == "scheduler")
        .order_by(SyncJob.created_at.desc(), SyncJob.id.desc())
        .limit(1)
    )
    return to_channel_detail(channel, latest_auto_sync=latest_auto_sync)


async def update_channel_settings(
    *,
    db: AsyncSession,
    channel_id: int,
    payload: ChannelSettingsUpdate,
) -> ChannelDetail | None:
    """Patch editable channel scheduling fields."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "sync_interval_minutes" in updates:
        channel.sync_interval_minutes = updates["sync_interval_minutes"]
    channel.updated_at = datetime.now(UTC)
    await db.flush()
    next_sync_due_at = _next_sync_due_at(channel)
    await event_bus.publish(
        "channel.settings.updated",
        {
            "channel_id": channel.id,
            "channel_title": channel.title,
            "sync_interval_minutes": channel.sync_interval_minutes,
            "next_sync_due_at": next_sync_due_at.isoformat() if next_sync_due_at else None,
        },
    )
    return await get_channel_detail(db, channel_id)


async def list_channel_videos(db: AsyncSession, channel_id: int) -> list[ChannelVideoRead] | None:
    """Return source videos for one channel ordered as a timeline."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None

    media_count = (
        select(func.count(MediaFile.id))
        .where(MediaFile.video_id == Video.id)
        .correlate(Video)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Video, media_count.label("media_count"))
        .where(Video.channel_id == channel_id)
        .order_by(Video.published_at.desc(), Video.discovered_at.desc())
    )
    return [to_channel_video(video, media_total) for video, media_total in result.all()]


async def run_channel_sync(
    *,
    db: AsyncSession,
    channel_id: int,
    payload: ChannelSyncRequest,
    trigger: str = "manual",
) -> ChannelSyncResult:
    """Synchronously run one channel metadata refresh and record its job row."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        raise ChannelNotFoundError(f"Channel {channel_id} was not found.")

    now = datetime.now(UTC)
    job = SyncJob(channel_id=channel.id, trigger=trigger, status="running", started_at=now, created_at=now)
    db.add(job)
    await db.flush()
    await event_bus.publish(
        "sync.started",
        {"job_id": job.id, "channel_id": channel.id, "channel_title": channel.title},
    )

    try:
        probe = await probe_channel_source(
            ChannelProbeRequest(
                value=channel.source_url,
                max_quality=payload.max_quality,
                audio_only=payload.audio_only,
                subtitles_enabled=payload.subtitles_enabled,
            )
        )
        summary = await apply_probe_to_channel(db=db, channel=channel, probe=probe)
        job.status = "completed"
        job.completed_at = datetime.now(UTC)
        job.videos_seen = summary.videos_seen
        job.videos_created = summary.videos_created
        await event_bus.publish(
            "sync.completed",
            {
                "job_id": job.id,
                "channel_id": channel.id,
                "channel_title": channel.title,
                "videos_seen": summary.videos_seen,
                "videos_created": summary.videos_created,
            },
        )
    except ChannelProbeError as exc:
        job.status = "failed"
        job.completed_at = datetime.now(UTC)
        job.error_message = str(exc)
        await event_bus.publish(
            "sync.failed",
            {
                "job_id": job.id,
                "channel_id": channel.id,
                "channel_title": channel.title,
                "error_message": job.error_message,
            },
        )

    return ChannelSyncResult(
        job=to_sync_job(job, channel),
        channel=_to_registered_channel(channel),
        videos_seen=job.videos_seen,
        videos_created=job.videos_created,
        candidates_created=job.candidates_created,
    )


async def list_sync_jobs(db: AsyncSession, limit: int = 50) -> list[SyncJobRead]:
    """Return recent sync jobs."""
    result = await db.execute(_sync_job_query().order_by(SyncJob.created_at.desc()).limit(limit))
    return [to_sync_job(job, channel) for job, channel in result.all()]


def to_channel_detail(channel: Channel, *, latest_auto_sync: SyncJob | None = None) -> ChannelDetail:
    """Convert an ORM channel into the detail API shape."""
    return ChannelDetail(
        id=channel.id,
        title=channel.title,
        external_id=channel.external_id,
        handle=channel.handle,
        source_url=channel.source_url,
        description=channel.description,
        thumbnail_url=channel.thumbnail_url,
        status=channel.status,
        video_count=channel.source_video_count,
        archived_count=channel.archived_count,
        missing_count=channel.missing_count,
        removed_saved_count=channel.removed_saved_count,
        last_synced_at=channel.last_synced_at,
        sync_interval_minutes=channel.sync_interval_minutes,
        next_sync_due_at=_next_sync_due_at(channel),
        last_auto_synced_at=latest_auto_sync.completed_at if latest_auto_sync else None,
        last_auto_sync_status=latest_auto_sync.status if latest_auto_sync else None,
        last_auto_candidates_created=latest_auto_sync.candidates_created if latest_auto_sync else 0,
        first_video_published_at=channel.first_video_published_at,
        latest_video_published_at=channel.latest_video_published_at,
        avg_upload_interval_days=channel.avg_upload_interval_days,
        typical_upload_dow=channel.typical_upload_dow,
        typical_upload_hour=channel.typical_upload_hour,
        created_at=channel.created_at,
        updated_at=channel.updated_at,
    )


def to_channel_video(video: Video, media_count: int | None) -> ChannelVideoRead:
    """Convert an ORM video into the timeline API shape."""
    return ChannelVideoRead(
        id=video.id,
        channel_id=video.channel_id,
        external_id=video.external_id,
        title=video.title,
        url=f"https://www.youtube.com/watch?v={video.external_id}",
        published_at=video.published_at,
        upload_date=video.upload_date,
        duration_seconds=video.duration_seconds,
        thumbnail_url=video.thumbnail_url,
        source_state=video.source_state,
        archive_state="archived" if media_count else "missing",
        info_json_path=video.info_json_path,
        discovered_at=video.discovered_at,
    )


def to_sync_job(job: SyncJob, channel: Channel) -> SyncJobRead:
    """Convert an ORM sync job into API shape."""
    return SyncJobRead(
        id=job.id,
        channel_id=job.channel_id,
        channel_title=channel.title,
        trigger=job.trigger,
        status=job.status,
        started_at=job.started_at,
        completed_at=job.completed_at,
        videos_seen=job.videos_seen,
        videos_created=job.videos_created,
        candidates_created=job.candidates_created,
        error_message=job.error_message,
        created_at=job.created_at,
    )


def _sync_job_query() -> Select[tuple[SyncJob, Channel]]:
    return select(SyncJob, Channel).join(Channel, SyncJob.channel_id == Channel.id)


def _to_registered_channel(channel: Channel):
    from app.services.channel_registration import _to_registered_channel as convert

    return convert(channel)


def _next_sync_due_at(channel: Channel) -> datetime | None:
    if channel.status != "active":
        return None
    interval = max(1, channel.sync_interval_minutes)
    if channel.last_synced_at is None:
        return datetime.now(UTC)
    base = channel.last_synced_at
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    return base + timedelta(minutes=interval)
