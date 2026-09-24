"""Realtime delivery and filtered audit fallback regressions."""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocketDisconnect
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import SQLAlchemyError

from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import ArchiveEventLog
from app.routers import events as events_router
from app.schemas.events import ArchiveEvent
from app.services.event_bus import EventBus
from app.services.event_log import list_archive_events


class FakeSocket:
    def __init__(self, action=None):
        self.action = action
        self.messages = []
        self.closed = False

    async def send_json(self, payload):
        if self.action is not None:
            await self.action()
        self.messages.append(payload)

    async def close(self, code=1000):
        self.closed = True


@pytest.mark.asyncio
async def test_client_changes_during_broadcast_do_not_break_delivery(monkeypatch):
    bus = EventBus()
    monkeypatch.setattr(bus, "_schedule_persistence", lambda event: None)
    joining = FakeSocket()

    async def change_clients():
        bus._clients.add(joining)
        bus.disconnect(changing)
        await asyncio.sleep(0)

    changing = FakeSocket(change_clients)
    healthy = FakeSocket()
    bus._clients.update([changing, healthy])
    try:
        event = await bus.publish("download.progress", {"percent": 45})
        await asyncio.gather(*tuple(bus._broadcast_tasks))
        assert healthy.messages == [event.model_dump(mode="json")]
        assert joining in bus._clients
    finally:
        await bus.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", [WebSocketDisconnect(1006), RuntimeError("closed"), OSError("gone")])
async def test_broken_socket_does_not_fail_publisher(monkeypatch, failure):
    bus = EventBus()
    monkeypatch.setattr(bus, "_schedule_persistence", lambda event: None)

    async def fail_send():
        raise failure

    broken = FakeSocket(fail_send)
    healthy = FakeSocket()
    bus._clients.update([broken, healthy])
    try:
        await bus.publish("download.started", {"job_id": 1})
        await asyncio.gather(*tuple(bus._broadcast_tasks))
        assert broken not in bus._clients
        assert broken.closed
        assert len(healthy.messages) == 1
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_slow_socket_never_blocks_publisher(monkeypatch):
    bus = EventBus(send_timeout=0.05)
    monkeypatch.setattr(bus, "_schedule_persistence", lambda event: None)
    blocked = asyncio.Event()
    slow = FakeSocket(blocked.wait)
    bus._clients.add(slow)
    try:
        event = await bus.publish("download.progress", {"percent": 50})
        assert event.type == "download.progress"
        assert not slow.messages
        await asyncio.wait_for(asyncio.gather(*tuple(bus._broadcast_tasks)), timeout=2)
        assert slow.closed
        assert slow not in bus._clients
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_empty_database_filter_does_not_return_unfiltered_history(monkeypatch):
    bus = EventBus()
    bus._history.append(ArchiveEvent(type="download.started", data={"channel_id": 1}, occurred_at=datetime.now(UTC)))
    monkeypatch.setattr(events_router, "event_bus", bus)
    monkeypatch.setattr(events_router, "list_archive_events", AsyncMock(return_value=[]))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/events/recent?channel_id=999")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_unavailable_database_fallback_preserves_filters(monkeypatch):
    bus = EventBus()
    now = datetime.now(UTC)
    bus._history.extend([
        ArchiveEvent(id=1, type="sync.completed", data={"channel_id": 1, "job_id": 7}, occurred_at=now),
        ArchiveEvent(id=2, type="download.started", data={"channel_id": 2, "job_ids": [7]}, occurred_at=now),
    ])
    monkeypatch.setattr(events_router, "event_bus", bus)
    monkeypatch.setattr(events_router, "list_archive_events", AsyncMock(side_effect=SQLAlchemyError("unavailable")))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/events/recent?channel_id=2&job_id=7&type_prefix=download.&limit=1")
        missing = await client.get("/api/events/recent?event_id=100")
        export = await client.get("/api/events/recent/export")
    assert [event["id"] for event in response.json()] == [2]
    assert missing.json() == []
    assert export.status_code == 503


@pytest.mark.asyncio
async def test_filtered_event_query_searches_beyond_recent_unrelated_rows():
    run_migrations()
    await init_db()
    now = datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        target = ArchiveEventLog(type="test.filtered", data={"job_id": 123456789}, occurred_at=now - timedelta(days=1), created_at=now)
        db.add(target)
        db.add_all([
            ArchiveEventLog(type="test.filtered", data={"job_id": 987654321}, occurred_at=now, created_at=now)
            for _ in range(1_005)
        ])
        await db.commit()
        target_id = target.id
    events = await list_archive_events(type_prefix="test.filtered", job_id=123456789, limit=1)
    assert [event.id for event in events] == [target_id]
