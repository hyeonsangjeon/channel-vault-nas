"""DB-backed dashboard snapshot builder."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, DownloadJob, MediaFile, SyncJob, Video
from app.schemas.dashboard import (
    ActivityItem,
    ArchiveMetric,
    ChannelNode,
    CoverageSummary,
    DashboardSnapshot,
    FidelitySummary,
    QueueLane,
)


async def build_dashboard_snapshot(db: AsyncSession) -> DashboardSnapshot:
    """Build a live dashboard snapshot from the SQLite index."""
    channel_count = await _scalar_count(db, select(func.count(Channel.id)))
    source_count = await _scalar_count(db, select(func.count(Video.id)))
    archived_count = await _scalar_count(db, select(func.count(func.distinct(MediaFile.video_id))))
    missing_count = max(source_count - archived_count, 0)
    removed_saved = await _scalar_count(db, select(func.coalesce(func.sum(Channel.removed_saved_count), 0)))
    failed_downloads = await _scalar_count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "failed"))
    queued_downloads = await _scalar_count(
        db,
        select(func.count(DownloadJob.id)).where(DownloadJob.status.in_(("candidate", "queued"))),
    )
    active_sync = await _scalar_count(db, select(func.count(SyncJob.id)).where(SyncJob.status == "running"))
    coverage_percent = round((archived_count / source_count) * 100, 1) if source_count else 0.0

    return DashboardSnapshot(
        coverage=CoverageSummary(
            source=source_count,
            archived=archived_count,
            missing=missing_count,
            removed_saved=removed_saved,
            percent=coverage_percent,
        ),
        fidelity=FidelitySummary(
            info_json=await _scalar_count(db, select(func.count(Video.id)).where(Video.info_json_path.is_not(None))),
            thumbnails=await _scalar_count(db, select(func.count(Video.id)).where(Video.thumbnail_url.is_not(None))),
            subtitles=0,
            nfo=0,
        ),
        metrics=[
            ArchiveMetric(
                label="Total Videos",
                value=_format_int(source_count),
                detail=f"{channel_count} registered channels",
                tone="info",
            ),
            ArchiveMetric(
                label="Archive Coverage",
                value=f"{coverage_percent}%",
                detail=f"{_format_int(archived_count)} mirrored locally",
                tone="good" if missing_count == 0 and source_count else "warn",
            ),
            ArchiveMetric(
                label="Queue Candidates",
                value=_format_int(queued_downloads),
                detail="explicit jobs before media transfer",
                tone="active" if queued_downloads else "info",
            ),
            ArchiveMetric(
                label="Failed Jobs",
                value=_format_int(failed_downloads),
                detail="retryable before worker launch",
                tone="bad" if failed_downloads else "good",
            ),
            ArchiveMetric(
                label="Active Sync",
                value=_format_int(active_sync),
                detail="metadata refresh jobs",
                tone="active" if active_sync else "protected",
            ),
        ],
        channels=await _channel_nodes(db),
        links=[],
        queue=await _queue_lanes(db),
        activity=await _activity(db),
    )


async def _channel_nodes(db: AsyncSession) -> list[ChannelNode]:
    result = await db.execute(select(Channel).order_by(Channel.created_at.desc()).limit(12))
    nodes: list[ChannelNode] = []
    for index, channel in enumerate(result.scalars().all(), start=1):
        failed_jobs = await _scalar_count(
            db,
            select(func.count(DownloadJob.id))
            .join(Video, DownloadJob.video_id == Video.id)
            .where(Video.channel_id == channel.id)
            .where(DownloadJob.status == "failed"),
        )
        total = max(channel.source_video_count, 1)
        health = max(30, round(((total - channel.missing_count - failed_jobs) / total) * 100))
        storage_bytes = await _channel_storage_bytes(db, channel.id)
        nodes.append(
            ChannelNode(
                id=f"c{channel.id}",
                title=channel.title,
                health=health,
                storage_gb=round(max(storage_bytes / 1024**3, 0.1), 1),
                new_videos=channel.missing_count,
                failed_jobs=failed_jobs,
                group=channel.handle or f"group-{index}",
            )
        )
    return nodes


async def _channel_storage_bytes(db: AsyncSession, channel_id: int) -> int:
    media_bytes = await db.scalar(
        select(func.coalesce(func.sum(MediaFile.size_bytes), 0))
        .join(Video, MediaFile.video_id == Video.id)
        .where(Video.channel_id == channel_id)
    )
    if media_bytes:
        return int(media_bytes)

    queue_bytes = await db.scalar(
        select(func.coalesce(func.sum(DownloadJob.estimated_bytes), 0))
        .join(Video, DownloadJob.video_id == Video.id)
        .where(Video.channel_id == channel_id)
        .where(DownloadJob.status.in_(("candidate", "queued", "running")))
    )
    if queue_bytes:
        return int(queue_bytes)

    video_count = await _scalar_count(db, select(func.count(Video.id)).where(Video.channel_id == channel_id))
    return video_count * 750_000_000


async def _queue_lanes(db: AsyncSession) -> list[QueueLane]:
    return [
        QueueLane(
            label="Sync",
            count=await _scalar_count(db, select(func.count(SyncJob.id)).where(SyncJob.status == "running")),
            status="active",
        ),
        QueueLane(
            label="Candidates",
            count=await _scalar_count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "candidate")),
            status="waiting",
        ),
        QueueLane(
            label="Queued",
            count=await _scalar_count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "queued")),
            status="active",
        ),
        QueueLane(
            label="Running",
            count=await _scalar_count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "running")),
            status="active",
        ),
        QueueLane(
            label="Failed",
            count=await _scalar_count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "failed")),
            status="blocked",
        ),
    ]


async def _activity(db: AsyncSession) -> list[ActivityItem]:
    download_rows = await db.execute(
        select(DownloadJob, Video, Channel)
        .join(Video, DownloadJob.video_id == Video.id)
        .join(Channel, Video.channel_id == Channel.id)
        .order_by(DownloadJob.updated_at.desc())
        .limit(4)
    )
    items = [
        ActivityItem(
            title=video.title,
            channel=channel.title,
            status=_activity_status(job.status),
            time=_relative(job.updated_at),
        )
        for job, video, channel in download_rows.all()
    ]
    if items:
        return items

    sync_rows = await db.execute(
        select(SyncJob, Channel)
        .join(Channel, SyncJob.channel_id == Channel.id)
        .order_by(SyncJob.created_at.desc())
        .limit(4)
    )
    return [
        ActivityItem(
            title=f"Sync {job.status}",
            channel=channel.title,
            status="discovered" if job.status == "completed" else "failed",
            time=_relative(job.completed_at or job.started_at),
        )
        for job, channel in sync_rows.all()
    ]


async def _scalar_count(db: AsyncSession, statement) -> int:
    value = await db.scalar(statement)
    return int(value or 0)


def _format_int(value: int) -> str:
    return f"{value:,}"


def _activity_status(status: str) -> str:
    if status in {"queued", "candidate"}:
        return "discovered"
    if status == "running":
        return "downloading"
    if status == "completed":
        return "archived"
    return "failed"


def _relative(value: datetime | None) -> str:
    if value is None:
        return "just now"
    delta = datetime.now(UTC) - value.replace(tzinfo=UTC)
    minutes = max(0, round(delta.total_seconds() / 60))
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes} min ago"
    hours = round(minutes / 60)
    return f"{hours} hr ago"
