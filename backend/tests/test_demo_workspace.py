"""Tests for the safe first-run demo workspace."""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.config import settings
from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import (
    ArchiveEventLog,
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadSchedulerTick,
    DownloadWorkerRun,
    LibraryView,
    MediaFile,
    MetadataSyncTick,
    StorageChannelPressureSnapshot,
    StoragePressureSnapshot,
    SyncJob,
    Video,
)


async def _clear_db() -> None:
    async with AsyncSessionLocal() as session:
        for model in (
            ArchiveEventLog,
            StorageChannelPressureSnapshot,
            StoragePressureSnapshot,
            DownloadSchedulerTick,
            MetadataSyncTick,
            DownloadWorkerRun,
            DownloadJob,
            SyncJob,
            LibraryView,
            ChannelPolicy,
            MediaFile,
            Video,
            Channel,
        ):
            await session.execute(delete(model))
        await session.commit()


@pytest.mark.asyncio
async def test_demo_workspace_seeds_empty_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    run_migrations()
    await init_db()
    await _clear_db()
    archive_root = tmp_path / "archive"
    monkeypatch.setattr(settings, "download_dir", str(archive_root))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/ops/demo-workspace")
        dashboard = await client.get("/api/dashboard")
        second = await client.post("/api/ops/demo-workspace")

    assert response.status_code == 200
    data = response.json()
    assert data["created"] is True
    assert data["channel_title"] == "Signal Lab"
    assert data["videos_created"] == 3
    assert data["jobs_created"] == 2
    assert data["files_created"] >= 5
    assert data["channel_id"] is not None
    assert (archive_root / "channels/@signalvaultlab [UC_CVN_DEMO_SIGNAL]/2026").exists()
    assert dashboard.status_code == 200
    assert dashboard.json()["channels"][0]["title"] == "Signal Lab"
    assert second.status_code == 200
    assert second.json()["created"] is False
    assert second.json()["skipped_reason"] == "demo already exists"
    assert second.json()["channel_id"] == data["channel_id"]


@pytest.mark.asyncio
async def test_demo_workspace_can_be_cleared(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    run_migrations()
    await init_db()
    await _clear_db()
    archive_root = tmp_path / "archive"
    monkeypatch.setattr(settings, "download_dir", str(archive_root))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        seeded = await client.post("/api/ops/demo-workspace")
        cleared = await client.delete("/api/ops/demo-workspace")
        dashboard = await client.get("/api/dashboard")
        second_clear = await client.delete("/api/ops/demo-workspace")

    assert seeded.status_code == 200
    assert seeded.json()["created"] is True
    assert cleared.status_code == 200
    clear_data = cleared.json()
    assert clear_data["cleared"] is True
    assert clear_data["channel_title"] == "Signal Lab"
    assert clear_data["db_rows_removed"] >= 7
    assert clear_data["files_removed"] >= 6
    assert not (archive_root / "channels/@signalvaultlab [UC_CVN_DEMO_SIGNAL]").exists()
    assert dashboard.status_code == 200
    assert dashboard.json()["channels"] == []
    assert second_clear.status_code == 200
    assert second_clear.json()["cleared"] is False
    assert second_clear.json()["skipped_reason"] == "demo workspace not found"
    async with AsyncSessionLocal() as session:
        demo = await session.scalar(select(Channel).where(Channel.external_id == "UC_CVN_DEMO_SIGNAL"))
        demo_view = await session.scalar(select(LibraryView).where(LibraryView.name == "Demo media triage"))
    assert demo is None
    assert demo_view is None


@pytest.mark.asyncio
async def test_demo_workspace_refuses_non_empty_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    run_migrations()
    await init_db()
    await _clear_db()
    archive_root = tmp_path / "archive"
    monkeypatch.setattr(settings, "download_dir", str(archive_root))
    async with AsyncSessionLocal() as session:
        session.add(
            Channel(
                source_type="channel",
                source_url="https://youtube.com/@real",
                external_id="UC_REAL_WORKSPACE",
                handle="@real",
                title="Real Workspace",
                status="active",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/ops/demo-workspace")

    assert response.status_code == 200
    data = response.json()
    assert data["created"] is False
    assert data["channel_id"] is None
    assert data["skipped_reason"] == "workspace already has registered channels"
    assert not archive_root.exists()
