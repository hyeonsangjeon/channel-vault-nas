"""Tests for the operator readiness mission board."""

from datetime import UTC, datetime
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
    StoragePressureSnapshot,
    SyncJob,
    Video,
)


@pytest.mark.asyncio
async def test_operations_readiness_guides_empty_first_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    data = response.json()
    mission_ids = {mission["id"] for mission in data["missions"]}
    assert data["stage"] == "setup"
    assert data["score"] < 80
    assert "register_first_channel" in mission_ids
    assert "capture_pressure_snapshot" in mission_ids
    assert {metric["key"] for metric in data["metrics"]} >= {"channels", "coverage", "storage_pressure"}


@pytest.mark.asyncio
async def test_operations_readiness_detects_drift_sidecars_and_worker_lock(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    monkeypatch.setattr(settings, "download_worker_enabled", False)
    monkeypatch.setattr(settings, "download_worker_scheduler_enabled", False)
    monkeypatch.setattr(settings, "metadata_sync_scheduler_enabled", False)

    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Signal clip [sig01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.mp4").write_bytes(b"media")
    orphan_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "orphan"
    orphan_dir.mkdir(parents=True)
    (orphan_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")

    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@signal",
            external_id="UC_SIGNAL",
            handle="@signal",
            title="Signal",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=1,
            archived_count=0,
            missing_count=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(channel)
        await session.flush()
        session.add(
            ChannelPolicy(
                channel_id=channel.id,
                auto_download=True,
                max_quality="1080p",
                audio_only=False,
                subtitles_enabled=True,
                subtitle_languages=["ko"],
                retention_policy="keep",
                worker_paused=True,
                worker_pause_reason="test pause",
            )
        )
        video = Video(
            channel_id=channel.id,
            external_id="sig01",
            title="Signal clip",
            description=None,
            published_at=datetime.now(UTC),
            upload_date=None,
            duration_seconds=60,
            thumbnail_url=None,
            view_count=None,
            source_state="available",
            tags=None,
            categories=None,
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
            discovered_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(video)
        await session.flush()
        session.add(
            DownloadJob(
                video_id=video.id,
                status="queued",
                progress=0,
                quality="1080p",
                priority=80,
                preflight_status="ready",
                estimated_bytes=1000,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        session.add(
            StoragePressureSnapshot(
                root=str(tmp_path),
                archive_bytes=10,
                used_bytes=100,
                free_bytes=900,
                total_bytes=1000,
                pressure_percent=10,
                file_count=1,
                dir_count=1,
                channel_count=1,
                scanned_at=datetime.now(UTC),
                created_at=datetime.now(UTC),
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    data = response.json()
    mission_ids = {mission["id"] for mission in data["missions"]}
    assert data["stage"] in {"attention", "ready"}
    assert "recover_storage_drift" in mission_ids
    assert "quarantine_sidecars" in mission_ids
    assert "arm_worker" in mission_ids
    assert "resume_paused_channels" in mission_ids
    assert next(metric for metric in data["metrics"] if metric["key"] == "drift")["raw_value"] == 1
    assert next(metric for metric in data["metrics"] if metric["key"] == "orphans")["raw_value"] == 1


async def _clear_archive_tables() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.execute(delete(StoragePressureSnapshot))
        await session.commit()
