"""Small in-process realtime event bus for the local MVP."""

from __future__ import annotations

import asyncio
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
        self._persistence_tasks: set[asyncio.Task[None]] = set()

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
        self._schedule_persistence(event)
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

    async def flush_persistence(self, timeout: float = 1.5) -> None:
        """Wait briefly for pending audit writes before an operator reads recent events."""
        if not self._persistence_tasks:
            return
        await asyncio.wait(self._persistence_tasks, timeout=timeout)

    def _schedule_persistence(self, event: ArchiveEvent) -> None:
        async def persist() -> None:
            try:
                from app.services.event_log import persist_archive_event

                await persist_archive_event(event)
            except Exception:
                return

        task = asyncio.create_task(persist())
        self._persistence_tasks.add(task)
        task.add_done_callback(self._persistence_tasks.discard)


event_bus = EventBus()
