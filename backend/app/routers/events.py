"""Realtime archive event endpoints."""

from typing import Literal

from fastapi import APIRouter, Query, Response, WebSocket, WebSocketDisconnect

from app.schemas.events import ArchiveEvent, ArchiveEventPruneResult
from app.services.audit_export import audit_export_response
from app.services.event_bus import event_bus
from app.services.event_log import list_archive_events, prune_archive_events

router = APIRouter(tags=["events"])


@router.get("/api/events/recent", response_model=list[ArchiveEvent])
async def get_recent_events(
    limit: int = Query(default=50, ge=1, le=500),
    type_prefix: str | None = None,
    channel_id: int | None = None,
    job_id: int | None = None,
    video_id: int | None = None,
) -> list[ArchiveEvent]:
    """Return recent persisted archive events, falling back to in-process history."""
    await event_bus.flush_persistence()
    events = await list_archive_events(
        limit=limit,
        type_prefix=type_prefix,
        channel_id=channel_id,
        job_id=job_id,
        video_id=video_id,
    )
    return events or event_bus.history(limit)


@router.get("/api/events/recent/export", response_class=Response)
async def export_recent_events(
    export_format: Literal["ndjson", "csv"] = Query(default="ndjson", alias="format"),
    limit: int = Query(default=500, ge=1, le=2_000),
    type_prefix: str | None = None,
    channel_id: int | None = None,
    job_id: int | None = None,
    video_id: int | None = None,
) -> Response:
    """Download persisted realtime event audits as NDJSON or CSV."""
    await event_bus.flush_persistence()
    events = await list_archive_events(
        limit=limit,
        type_prefix=type_prefix,
        channel_id=channel_id,
        job_id=job_id,
        video_id=video_id,
    )
    return audit_export_response(
        rows=[event.model_dump(mode="json") for event in events],
        filename_prefix="archive-event-log",
        export_format=export_format,
    )


@router.delete("/api/events/recent", response_model=ArchiveEventPruneResult)
async def prune_recent_events(keep_latest: int = Query(default=500, ge=1, le=50_000)) -> ArchiveEventPruneResult:
    """Trim persisted event audit rows while retaining the newest rows."""
    await event_bus.flush_persistence()
    return await prune_archive_events(keep_latest=keep_latest)


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket) -> None:
    """Stream archive events to the UI."""
    await event_bus.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_bus.disconnect(websocket)
