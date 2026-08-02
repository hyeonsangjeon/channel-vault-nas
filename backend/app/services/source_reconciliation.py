"""Detect uploads that have vanished from a channel's public source listing.

Channel Vault treats the filesystem as the source of truth, so when a video
disappears from a channel's listing we keep the local media and record the
source as removed. That turns "this video is gone from YouTube" into a
first-class, reviewable *preservation* signal ("you hold the last copy")
instead of silent index drift.

The detection is deliberately conservative so an outage or a truncated probe
never mass-flags healthy videos:

* An empty probe result is never treated as "everything was removed".
* The flat-playlist probe is capped at ``channel_probe_video_limit`` newest
  uploads, so for channels larger than the cap only videos inside the covered
  recency window (newer than the oldest returned upload) are judged. Older
  uploads beyond the window are left untouched because their absence is
  expected, not evidence of removal.
* A newly-absent upload is only confirmed removed once it has been unseen for
  at least ``preservation_confirm_hours`` (default 24h), which survives
  transient single-sync gaps. Until then it is merely *suspected*.
* An upload that reappears in a later listing is resurrected back to available.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.archive import MediaFile, Video
from app.schemas.source import ChannelProbeResult

REMOVED_SOURCE_STATES = {"removed", "blocked", "deleted", "private"}
AVAILABLE_STATE = "available"
REMOVED_STATE = "removed"


@dataclass(slots=True)
class PresenceReconcileSummary:
    """Outcome of one source-presence reconciliation pass."""

    seen: int
    newly_removed: int
    suspected: int
    resurrected: int
    total_removed: int


async def reconcile_source_presence(
    *,
    db: AsyncSession,
    channel_id: int,
    probe: ChannelProbeResult,
    now: datetime | None = None,
    confirm_after: timedelta | None = None,
) -> PresenceReconcileSummary:
    """Transition source_state for videos absent from the latest source listing.

    Must run *after* ``upsert_probe_videos`` in the same sync so that videos
    seen this pass already carry a refreshed ``last_seen_in_source_at``.
    """
    now = _ensure_tz(now) or datetime.now(UTC)
    if confirm_after is None:
        confirm_after = timedelta(hours=max(0, settings.preservation_confirm_hours))

    rows = (await db.execute(select(Video).where(Video.channel_id == channel_id))).scalars().all()

    seen_ids = {preview.external_id for preview in probe.videos}
    returned = len(probe.videos)
    total = max(probe.video_count, returned)

    # An empty probe is almost always an outage or transient failure. Never let
    # it wipe the whole channel to "removed"; just report current totals.
    if returned == 0:
        total_removed = sum(1 for video in rows if video.source_state in REMOVED_SOURCE_STATES)
        return PresenceReconcileSummary(0, 0, 0, 0, total_removed)

    listing_complete = returned >= total
    covered_floor: datetime | None = None
    if not listing_complete:
        floors = [_ensure_tz(preview.published_at) for preview in probe.videos if preview.published_at is not None]
        covered_floor = min(floors) if floors else None

    newly_removed = 0
    suspected = 0
    resurrected = 0
    for video in rows:
        if video.external_id in seen_ids:
            # Seen this pass (upsert refreshed it). Resurrect a previously
            # removed upload that has reappeared at the source, and clear any
            # stale removal marker left on a video that is available again.
            if video.source_state in REMOVED_SOURCE_STATES or video.removed_detected_at is not None:
                video.source_state = AVAILABLE_STATE
                video.removed_detected_at = None
                video.last_seen_in_source_at = now
                video.updated_at = now
                resurrected += 1
            continue

        if video.source_state in REMOVED_SOURCE_STATES:
            continue  # already recorded as gone

        if not _within_covered_window(
            video=video, listing_complete=listing_complete, covered_floor=covered_floor
        ):
            continue

        last_seen = (
            _ensure_tz(video.last_seen_in_source_at)
            or _ensure_tz(video.discovered_at)
            or _ensure_tz(video.created_at)
            or now
        )
        if now - last_seen >= confirm_after:
            video.source_state = REMOVED_STATE
            if video.removed_detected_at is None:
                video.removed_detected_at = now
            video.updated_at = now
            newly_removed += 1
        else:
            suspected += 1

    total_removed = sum(1 for video in rows if video.source_state in REMOVED_SOURCE_STATES)
    return PresenceReconcileSummary(
        seen=returned,
        newly_removed=newly_removed,
        suspected=suspected,
        resurrected=resurrected,
        total_removed=total_removed,
    )


async def count_removed_saved_videos(db: AsyncSession, channel_id: int) -> int:
    """Count removed-source videos that still have at least one indexed media file."""
    value = await db.scalar(
        select(func.count(func.distinct(Video.id)))
        .select_from(Video)
        .join(MediaFile, MediaFile.video_id == Video.id)
        .where(Video.channel_id == channel_id, Video.source_state.in_(REMOVED_SOURCE_STATES))
    )
    return int(value or 0)


def _within_covered_window(
    *,
    video: Video,
    listing_complete: bool,
    covered_floor: datetime | None,
) -> bool:
    if listing_complete:
        return True
    if covered_floor is None:
        return False
    published = _ensure_tz(video.published_at)
    return published is not None and published >= covered_floor


def _ensure_tz(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)
