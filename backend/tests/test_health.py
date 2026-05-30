"""Tests for health and dashboard smoke endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Channel Vault NAS"


@pytest.mark.asyncio
async def test_dashboard_snapshot_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert len(data["metrics"]) >= 4
    assert data["coverage"]["percent"] >= 90
    assert data["coverage"]["removed_saved"] >= 1
    assert data["fidelity"]["info_json"] >= data["coverage"]["archived"]
    assert len(data["channels"]) >= 3
    assert len(data["queue"]) >= 3


@pytest.mark.asyncio
async def test_channel_archive_priority_endpoints() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        coverage = await client.get("/api/channels/c1/coverage")
        missing = await client.get("/api/channels/c1/missing")
        removed = await client.get("/api/channels/c1/removed")
        cadence = await client.get("/api/channels/c1/cadence")
        layout = await client.get("/api/channels/_file-layout/default")
        imports = await client.get("/api/imports/sources")

    assert coverage.status_code == 200
    assert coverage.json()["missing"] == 13

    assert missing.status_code == 200
    assert missing.json()[0]["source_state"] == "available"

    assert removed.status_code == 200
    assert "video.mp4" in removed.json()[0]["local_relative_path"]

    assert cadence.status_code == 200
    assert cadence.json()["typical_upload_dow"] == 3

    assert layout.status_code == 200
    assert "video.info.json" in layout.json()["sidecars"]

    assert imports.status_code == 200
    assert imports.json()[0]["id"] == "google-takeout"
