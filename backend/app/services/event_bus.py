"""Small in-process realtime event bus for the local MVP."""

from __future__ import annotations

from collections import deque
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket

from app.schemas.events import ArchiveEvent


class EventBus:
    """Broadcast JSON events to connected WebSocket clients and keep a short history."""

    def __init__(self, history_limit: int = 100) -> None:
        self._clients: set[WebSocket] = set()
        self._history: deque[ArchiveEvent] = deque(maxlen=history_limit)

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a websocket and send recent context."""
        await websocket.accept()
        self._clients.add(websocket)
        for event in self.history():
            await websocket.send_json(event.model_dump(mode="json"))

    def disconnect(self, websocket: WebSocket) -> None:
        """Forget a websocket connection."""
        self._clients.discard(websocket)

    async def publish(self, event_type: str, data: dict[str, Any]) -> ArchiveEvent:
        """Create, retain, and broadcast one event."""
        event = ArchiveEvent(type=event_type, data=data, occurred_at=datetime.now(UTC))
        self._history.appendleft(event)
        stale: list[WebSocket] = []
        for websocket in self._clients:
            try:
                await websocket.send_json(event.model_dump(mode="json"))
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)
        return event

    def history(self, limit: int = 50) -> list[ArchiveEvent]:
        """Return newest-first recent events."""
        return list(self._history)[:limit]


event_bus = EventBus()
