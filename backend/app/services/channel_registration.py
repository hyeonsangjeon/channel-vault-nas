"""Channel registration persistence flow."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from statistics import mean

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, ChannelPolicy, Video
from app.schemas.source import (
    ChannelProbeRequest,
    ChannelProbeResult,
    ChannelRegistrationRequest,
    ChannelRegistrationResult,
    RegisteredChannel,
    SourceVideoPreview,
)
from app.services.archive_paths import channel_folder_name, video_folder_name
from app.services.archive_txt import (
    ARCHIVE_TXT_PLACEHOLDER_DESCRIPTION,
    ARCHIVE_TXT_PLACEHOLDER_PREFIX,
)
from app.services.ytdlp_probe import probe_channel_source


@dataclass(slots=True)
class VideoUpsertSummary:
    """Counts returned when probe previews are merged into the video index."""

    videos_seen: int
    videos_created: int
    videos_enriched: int


async def list_registered_channels(db: AsyncSession) -> list[RegisteredChannel]:
    """Return registered channels ordered by creation time."""
    result = await db.execute(select(Channel).order_by(Channel.created_at.desc()))
    return [_to_registered_channel(channel) for channel in result.scalars().all()]


async def probe_for_registration(
    db: AsyncSession,
    payload: ChannelProbeRequest,
) -> ChannelProbeResult:
    """Probe and annotate whether this source is already registered."""
    probe = await probe_channel_source(payload)
    existing = await _find_existing_channel(db, probe)
    if existing is not None:
        probe.already_registered = True
        probe.existing_channel_id = existing.id
    return probe


async def register_channel(
    db: AsyncSession,
    payload: ChannelRegistrationRequest,
) -> ChannelRegistrationResult:
    """Probe, persist, and return the registered channel."""
    probe = await probe_for_registration(db, payload)
    existing = await _find_existing_channel(db, probe)
    if existing is not None:
        await apply_probe_to_channel(db=db, channel=existing, probe=probe)
        await upsert_channel_policy(db=db, channel=existing, payload=payload)
        probe.already_registered = True
        probe.existing_channel_id = existing.id
        return ChannelRegistrationResult(
            channel=_to_registered_channel(existing),
            probe=probe,
            created=False,
        )

    now = datetime.now(UTC)
    channel = Channel(
        source_type="channel",
        source_url=probe.source_url,
        external_id=probe.external_id,
        handle=probe.handle,
        title=probe.title,
        description=probe.description,
        thumbnail_url=probe.thumbnail_url,
        status="active",
        last_synced_at=now,
        source_counts_updated_at=now,
        source_video_count=probe.video_count,
        archived_count=0,
        missing_count=probe.video_count,
        removed_saved_count=0,
        first_video_published_at=probe.first_video_published_at,
        latest_video_published_at=probe.latest_video_published_at,
    )
    db.add(channel)
    await db.flush()
    db.add(
        ChannelPolicy(
            channel_id=channel.id,
            auto_download=payload.auto_download,
            max_quality=payload.max_quality,
            audio_only=payload.audio_only,
            subtitles_enabled=payload.subtitles_enabled,
            subtitle_languages=["ko", "en"] if payload.subtitles_enabled else [],
            retention_policy=payload.backfill_mode,
        )
    )
    _update_cadence_from_previews(channel, probe.videos)
    await upsert_probe_videos(db=db, channel=channel, probe=probe)
    return ChannelRegistrationResult(
        channel=_to_registered_channel(channel),
        probe=probe,
        created=True,
    )


async def apply_probe_to_channel(
    *,
    db: AsyncSession,
    channel: Channel,
    probe: ChannelProbeResult,
) -> VideoUpsertSummary:
    """Refresh channel metadata and merge the probe's video previews."""
    now = datetime.now(UTC)
    channel.source_url = probe.source_url
    channel.external_id = probe.external_id or channel.external_id
    channel.handle = probe.handle or channel.handle
    channel.title = probe.title
    channel.description = probe.description
    channel.thumbnail_url = probe.thumbnail_url
    channel.last_synced_at = now
    channel.source_counts_updated_at = now
    channel.source_video_count = probe.video_count
    channel.missing_count = max(probe.video_count - channel.archived_count, 0)
    channel.first_video_published_at = probe.first_video_published_at
    channel.latest_video_published_at = probe.latest_video_published_at
    _update_cadence_from_previews(channel, probe.videos)
    return await upsert_probe_videos(db=db, channel=channel, probe=probe)


