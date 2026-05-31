"""Periodic channel metadata sync scheduler."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.archive import Channel, ChannelPolicy, MetadataSyncTick, SyncJob
from app.schemas.jobs import ChannelSyncRequest
from app.schemas.settings import MetadataSyncSchedulerStatus, MetadataSyncTickRead
from app.services.channel_sync import run_channel_sync
from app.services.download_queue import create_channel_download_candidates
from app.services.event_bus import event_bus


class MetadataSyncSchedulerState:
    """In-memory metadata scheduler telemetry for this backend process."""

    def __init__(self) -> None:
        self.running = False
        self.last_started_at: datetime | None = None
        self.last_completed_at: datetime | None = None
        self.last_error: str | None = None
        self.last_result_status: str | None = None
        self.next_tick_at: datetime | None = None

    def mark_started(self) -> None:
        self.running = True
        self.last_started_at = datetime.now(UTC)
        self.next_tick_at = None

    def mark_completed(self, status: str) -> None:
        self.running = False
        self.last_completed_at = datetime.now(UTC)
        self.last_error = None
        self.last_result_status = status

    def mark_failed(self, exc: Exception) -> None:
        self.running = False
        self.last_completed_at = datetime.now(UTC)
        self.last_error = str(exc)
        self.last_result_status = "failed"

    def set_next_tick(self, delay_seconds: int | None) -> None:
        self.next_tick_at = (
            datetime.now(UTC) + timedelta(seconds=delay_seconds)
            if delay_seconds is not None
            else None
        )


class MetadataSyncScheduler:
    """Small in-process loop that syncs due channels."""

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None

    def start(self) -> None:
        """Start the scheduler when configured for this process."""
        if not settings.metadata_sync_scheduler_enabled or self._task is not None:
            return
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._run(), name="metadata-sync-scheduler")

    async def stop(self) -> None:
        """Stop the loop and wait for the current tick boundary."""
        if self._task is None or self._stop_event is None:
            return
        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None
            self._stop_event = None

    async def _run(self) -> None:
        assert self._stop_event is not None
        try:
            while not self._stop_event.is_set():
                try:
                    await run_metadata_sync_scheduler_tick()
                except Exception as exc:  # pragma: no cover - defensive runtime guard
                    await event_bus.publish("sync.scheduler.failed", {"error": str(exc)})
                delay_seconds = max(30, settings.metadata_sync_scheduler_interval_seconds)
                metadata_scheduler_state.set_next_tick(delay_seconds)
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=delay_seconds)
                except TimeoutError:
                    continue
        finally:
            metadata_scheduler_state.running = False
            metadata_scheduler_state.set_next_tick(None)


async def run_metadata_sync_scheduler_tick(*, force: bool = False, trigger: str = "scheduler") -> MetadataSyncTickRead:
    """Run one metadata scheduler tick and persist its audit row."""
    started_at = datetime.now(UTC)
    async with AsyncSessionLocal() as session:
        tick = MetadataSyncTick(
            trigger=trigger,
            status="running",
            scheduler_enabled=settings.metadata_sync_scheduler_enabled,
            interval_seconds=settings.metadata_sync_scheduler_interval_seconds,
            limit=settings.metadata_sync_scheduler_limit,
            started_at=started_at,
            created_at=started_at,
        )
        session.add(tick)
        await session.commit()
        await session.refresh(tick)

    if not force and not settings.metadata_sync_scheduler_enabled:
        await _mark_tick_skipped(tick_id=tick.id, reason="metadata scheduler disabled")
        metadata_scheduler_state.mark_completed("skipped")
        return await _read_tick(tick.id)

    metadata_scheduler_state.mark_started()
    try:
        async with AsyncSessionLocal() as session:
            due_channels = await find_due_sync_channels(
                db=session,
                now=started_at,
                limit=settings.metadata_sync_scheduler_limit,
            )
            if not due_channels:
                await _complete_tick(
                    session=session,
                    tick_id=tick.id,
                    status="skipped",
                    due_channel_count=0,
                    synced_count=0,
                    failed_count=0,
                    videos_seen_count=0,
                    videos_created_count=0,
                    candidates_created_count=0,
                    skipped_reason="no due channels",
                    error_message=None,
                )
                await session.commit()
                metadata_scheduler_state.mark_completed("skipped")
                return await _read_tick(tick.id)

            totals = {
                "synced": 0,
                "failed": 0,
                "videos_seen": 0,
                "videos_created": 0,
                "candidates_created": 0,
            }
            errors: list[str] = []
            for channel in due_channels:
                try:
                    policy = await _channel_policy(session=session, channel_id=channel.id)
                    result = await run_channel_sync(
                        db=session,
                        channel_id=channel.id,
                        payload=ChannelSyncRequest(
                            max_quality=policy.max_quality if policy else "1080p",
                            audio_only=policy.audio_only if policy else False,
                            subtitles_enabled=policy.subtitles_enabled if policy else True,
                        ),
                        trigger="scheduler",
                    )
                    if result.job.status == "completed":
                        totals["synced"] += 1
                        totals["videos_seen"] += result.videos_seen
                        totals["videos_created"] += result.videos_created
                        candidates_created = await _auto_create_candidates(
                            session=session,
                            channel_id=channel.id,
                            policy=policy,
                            sync_job_id=result.job.id,
                        )
                        totals["candidates_created"] += candidates_created
                    else:
                        totals["failed"] += 1
                        if result.job.error_message:
                            errors.append(result.job.error_message)
                except Exception as exc:  # keep one bad channel from blocking the rest
                    totals["failed"] += 1
                    errors.append(str(exc))

            status = "failed" if totals["failed"] else "completed"
            await _complete_tick(
                session=session,
                tick_id=tick.id,
                status=status,
                due_channel_count=len(due_channels),
                synced_count=totals["synced"],
                failed_count=totals["failed"],
                videos_seen_count=totals["videos_seen"],
                videos_created_count=totals["videos_created"],
                candidates_created_count=totals["candidates_created"],
                skipped_reason=None,
                error_message="; ".join(errors[:3]) if errors else None,
            )
            await session.commit()
    except Exception as exc:
        metadata_scheduler_state.mark_failed(exc)
        await _mark_tick_failed(tick_id=tick.id, exc=exc)
        raise

    metadata_scheduler_state.mark_completed(status)
    await event_bus.publish(
        "sync.scheduler.completed",
        {
            "status": status,
            "due_channel_count": len(due_channels),
            "synced_count": totals["synced"],
            "failed_count": totals["failed"],
            "videos_created_count": totals["videos_created"],
            "candidates_created_count": totals["candidates_created"],
        },
    )
    return await _read_tick(tick.id)


async def find_due_sync_channels(
    *,
    db: AsyncSession,
    now: datetime | None = None,
    limit: int | None = None,
) -> list[Channel]:
    """Return active channels whose per-channel sync interval is due."""
    effective_now = now or datetime.now(UTC)
    effective_limit = max(1, min(limit or settings.metadata_sync_scheduler_limit, 50))
    result = await db.execute(select(Channel).where(Channel.status == "active").order_by(Channel.last_synced_at.asc()))
    due = [channel for channel in result.scalars().all() if _is_channel_due(channel, effective_now)]
    return due[:effective_limit]


async def list_metadata_sync_ticks(
    *,
    db: AsyncSession,
    limit: int = 12,
    status: str | None = None,
    min_duration_seconds: int | None = None,
    interval_seconds: int | None = None,
    scheduler_limit: int | None = None,
) -> list[MetadataSyncTickRead]:
    """Return newest persistent metadata sync tick telemetry rows."""
    effective_limit = max(1, min(limit, 100))
    fetch_limit = min(500, effective_limit * 5) if min_duration_seconds is not None else effective_limit
    query = select(MetadataSyncTick)
    if status:
        query = query.where(MetadataSyncTick.status == status)
    if interval_seconds is not None:
        query = query.where(MetadataSyncTick.interval_seconds == interval_seconds)
    if scheduler_limit is not None:
        query = query.where(MetadataSyncTick.limit == scheduler_limit)
    rows = (
        await db.execute(query.order_by(MetadataSyncTick.created_at.desc(), MetadataSyncTick.id.desc()).limit(fetch_limit))
    ).scalars()
    ticks = [_to_metadata_tick_read(row) for row in rows]
    if min_duration_seconds is not None:
        ticks = [
            tick
            for tick in ticks
            if tick.duration_seconds is not None and tick.duration_seconds >= min_duration_seconds
        ]
    return ticks[:effective_limit]


def get_metadata_sync_scheduler_status() -> MetadataSyncSchedulerStatus:
    """Return operator-facing metadata scheduler status for this process."""
    if not settings.metadata_sync_scheduler_enabled:
        state = "off"
    elif metadata_scheduler_state.running:
        state = "running"
    elif metadata_scheduler_state.last_error:
        state = "failed"
    elif metadata_scheduler_state.next_tick_at is not None:
        state = "waiting"
    else:
        state = "armed"
    return MetadataSyncSchedulerStatus(
        state=state,
        enabled=settings.metadata_sync_scheduler_enabled,
        running=metadata_scheduler_state.running,
        interval_seconds=settings.metadata_sync_scheduler_interval_seconds,
        limit=settings.metadata_sync_scheduler_limit,
        last_started_at=metadata_scheduler_state.last_started_at,
        last_completed_at=metadata_scheduler_state.last_completed_at,
        last_error=metadata_scheduler_state.last_error,
        last_result_status=metadata_scheduler_state.last_result_status,
        next_tick_at=metadata_scheduler_state.next_tick_at,
    )


async def _auto_create_candidates(
    *,
    session: AsyncSession,
    channel_id: int,
    policy: ChannelPolicy | None,
    sync_job_id: int,
) -> int:
    if policy is None or not policy.auto_download:
        return 0
    result = await create_channel_download_candidates(
        db=session,
        channel_id=channel_id,
        quality=policy.max_quality,
        limit=settings.metadata_sync_auto_candidates_limit,
    )
    candidates_created = result.candidates_created if result is not None else 0
    sync_job = await session.get(SyncJob, sync_job_id)
    if sync_job is not None:
        sync_job.candidates_created = candidates_created
    return candidates_created


async def _channel_policy(*, session: AsyncSession, channel_id: int) -> ChannelPolicy | None:
    return await session.scalar(select(ChannelPolicy).where(ChannelPolicy.channel_id == channel_id).limit(1))


def _is_channel_due(channel: Channel, now: datetime) -> bool:
    if channel.last_synced_at is None:
        return True
    base = channel.last_synced_at
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    return base + timedelta(minutes=max(1, channel.sync_interval_minutes)) <= now


async def _mark_tick_skipped(*, tick_id: int, reason: str) -> None:
    async with AsyncSessionLocal() as session:
        tick = await session.get(MetadataSyncTick, tick_id)
        if tick is None:
            return
        tick.status = "skipped"
        tick.skipped_reason = reason
        tick.completed_at = datetime.now(UTC)
        tick.next_tick_at = _next_tick_at()
        await session.commit()


async def _mark_tick_failed(*, tick_id: int, exc: Exception) -> None:
    async with AsyncSessionLocal() as session:
        tick = await session.get(MetadataSyncTick, tick_id)
        if tick is None:
            return
        tick.status = "failed"
        tick.failed_count = max(1, tick.failed_count)
        tick.error_message = str(exc)
        tick.completed_at = datetime.now(UTC)
        tick.next_tick_at = _next_tick_at()
        await session.commit()


async def _complete_tick(
    *,
    session: AsyncSession,
    tick_id: int,
    status: str,
    due_channel_count: int,
    synced_count: int,
    failed_count: int,
    videos_seen_count: int,
    videos_created_count: int,
    candidates_created_count: int,
    skipped_reason: str | None,
    error_message: str | None,
) -> None:
    tick = await session.get(MetadataSyncTick, tick_id)
    if tick is None:
        return
    tick.status = status
    tick.due_channel_count = due_channel_count
    tick.synced_count = synced_count
    tick.failed_count = failed_count
    tick.videos_seen_count = videos_seen_count
    tick.videos_created_count = videos_created_count
    tick.candidates_created_count = candidates_created_count
    tick.skipped_reason = skipped_reason
    tick.error_message = error_message
    tick.completed_at = datetime.now(UTC)
    tick.next_tick_at = _next_tick_at()


async def _read_tick(tick_id: int) -> MetadataSyncTickRead:
    async with AsyncSessionLocal() as session:
        tick = await session.get(MetadataSyncTick, tick_id)
        if tick is None:
            raise LookupError(f"Metadata sync tick {tick_id} was not found.")
        return _to_metadata_tick_read(tick)


def _next_tick_at() -> datetime | None:
    return (
        datetime.now(UTC) + timedelta(seconds=max(30, settings.metadata_sync_scheduler_interval_seconds))
        if settings.metadata_sync_scheduler_enabled
        else None
    )


def _to_metadata_tick_read(row: MetadataSyncTick) -> MetadataSyncTickRead:
    duration_seconds = None
    if row.completed_at is not None:
        duration_seconds = max(0, round((row.completed_at - row.started_at).total_seconds()))
    return MetadataSyncTickRead(
        id=row.id,
        trigger=row.trigger,
        status=row.status,
        scheduler_enabled=row.scheduler_enabled,
        interval_seconds=row.interval_seconds,
        limit=row.limit,
        due_channel_count=row.due_channel_count,
        synced_count=row.synced_count,
        failed_count=row.failed_count,
        videos_seen_count=row.videos_seen_count,
        videos_created_count=row.videos_created_count,
        candidates_created_count=row.candidates_created_count,
        skipped_reason=row.skipped_reason,
        error_message=row.error_message,
        duration_seconds=duration_seconds,
        next_tick_at=row.next_tick_at,
        started_at=row.started_at,
        completed_at=row.completed_at,
        created_at=row.created_at,
    )


metadata_scheduler_state = MetadataSyncSchedulerState()
metadata_sync_scheduler = MetadataSyncScheduler()
