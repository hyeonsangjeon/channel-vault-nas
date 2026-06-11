"""Persistent archive event log helpers."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence

from sqlalchemy import delete, desc, select
from sqlalchemy.exc import SQLAlchemyError

from app.database import AsyncSessionLocal
from app.models.archive import ArchiveEventLog
from app.schemas.events import ArchiveEvent, ArchiveEventPruneResult


async def persist_archive_event(event: ArchiveEvent, *, attempts: int = 6) -> None:
    """Store one realtime event without making event delivery depend on audit storage."""
    for attempt in range(attempts):
        try:
            async with AsyncSessionLocal() as session:
                session.add(ArchiveEventLog(type=event.type, data=dict(event.data), occurred_at=event.occurred_at))
                await session.commit()
            return
        except SQLAlchemyError:
            if attempt >= attempts - 1:
                return
            await asyncio.sleep(0.05 * (attempt + 1))


async def list_archive_events(
    *,
    limit: int = 50,
    event_id: int | None = None,
    type_prefix: str | None = None,
    channel_id: int | None = None,
    job_id: int | None = None,
    video_id: int | None = None,
) -> list[ArchiveEvent]:
    """Return persisted archive events newest-first, with lightweight operator filters."""
    bounded_limit = max(1, min(limit, 500))
    has_data_filter = channel_id is not None or job_id is not None or video_id is not None
    fetch_limit = min(1000, max(bounded_limit, bounded_limit * 10 if has_data_filter else bounded_limit))
    try:
        async with AsyncSessionLocal() as session:
            query = select(ArchiveEventLog)
            if event_id is not None:
                query = query.where(ArchiveEventLog.id == event_id)
            if type_prefix:
                query = query.where(ArchiveEventLog.type.like(f"{type_prefix}%"))
            result = await session.execute(
                query.order_by(desc(ArchiveEventLog.occurred_at), desc(ArchiveEventLog.id)).limit(fetch_limit)
            )
            rows = result.scalars().all()
    except SQLAlchemyError:
        return []

    events = [_to_archive_event(row) for row in rows]
    if has_data_filter:
        events = [
            event
            for event in events
            if _event_matches(event, channel_id=channel_id, job_id=job_id, video_id=video_id)
        ]
    return events[:bounded_limit]


async def prune_archive_events(*, keep_latest: int = 500) -> ArchiveEventPruneResult:
    """Trim persisted realtime audit events while keeping the newest rows."""
    bounded_keep = max(1, min(keep_latest, 50_000))
    deleted = 0
    try:
        async with AsyncSessionLocal() as session:
            keep_ids = (
                select(ArchiveEventLog.id)
                .order_by(desc(ArchiveEventLog.occurred_at), desc(ArchiveEventLog.id))
                .limit(bounded_keep)
            )
            result = await session.execute(delete(ArchiveEventLog).where(ArchiveEventLog.id.not_in(keep_ids)))
            await session.commit()
            deleted = result.rowcount or 0
    except SQLAlchemyError:
        deleted = 0
    return ArchiveEventPruneResult(
        kind="archive_event_logs",
        deleted=deleted,
        keep_latest=bounded_keep,
    )


def _to_archive_event(row: ArchiveEventLog) -> ArchiveEvent:
    return ArchiveEvent(id=row.id, type=row.type, data=row.data or {}, occurred_at=row.occurred_at)


def _event_matches(
    event: ArchiveEvent,
    *,
    channel_id: int | None,
    job_id: int | None,
    video_id: int | None,
) -> bool:
    if channel_id is not None and _read_int(event.data, "channel_id") != channel_id:
        return False
    if video_id is not None and _read_int(event.data, "video_id") != video_id:
        return False
    if job_id is not None and not _data_has_job_id(event.data, job_id):
        return False
    return True


def _data_has_job_id(data: dict[str, object], expected: int) -> bool:
    if _read_int(data, "job_id") == expected:
        return True
    job_ids = data.get("job_ids")
    if isinstance(job_ids, Sequence) and not isinstance(job_ids, str):
        return any(_coerce_int(item) == expected for item in job_ids)
    return False


def _read_int(data: dict[str, object], key: str) -> int | None:
    return _coerce_int(data.get(key))


def _coerce_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None
