"""Realtime archive event endpoints."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas.events import ArchiveEvent
from app.services.event_bus import event_bus

router = APIRouter(tags=["events"])


@router.get("/api/events/recent", response_model=list[ArchiveEvent])
async def get_recent_events() -> list[ArchiveEvent]:
    """Return recent in-process archive events."""
    return event_bus.history()


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket) -> None:
    """Stream archive events to the UI."""
    await event_bus.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_bus.disconnect(websocket)
