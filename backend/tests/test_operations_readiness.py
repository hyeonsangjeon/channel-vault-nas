"""Tests for the operator readiness mission board."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

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
    MediaFile,
    StorageChannelPressureSnapshot,
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
    monkeypatch.setattr(settings, "auth_token", "")
    monkeypatch.setattr(settings, "app_host", "0.0.0.0")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    data = response.json()
    mission_ids = {mission["id"] for mission in data["missions"]}
    assert data["stage"] == "setup"
    assert data["score"] < 80
    assert "register_first_channel" in mission_ids
    assert "enable_access_token" in mission_ids
    assert "capture_pressure_snapshot" in mission_ids
    assert {metric["key"] for metric in data["metrics"]} >= {"channels", "coverage", "security", "storage_pressure"}
    assert next(metric for metric in data["metrics"] if metric["key"] == "security")["raw_value"] == 0
    assert "auth_token_disabled" in data["warnings"]


@pytest.mark.asyncio
async def test_operations_readiness_accepts_protected_public_bind(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    monkeypatch.setattr(settings, "auth_token", "ops-token")
    monkeypatch.setattr(settings, "app_host", "0.0.0.0")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers={"Authorization": "Bearer ops-token"}) as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    data = response.json()
    mission_ids = {mission["id"] for mission in data["missions"]}
    assert "enable_access_token" not in mission_ids
    assert next(metric for metric in data["metrics"] if metric["key"] == "security")["raw_value"] == 1
    assert "auth_token_disabled" not in data["warnings"]


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
        failed_job = DownloadJob(
            video_id=video.id,
            status="failed",
            progress=0,
            quality="1080p",
            priority=70,
            preflight_status="review",
            estimated_bytes=1000,
            error_message="test failure",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(failed_job)
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
    missions_by_id = {mission["id"]: mission for mission in data["missions"]}
    assert data["stage"] in {"attention", "ready"}
    assert "recover_storage_drift" in mission_ids
    assert "quarantine_sidecars" in mission_ids
    assert "clear_failed_downloads" in mission_ids
    assert "arm_worker" in mission_ids
    assert "resume_paused_channels" in mission_ids
    assert missions_by_id["recover_storage_drift"]["target_path"].endswith("video.mp4")
    assert missions_by_id["recover_storage_drift"]["target_kind"] == "unindexed_media"
    assert missions_by_id["clear_failed_downloads"]["target_kind"] == "download_job"
    assert missions_by_id["clear_failed_downloads"]["target_channel_id"] == channel.id
    assert missions_by_id["resume_paused_channels"]["target_kind"] == "channel_policy"
    assert missions_by_id["resume_paused_channels"]["target_channel_id"] == channel.id
    assert next(metric for metric in data["metrics"] if metric["key"] == "drift")["raw_value"] == 1
    assert next(metric for metric in data["metrics"] if metric["key"] == "orphans")["raw_value"] == 1


@pytest.mark.asyncio
async def test_operations_readiness_surfaces_rapid_channel_growth(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    now = datetime(2026, 6, 3, 7, 0, tzinfo=UTC)

    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@growth",
            external_id="UC_GROWTH",
            handle="@growth",
            title="Growth Lab",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=0,
            archived_count=0,
            missing_count=0,
            created_at=now,
            updated_at=now,
        )
        session.add(channel)
        await session.flush()
        for days_ago, channel_bytes in ((5, 1_000), (0, 2_000)):
            scanned_at = now - timedelta(days=days_ago)
            snapshot = StoragePressureSnapshot(
                root=str(tmp_path),
                archive_bytes=channel_bytes,
                used_bytes=channel_bytes,
                free_bytes=10_000,
                total_bytes=12_000,
                pressure_percent=20,
                file_count=1,
                dir_count=1,
                channel_count=1,
                scanned_at=scanned_at,
                created_at=scanned_at,
            )
            session.add(snapshot)
            await session.flush()
            session.add(
                StorageChannelPressureSnapshot(
                    snapshot_id=snapshot.id,
                    root=str(tmp_path),
                    channel_relative_path="channels/@growth [UC_GROWTH]",
                    title="Growth Lab",
                    bytes=channel_bytes,
                    file_count=1,
                    media_count=1,
                    sidecar_count=0,
                    orphan_sidecar_count=0,
                    video_folder_count=1,
                    pressure_score=20,
                    scanned_at=scanned_at,
                    created_at=scanned_at,
                )
            )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    missions_by_id = {mission["id"]: mission for mission in response.json()["missions"]}
    assert "review_channel_growth" in missions_by_id
    assert missions_by_id["review_channel_growth"]["target_kind"] == "channel_storage_growth"
    assert missions_by_id["review_channel_growth"]["target_channel_id"] == channel.id
    assert missions_by_id["review_channel_growth"]["target_path"] == "channels/@growth [UC_GROWTH]"
    assert missions_by_id["review_channel_growth"]["primary_value"] == "+1000 B"
    assert missions_by_id["review_channel_growth"]["secondary_value"] == "100.0%"


@pytest.mark.asyncio
async def test_operations_readiness_surfaces_runtime_restart_failures(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    now = datetime(2026, 6, 3, 8, 0, tzinfo=UTC)

    async with AsyncSessionLocal() as session:
        session.add(
            ArchiveEventLog(
                type="runtime.restart.failed",
                data={
                    "adapter": "synology-package",
                    "message": "Restart command failed.",
                    "reason": "operator requested runtime restart after env apply",
                },
                occurred_at=now,
                created_at=now,
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    missions_by_id = {mission["id"]: mission for mission in response.json()["missions"]}
    assert missions_by_id["resolve_runtime_restart"]["severity"] == "critical"
    assert missions_by_id["resolve_runtime_restart"]["status"] == "action"
    assert missions_by_id["resolve_runtime_restart"]["action_kind"] == "runtime"
    assert missions_by_id["resolve_runtime_restart"]["primary_value"] == "synology-package"
    assert missions_by_id["resolve_runtime_restart"]["target_kind"] == "runtime.restart.failed"


@pytest.mark.asyncio
async def test_operations_readiness_coverage_ignores_stale_media_rows(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    monkeypatch.setattr(settings, "download_worker_enabled", True)
    now = datetime(2026, 6, 3, 9, 0, tzinfo=UTC)

    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@stale",
            external_id="UC_STALE",
            handle="@stale",
            title="Stale Lab",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=1,
            archived_count=1,
            missing_count=0,
            created_at=now,
            updated_at=now,
        )
        session.add(channel)
        await session.flush()
        video = Video(
            channel_id=channel.id,
            external_id="stale01",
            title="Stale clip",
            description=None,
            published_at=now,
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
            discovered_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(video)
        await session.flush()
        session.add(
            MediaFile(
                video_id=video.id,
                relative_path="channels/@stale [UC_STALE]/2026/Stale clip [stale01]/video.mp4",
                filename="video.mp4",
                size_bytes=120_000_000,
                container="mp4",
                video_codec="h264",
                audio_codec="aac",
                fps=30.0,
                width=1920,
                height=1080,
                duration_seconds=60,
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/readiness")

    assert response.status_code == 200
    data = response.json()
    coverage_metric = next(metric for metric in data["metrics"] if metric["key"] == "coverage")
    # The stale MediaFile row points at a file that does not exist on disk, so it
    # must not be reported as archived/healthy coverage.
    assert coverage_metric["raw_value"] == 0.0
    assert coverage_metric["tone"] != "good"
    mission_ids = {mission["id"] for mission in data["missions"]}
    assert "queue_missing_videos" in mission_ids
    assert "all_clear" not in mission_ids


async def _clear_archive_tables() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(ArchiveEventLog))
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.execute(delete(StorageChannelPressureSnapshot))
        await session.execute(delete(StoragePressureSnapshot))
        await session.commit()
