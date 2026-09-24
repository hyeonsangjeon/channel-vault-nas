"""Small in-process realtime event bus for the local MVP."""

from __future__ import annotations

import asyncio
from collections import deque
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.schemas.events import ArchiveEvent


class EventBus:
    """Broadcast JSON events to connected WebSocket clients and keep a short history."""

    def __init__(self, history_limit: int = 100, send_timeout: float = 2.0) -> None:
        self._clients: set[WebSocket] = set()
        self._history: deque[ArchiveEvent] = deque(maxlen=history_limit)
        self._persistence_tasks: set[asyncio.Task[None]] = set()
        self._broadcast_tasks: set[asyncio.Task[None]] = set()
        self._send_locks: dict[WebSocket, asyncio.Lock] = {}
        self._send_timeout = send_timeout

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a websocket and send recent context."""
        await websocket.accept()
        self._clients.add(websocket)
        for event in self.history():
            await self._send_event(websocket, event)

    def disconnect(self, websocket: WebSocket) -> None:
        """Forget a websocket connection."""
        self._clients.discard(websocket)
        self._send_locks.pop(websocket, None)

    async def publish(self, event_type: str, data: dict[str, Any]) -> ArchiveEvent:
        """Create, retain, and broadcast one event."""
        event = ArchiveEvent(type=event_type, data=data, occurred_at=datetime.now(UTC))
        self._history.appendleft(event)
        self._schedule_persistence(event)
        if self._clients:
            task = asyncio.create_task(self._broadcast(tuple(self._clients), event))
            self._broadcast_tasks.add(task)
            task.add_done_callback(self._broadcast_tasks.discard)
        return event

    async def _broadcast(self, clients: tuple[WebSocket, ...], event: ArchiveEvent) -> None:
        await asyncio.gather(*(self._send_event(websocket, event) for websocket in clients))

    async def _send_event(self, websocket: WebSocket, event: ArchiveEvent) -> None:
        if websocket not in self._clients:
            return
        lock = self._send_locks.setdefault(websocket, asyncio.Lock())

        async def send() -> None:
            async with lock:
                if websocket in self._clients:
                    await websocket.send_json(event.model_dump(mode="json"))

        try:
            await asyncio.wait_for(send(), timeout=self._send_timeout)
        except (TimeoutError, OSError, RuntimeError, WebSocketDisconnect):
            self.disconnect(websocket)
            try:
                await asyncio.wait_for(websocket.close(code=1013), timeout=self._send_timeout)
            except (TimeoutError, OSError, RuntimeError, WebSocketDisconnect):
                pass

    async def close(self) -> None:
        tasks = tuple(self._broadcast_tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        for websocket in tuple(self._clients):
            self.disconnect(websocket)
            try:
                await asyncio.wait_for(websocket.close(code=1001), timeout=self._send_timeout)
            except (TimeoutError, OSError, RuntimeError, WebSocketDisconnect):
                pass

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
