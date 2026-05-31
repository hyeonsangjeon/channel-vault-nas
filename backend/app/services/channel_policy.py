"""Channel policy read/update services."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, ChannelPolicy
from app.schemas.jobs import ChannelPolicyRead, ChannelPolicyUpdate
from app.services.event_bus import event_bus


async def get_channel_policy(db: AsyncSession, channel_id: int) -> ChannelPolicyRead | None:
    """Return a channel policy, creating defaults for existing channels."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None
    policy = await _ensure_policy(db, channel_id)
    return to_channel_policy(policy)


async def update_channel_policy(
    *,
    db: AsyncSession,
    channel_id: int,
    payload: ChannelPolicyUpdate,
) -> ChannelPolicyRead | None:
    """Patch editable policy fields for one channel."""
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None

    policy = await _ensure_policy(db, channel_id)
    update = payload.model_dump(exclude_unset=True)
    for key, value in update.items():
        setattr(policy, key, value)
    if policy.worker_paused and not policy.worker_pause_reason:
        policy.worker_pause_reason = "Paused by channel policy."
    if not policy.worker_paused:
        policy.worker_pause_reason = None
    policy.updated_at = datetime.now(UTC)
    await db.flush()
    result = to_channel_policy(policy)
    await event_bus.publish(
        "policy.updated",
        {
            "channel_id": channel_id,
            "channel_title": channel.title,
            "max_quality": result.max_quality,
            "auto_download": result.auto_download,
            "worker_paused": result.worker_paused,
        },
    )
    return result


def to_channel_policy(policy: ChannelPolicy) -> ChannelPolicyRead:
    """Convert ORM policy into API shape."""
    return ChannelPolicyRead(
        channel_id=policy.channel_id,
        auto_download=policy.auto_download,
        max_quality=policy.max_quality,
        audio_only=policy.audio_only,
        subtitles_enabled=policy.subtitles_enabled,
        subtitle_languages=policy.subtitle_languages or [],
        retention_policy=policy.retention_policy,
        worker_paused=policy.worker_paused,
        worker_pause_reason=policy.worker_pause_reason,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )


async def _ensure_policy(db: AsyncSession, channel_id: int) -> ChannelPolicy:
    result = await db.execute(select(ChannelPolicy).where(ChannelPolicy.channel_id == channel_id))
    policy = result.scalar_one_or_none()
    if policy is not None:
        return policy

    now = datetime.now(UTC)
    policy = ChannelPolicy(
        channel_id=channel_id,
        auto_download=False,
        max_quality="1080p",
        audio_only=False,
        subtitles_enabled=True,
        subtitle_languages=["ko", "en"],
        retention_policy="all",
        worker_paused=False,
        worker_pause_reason=None,
        created_at=now,
        updated_at=now,
    )
    db.add(policy)
    await db.flush()
    return policy
