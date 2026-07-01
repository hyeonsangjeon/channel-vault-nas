"""Tests for health and dashboard smoke endpoints."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.config import settings
from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadSchedulerTick,
    DownloadWorkerRun,
    MediaFile,
    SyncJob,
    Video,
)


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
async def test_api_root_explains_web_port_hint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "api"
    assert data["api_health"] == "/api/health"
    assert "5173" in data["message"]


@pytest.mark.asyncio
async def test_optional_auth_token_protects_api(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "auth_token", "test-secret")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        root = await client.get("/")
        health = await client.get("/api/health")
        locked = await client.get("/api/dashboard")
        bearer = await client.get("/api/dashboard", headers={"Authorization": "Bearer test-secret"})
        header = await client.get("/api/dashboard", headers={"X-CVN-Token": "test-secret"})

    assert root.status_code == 200
    assert root.json()["role"] == "api"
    assert health.status_code == 200
    assert locked.status_code == 401
    assert locked.json()["detail"] == "Channel Vault NAS auth token required"
    assert bearer.status_code == 200
    assert header.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_snapshot_endpoint() -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert len(data["metrics"]) == 5
    assert data["coverage"]["percent"] == 0
    assert data["coverage"]["removed_saved"] == 0
    assert data["fidelity"]["info_json"] >= data["coverage"]["archived"]
    assert data["channels"] == []
    assert len(data["queue"]) >= 3


@pytest.mark.asyncio
async def test_runtime_settings_endpoint_exposes_non_secret_worker_health() -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime")

    assert response.status_code == 200
    data = response.json()
    assert data["download_worker_enabled"] is False
    assert data["download_worker_scheduler_enabled"] is False
    assert data["download_worker_scheduler_interval_seconds"] >= 5
    assert data["scheduler_status"]["state"] == "off"
    assert data["scheduler_status"]["worker_enabled"] is False
    assert data["metadata_scheduler_status"]["due_channel_count"] == 0
    assert data["metadata_scheduler_status"]["next_due_at"] is None
    assert data["metadata_scheduler_status"]["due_channels"] == []
    assert data["pending_restart"] is False
    assert data["scheduler_ticks"] == []
    assert data["restart_adapter"]["manual_required"] is True
    assert data["restart_adapter"]["command"]
    assert {binary["name"] for binary in data["binaries"]} == {"yt-dlp", "ffprobe"}
    assert "secret" not in data


@pytest.mark.asyncio
async def test_runtime_settings_lists_metadata_sync_channel_watchlist() -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        channel = Channel(
            source_type="channel",
            source_url="https://youtube.com/@watchlist",
            external_id="UCwatchlist",
            handle="@watchlist",
            title="Watchlist Lab",
            status="active",
            last_synced_at=datetime.now(UTC) - timedelta(minutes=30),
            sync_interval_minutes=360,
        )
        session.add(channel)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime")

    data = response.json()
    watchlist = data["metadata_scheduler_status"]["due_channels"]
    assert response.status_code == 200
    assert data["metadata_scheduler_status"]["due_channel_count"] == 0
    assert data["metadata_scheduler_status"]["next_due_at"] is not None
    assert watchlist[0]["handle"] == "@watchlist"
    assert watchlist[0]["is_due"] is False


@pytest.mark.asyncio
async def test_runtime_restart_hook_adapter_executes_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "printf restarted")
    monkeypatch.setattr("app.config.settings.restart_command_timeout_seconds", 2)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        adapter_response = await client.get("/api/settings/runtime/restart")
        restart_response = await client.post("/api/settings/runtime/restart", json={"reason": "test"})
        events_response = await client.get("/api/events/recent?type_prefix=runtime.restart&limit=10")

    assert adapter_response.status_code == 200
    assert adapter_response.json()["adapter"] == "supervised-hook"
    assert adapter_response.json()["executable"] is True
    assert restart_response.status_code == 200
    data = restart_response.json()
    assert data["requested"] is True
    assert data["exit_code"] == 0
    assert data["stdout"] == "restarted"
    assert events_response.status_code == 200
    restart_events = events_response.json()
    event_types = {event["type"] for event in restart_events}
    assert {"runtime.restart.requested", "runtime.restart.completed"} <= event_types
    assert all(isinstance(event.get("id"), int) for event in restart_events)
    target_event = next(event for event in restart_events if event["type"] == "runtime.restart.completed")
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        filtered_response = await client.get(
            f"/api/events/recent?type_prefix=runtime.restart&event_id={target_event['id']}&limit=10"
        )

    assert filtered_response.status_code == 200
    assert filtered_response.json() == [target_event]


@pytest.mark.asyncio
async def test_runtime_restart_adapter_generates_docker_compose_command(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "")
    monkeypatch.setattr("app.config.settings.restart_adapter", "docker-compose")
    monkeypatch.setattr("app.config.settings.restart_adapter_execute", False)
    monkeypatch.setattr("app.config.settings.restart_service_name", "api")
    monkeypatch.setattr("app.services.runtime_settings._detect_compose_file", lambda: Path("/srv/cvn/compose.yaml"))
    monkeypatch.setattr("app.services.runtime_settings.which", lambda command: f"/usr/bin/{command}" if command == "docker" else None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime/restart")

    assert response.status_code == 200
    data = response.json()
    assert data["adapter"] == "docker-compose"
    assert data["manual_required"] is True
    assert data["compose_file"] == "/srv/cvn/compose.yaml"
    assert data["command"] == "docker compose -f /srv/cvn/compose.yaml restart api"
    assert data["command_available"] is True
    assert data["reason"] == "docker-compose adapter is copy-only until CVN_RESTART_ADAPTER_EXECUTE=true"
    assert "CVN_RESTART_ADAPTER=docker-compose" in data["env_lines"]
    assert "CVN_RESTART_ADAPTER_EXECUTE=true" in data["env_lines"]
    assert data["setup_hints"] == ["set CVN_RESTART_ADAPTER_EXECUTE=true after validating the command"]


@pytest.mark.asyncio
async def test_runtime_restart_adapter_supports_container_compose_env_without_compose_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "")
    monkeypatch.setattr("app.config.settings.restart_adapter", "docker_compose")
    monkeypatch.setattr("app.config.settings.restart_adapter_execute", False)
    monkeypatch.setattr("app.config.settings.restart_service_name", "api")
    monkeypatch.setattr("app.services.runtime_settings._detect_compose_file", lambda: None)
    monkeypatch.setattr("app.services.runtime_settings.which", lambda command: None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime/restart")

    assert response.status_code == 200
    data = response.json()
    assert data["adapter"] == "docker-compose"
    assert data["manual_required"] is True
    assert data["executable"] is False
    assert data["command_available"] is False
    assert data["compose_file"] is None
    assert data["service_name"] == "api"
    assert data["command"] == "docker compose restart api"
    assert "docker CLI is not available" in data["reason"]
    assert "docker is not available to the backend process" in data["setup_hints"]
    assert "CVN_RESTART_ADAPTER=docker-compose" in data["env_lines"]
    assert "CVN_RESTART_SERVICE_NAME=api" in data["env_lines"]


@pytest.mark.asyncio
async def test_runtime_restart_adapter_supports_supervisor_services(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "")
    monkeypatch.setattr("app.config.settings.restart_adapter", "supervisor")
    monkeypatch.setattr("app.config.settings.restart_adapter_execute", True)
    monkeypatch.setattr("app.config.settings.restart_service_name", "channel-vault")
    monkeypatch.setattr(
        "app.services.runtime_settings.which",
        lambda command: f"/usr/bin/{command}" if command == "supervisorctl" else None,
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime/restart")

    assert response.status_code == 200
    data = response.json()
    assert data["adapter"] == "supervisor"
    assert data["environment"] == "supervised"
    assert data["executable"] is True
    assert data["manual_required"] is False
    assert data["command"] == "supervisorctl restart channel-vault"
    assert data["command_available"] is True
    assert data["setup_hints"] == []


@pytest.mark.asyncio
async def test_runtime_restart_adapter_blocks_execute_when_command_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "")
    monkeypatch.setattr("app.config.settings.restart_adapter", "systemd")
    monkeypatch.setattr("app.config.settings.restart_adapter_execute", True)
    monkeypatch.setattr("app.config.settings.restart_service_name", "channel-vault")
    monkeypatch.setattr("app.services.runtime_settings.which", lambda command: None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime/restart")

    assert response.status_code == 200
    data = response.json()
    assert data["adapter"] == "systemd"
    assert data["executable"] is False
    assert data["manual_required"] is True
    assert data["command_available"] is False
    assert "systemctl is not available" in data["reason"]
    assert "systemctl is not available to the backend process" in data["setup_hints"]
    assert "CVN_RESTART_SERVICE_NAME=channel-vault" in data["env_lines"]


@pytest.mark.asyncio
async def test_runtime_restart_adapter_supports_synology_package_command(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "")
    monkeypatch.setattr("app.config.settings.restart_adapter", "synology-package")
    monkeypatch.setattr("app.config.settings.restart_adapter_execute", False)
    monkeypatch.setattr("app.config.settings.restart_service_name", "ChannelVault")
    monkeypatch.setattr(
        "app.services.runtime_settings.which",
        lambda command: f"/usr/bin/{command}" if command == "synopkg" else None,
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime/restart")

    assert response.status_code == 200
    data = response.json()
    assert data["adapter"] == "synology-package"
    assert data["environment"] == "synology-nas"
    assert data["command"] == "synopkg restart ChannelVault"
    assert data["executable"] is False
    assert data["manual_required"] is True
    assert data["command_available"] is True
    assert data["setup_hints"] == ["set CVN_RESTART_ADAPTER_EXECUTE=true after validating the command"]
    assert "CVN_RESTART_ADAPTER=synology-package" in data["env_lines"]
    assert "CVN_RESTART_SERVICE_NAME=ChannelVault" in data["env_lines"]


@pytest.mark.asyncio
async def test_runtime_restart_adapter_supports_qnap_package_script(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.restart_hook_command", "")
    monkeypatch.setattr("app.config.settings.restart_adapter", "qnap-package")
    monkeypatch.setattr("app.config.settings.restart_adapter_execute", True)
    monkeypatch.setattr("app.config.settings.restart_service_name", "ChannelVault")
    monkeypatch.setattr(
        "app.services.runtime_settings._qnap_package_command_available",
        lambda *, service_name: service_name == "ChannelVault",
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/settings/runtime/restart")

    assert response.status_code == 200
    data = response.json()
    assert data["adapter"] == "qnap-package"
    assert data["environment"] == "qnap-nas"
    assert data["command"] == "/etc/init.d/ChannelVault.sh restart"
    assert data["executable"] is True
    assert data["manual_required"] is False
    assert data["command_available"] is True
    assert data["setup_hints"] == []
    assert "CVN_RESTART_ADAPTER=qnap-package" in data["env_lines"]


@pytest.mark.asyncio
async def test_runtime_settings_apply_writes_managed_env(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    monkeypatch.setattr("app.config.settings.runtime_env_file", str(tmp_path / ".env.runtime"))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.patch(
            "/api/settings/runtime",
            json={
                "download_worker_enabled": True,
                "download_worker_scheduler_interval_seconds": 120,
                "ytdlp_binary": "yt-dlp",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["applied"] is True
    assert data["restart_required"] is True
    assert "CVN_DOWNLOAD_WORKER_ENABLED" in data["changed_keys"]
    env_text = (tmp_path / ".env.runtime").read_text(encoding="utf-8")
    assert "CVN_DOWNLOAD_WORKER_ENABLED=true" in env_text
    assert "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS=120" in env_text
    assert data["runtime"]["pending_restart"] is True
    assert any(item["key"] == "CVN_DOWNLOAD_WORKER_ENABLED" for item in data["runtime"]["pending_overrides"])


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
    assert coverage.json()["missing"] == 17

    assert missing.status_code == 200
    assert missing.json()[0]["source_state"] == "available"

    assert removed.status_code == 200
    assert removed.json() == []

    assert cadence.status_code == 200
    assert cadence.json()["typical_upload_dow"] == 3

    assert layout.status_code == 200
    assert "video.info.json" in layout.json()["sidecars"]

    assert imports.status_code == 200
    assert imports.json()[0]["id"] == "google-takeout"


@pytest.mark.asyncio
async def test_channel_source_normalization_accepts_handle_share_and_id() -> None:
    transport = ASGITransport(app=app)
    cases = [
        (
            "https://youtube.com/@wingnut987s4?si=LZr7f3vNJZsuoRo1",
            "handle",
            "@wingnut987s4",
            "https://www.youtube.com/@wingnut987s4",
            True,
        ),
        (
            "UCmLADXQtWVuzOnOK5TNrWaw",
            "channel_id",
            "UCmLADXQtWVuzOnOK5TNrWaw",
            "https://www.youtube.com/channel/UCmLADXQtWVuzOnOK5TNrWaw",
            False,
        ),
        (
            "https://www.youtube.com/@wingnut987s4",
            "handle",
            "@wingnut987s4",
            "https://www.youtube.com/@wingnut987s4",
            False,
        ),
    ]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for raw, identifier_type, identifier, canonical_url, tracking_removed in cases:
            response = await client.post("/api/channels/_normalize", json={"value": raw})
            assert response.status_code == 200
            data = response.json()
            assert data["source_type"] == "channel"
            assert data["identifier_type"] == identifier_type
            assert data["identifier"] == identifier
            assert data["canonical_url"] == canonical_url
            assert data["probe_url"] == canonical_url
            assert data["tracking_query_removed"] is tracking_removed
