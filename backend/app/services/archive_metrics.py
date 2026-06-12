"""DB-backed archive completeness and cadence metrics."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, MediaFile, Video
from app.schemas.archive import (
    CadenceBucket,
    ChannelCadence,
    ChannelCoverage,
    MissingVideo,
    RemovedVideo,
)
from app.services.archive_coverage import archived_video_ids_on_disk, resolve_archive_root
from app.services.library_index import media_path_on_disk

REMOVED_SOURCE_STATES = {"removed", "blocked", "deleted", "private"}
DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


async def build_channel_coverage_from_db(
    db: AsyncSession,
    channel_id: int,
    *,
    download_dir: str | Path | None = None,
) -> ChannelCoverage | None:
    """Return completeness from media files that actually exist on disk.

    With a configured ``download_dir`` the archived/missing/removed counts trust
    files on disk (matching the Library). Without one they fall back to trusting
    the DB index so callers wanting indexed counts keep prior behavior.
    """
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None
    root = resolve_archive_root(download_dir)
    archived_ids = await archived_video_ids_on_disk(db=db, root=root, channel_id=channel_id)
    rows = (
        await db.execute(select(Video.id, Video.source_state).where(Video.channel_id == channel_id))
    ).all()
    source_count = len(rows)
    archived_count = 0
    missing_count = 0
    removed_saved_count = 0
    for video_id, source_state in rows:
        if video_id in archived_ids:
            archived_count += 1
            if source_state in REMOVED_SOURCE_STATES:
                removed_saved_count += 1
        elif source_state not in REMOVED_SOURCE_STATES:
            missing_count += 1
    percent = round((archived_count / source_count) * 100, 1) if source_count else 0.0
    return ChannelCoverage(
        channel_id=str(channel.id),
        source=source_count,
        archived=archived_count,
        missing=missing_count,
        removed_saved=removed_saved_count,
        percent=percent,
        updated_at=channel.updated_at,
    )


async def list_missing_videos_from_db(
    db: AsyncSession,
    channel_id: int,
    *,
    download_dir: str | Path | None = None,
) -> list[MissingVideo] | None:
    """Return videos that still need a local media file on disk."""
    if await db.get(Channel, channel_id) is None:
        return None
    root = resolve_archive_root(download_dir)
    archived_ids = await archived_video_ids_on_disk(db=db, root=root, channel_id=channel_id)
    rows = (
        await db.execute(
            select(Video)
            .where(
                Video.channel_id == channel_id,
                Video.source_state.not_in(REMOVED_SOURCE_STATES),
            )
            .order_by(Video.published_at.desc().nullslast(), Video.discovered_at.desc())
        )
    ).scalars()
    return [
        MissingVideo(
            id=video.external_id,
            title=video.title,
            published_at=_video_timestamp(video),
            source_state=video.source_state,
            reason="media file is not present on disk under the archive root",
        )
        for video in rows
        if video.id not in archived_ids
    ]


async def list_removed_saved_videos_from_db(
    db: AsyncSession,
    channel_id: int,
    *,
    download_dir: str | Path | None = None,
) -> list[RemovedVideo] | None:
    """Return removed/private source videos whose local media still exists on disk."""
    if await db.get(Channel, channel_id) is None:
        return None
    root = resolve_archive_root(download_dir)
    rows = (
        await db.execute(
            select(Video, MediaFile)
            .join(MediaFile, MediaFile.video_id == Video.id)
            .where(Video.channel_id == channel_id, Video.source_state.in_(REMOVED_SOURCE_STATES))
            .order_by(Video.removed_detected_at.desc().nullslast(), Video.published_at.desc().nullslast())
        )
    ).all()
    seen: set[int] = set()
    removed: list[RemovedVideo] = []
    for video, media in rows:
        if video.id in seen:
            continue
        if not media_path_on_disk(root=root, relative_path=media.relative_path):
            continue
        seen.add(video.id)
        removed.append(
            RemovedVideo(
                id=video.external_id,
                title=video.title,
                published_at=_video_timestamp(video),
                removed_detected_at=video.removed_detected_at or video.updated_at,
                local_relative_path=media.relative_path,
            )
        )
    return removed


async def build_channel_cadence_from_db(db: AsyncSession, channel_id: int) -> ChannelCadence | None:
    """Return upload rhythm from indexed video publish dates."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None
    videos = (
        await db.execute(
            select(Video)
            .where(Video.channel_id == channel_id, Video.published_at.is_not(None))
            .order_by(Video.published_at.asc())
        )
    ).scalars().all()
    timestamps = [_video_timestamp(video) for video in videos]
    if not timestamps:
        fallback = _ensure_tz(channel.created_at)
        timestamps = [fallback]
    avg_days = _average_interval_days(timestamps)
    latest = max(timestamps)
    first = min(timestamps)
    typical_dow = _most_common([item.weekday() for item in timestamps], channel.typical_upload_dow or 0)
    typical_hour = _most_common([item.hour for item in timestamps], channel.typical_upload_hour or 0)
    buckets = [_cadence_bucket(day, timestamps) for day in range(7)]
    return ChannelCadence(
        channel_id=str(channel.id),
        first_video_published_at=first,
        latest_video_published_at=latest,
        avg_upload_interval_days=avg_days,
        typical_upload_dow=typical_dow,
        typical_upload_hour=typical_hour,
        next_expected_at=latest + timedelta(days=avg_days),
        buckets=buckets,
    )


def _video_timestamp(video: Video) -> datetime:
    return _ensure_tz(video.published_at or video.discovered_at or video.created_at)


def _ensure_tz(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _average_interval_days(timestamps: list[datetime]) -> float:
    if len(timestamps) < 2:
        return 0.0
    deltas = [
        (newer - older).total_seconds() / 86_400
        for older, newer in zip(timestamps, timestamps[1:], strict=False)
    ]
    return round(sum(deltas) / len(deltas), 2)


def _most_common(values: list[int], fallback: int) -> int:
    if not values:
        return fallback
    return Counter(values).most_common(1)[0][0]


def _cadence_bucket(day: int, timestamps: list[datetime]) -> CadenceBucket:
    day_items = [item for item in timestamps if item.weekday() == day]
    return CadenceBucket(
        dow=day,
        label=DAY_LABELS[day],
        count=len(day_items),
        typical_hour=_most_common([item.hour for item in day_items], 0),
    )