async def upsert_probe_videos(
    *,
    db: AsyncSession,
    channel: Channel,
    probe: ChannelProbeResult,
) -> VideoUpsertSummary:
    """Insert new source videos and refresh existing metadata."""
    now = datetime.now(UTC)
    existing_result = await db.execute(select(Video).where(Video.channel_id == channel.id))
    existing = {video.external_id: video for video in existing_result.scalars().all()}
    created = 0
    enriched = 0

    channel_folder = channel_folder_name(
        handle=channel.handle,
        channel_id=channel.external_id,
        title=channel.title,
    )
    for preview in probe.videos:
        video = existing.get(preview.external_id)
        upload_date = _date_from_yyyymmdd(preview.upload_date)
        info_json_path = _info_json_path(channel_folder=channel_folder, preview=preview, upload_date=upload_date)
        if video is None:
            created += 1
            db.add(
                Video(
                    channel_id=channel.id,
                    external_id=preview.external_id,
                    title=preview.title,
                    description=None,
                    published_at=preview.published_at,
                    upload_date=upload_date,
                    duration_seconds=preview.duration_seconds,
                    thumbnail_url=preview.thumbnail_url,
                    view_count=None,
                    source_state="available",
                    last_seen_in_source_at=now,
                    tags=None,
                    categories=None,
                    chapters=None,
                    is_short=bool(preview.duration_seconds and preview.duration_seconds <= 60),
                    is_live=False,
                    was_livestream=False,
                    info_json_path=info_json_path,
                )
            )
            continue

        was_archive_txt_placeholder = _is_archive_txt_placeholder(video)
        if was_archive_txt_placeholder:
            enriched += 1
        video.title = preview.title
        if video.description == ARCHIVE_TXT_PLACEHOLDER_DESCRIPTION:
            video.description = None
        video.published_at = preview.published_at or video.published_at
        video.upload_date = upload_date or video.upload_date
        video.duration_seconds = preview.duration_seconds or video.duration_seconds
        video.thumbnail_url = preview.thumbnail_url or video.thumbnail_url
        video.source_state = "available"
        video.last_seen_in_source_at = now
        video.info_json_path = info_json_path
        video.updated_at = now

    return VideoUpsertSummary(videos_seen=len(probe.videos), videos_created=created, videos_enriched=enriched)


async def upsert_channel_policy(
    *,
    db: AsyncSession,
    channel: Channel,
    payload: ChannelRegistrationRequest,
) -> ChannelPolicy:
    """Persist archive policy fields collected during registration."""
    result = await db.execute(select(ChannelPolicy).where(ChannelPolicy.channel_id == channel.id))
    policy = result.scalar_one_or_none()
    if policy is None:
        policy = ChannelPolicy(channel_id=channel.id)
        db.add(policy)

    policy.auto_download = payload.auto_download
    policy.max_quality = payload.max_quality
    policy.audio_only = payload.audio_only
    policy.subtitles_enabled = payload.subtitles_enabled
    policy.subtitle_languages = ["ko", "en"] if payload.subtitles_enabled else []
    policy.retention_policy = payload.backfill_mode
    return policy


async def _find_existing_channel(db: AsyncSession, probe: ChannelProbeResult) -> Channel | None:
    predicates = [Channel.source_url == probe.source_url]
    if probe.external_id:
        predicates.append(Channel.external_id == probe.external_id)
    if probe.handle:
        predicates.append(Channel.handle == probe.handle)

    result = await db.execute(select(Channel).where(or_(*predicates)).limit(1))
    return result.scalar_one_or_none()


def _to_registered_channel(channel: Channel) -> RegisteredChannel:
    return RegisteredChannel(
        id=channel.id,
        title=channel.title,
        external_id=channel.external_id,
        handle=channel.handle,
        source_url=channel.source_url,
        video_count=channel.source_video_count,
        archived_count=channel.archived_count,
        missing_count=channel.missing_count,
        status=channel.status,
        created_at=channel.created_at,
    )


def _update_cadence_from_previews(channel: Channel, videos: list[SourceVideoPreview]) -> None:
    published = sorted(video.published_at for video in videos if video.published_at is not None)
    if not published:
        channel.avg_upload_interval_days = None
        channel.typical_upload_dow = None
        channel.typical_upload_hour = None
        return

    if len(published) > 1:
        intervals = [
            (newer - older).total_seconds() / 86_400
            for older, newer in zip(published[:-1], published[1:], strict=True)
        ]
        channel.avg_upload_interval_days = round(mean(intervals), 2)
    else:
        channel.avg_upload_interval_days = None

    channel.typical_upload_dow = _mode_int([item.weekday() for item in published])
    channel.typical_upload_hour = _mode_int([item.hour for item in published])


def _mode_int(values: list[int]) -> int | None:
    if not values:
        return None
    counts: dict[int, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return max(counts, key=lambda value: (counts[value], -value))


def _info_json_path(channel_folder: str, preview: SourceVideoPreview, upload_date: date | None) -> str:
    year = "undated"
    if upload_date is not None:
        year = str(upload_date.year)
    elif preview.published_at is not None:
        year = str(preview.published_at.year)
    video_folder = video_folder_name(
        title=preview.title,
        video_id=preview.external_id,
        published_at=preview.published_at,
        upload_date=upload_date,
    )
    return f"channels/{channel_folder}/{year}/{video_folder}/video.info.json"


def _is_archive_txt_placeholder(video: Video) -> bool:
    return video.title.startswith(ARCHIVE_TXT_PLACEHOLDER_PREFIX) and video.info_json_path is None


def _date_from_yyyymmdd(value: str | None) -> date | None:
    if not value or len(value) != 8:
        return None
    try:
        return date(year=int(value[:4]), month=int(value[4:6]), day=int(value[6:]))
    except ValueError:
        return None
