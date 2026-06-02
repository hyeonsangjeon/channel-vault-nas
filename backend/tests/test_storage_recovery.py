"""Tests for DB backup and sidecar recovery contracts."""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.config import settings
from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import (
    ArchiveEventLog,
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadWorkerRun,
    MediaFile,
    StoragePressureSnapshot,
    SyncJob,
    Video,
)
from app.services.archive_rescan import apply_rescan_plan, apply_rescan_target, build_rescan_plan
from app.services.event_bus import event_bus
from app.services.library_index import list_library_files
from app.services.media_probe import MediaProbe
from app.services.storage_drift import prune_missing_media_index, recover_unindexed_media
from app.services.storage_guard import backup_sqlite_database, sqlite_path_from_url
from app.services.storage_orphans import (
    QUARANTINE_PURGE_CONFIRMATION,
    list_quarantined_sidecars,
    purge_quarantined_sidecars,
    quarantine_orphan_sidecar,
    restore_quarantined_sidecar,
)
from app.services.storage_pressure import (
    build_storage_pressure_trend,
    capture_storage_pressure_snapshot,
)
from app.services.storage_scanner import build_storage_scan, storage_scan_export_rows


def test_sqlite_path_from_url_resolves_relative_path(tmp_path: Path) -> None:
    resolved = sqlite_path_from_url("sqlite+aiosqlite:///./metadata/app.db", cwd=tmp_path)

    assert resolved == tmp_path / "metadata" / "app.db"


def test_backup_sqlite_database_creates_timestamped_copy(tmp_path: Path) -> None:
    metadata_dir = tmp_path / "metadata"
    metadata_dir.mkdir()
    database_path = metadata_dir / "app.db"
    database_path.write_text("sqlite bytes", encoding="utf-8")

    backup_path = backup_sqlite_database(
        f"sqlite+aiosqlite:///{database_path}",
        metadata_dir,
        now=datetime(2026, 5, 30, 11, 30, 0, tzinfo=UTC),
    )

    assert backup_path == metadata_dir / "db-backups" / "app.backup-20260530-113000.db"
    assert backup_path.read_text(encoding="utf-8") == "sqlite bytes"


def test_archive_rescan_plan_discovers_video_info_sidecars(tmp_path: Path) -> None:
    video_dir = (
        tmp_path
        / "channels"
        / "@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]"
        / "2022"
        / "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]"
    )
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        """
        {
          "id": "6lXl1hkEgcA",
          "title": "HEAVY BAG DRILLS",
          "channel": "wingnut987S",
          "channel_id": "UCmLADXQtWVuzOnOK5TNrWaw",
          "upload_date": "20220520"
        }
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "thumbnail.jpg").write_text("thumbnail", encoding="utf-8")
    (video_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")
    (video_dir / "video.nfo").write_text("nfo", encoding="utf-8")

    plan = build_rescan_plan(tmp_path)

    assert plan.candidate_count == 1
    assert plan.warnings == []
    candidate = plan.candidates[0]
    assert candidate.video_id == "6lXl1hkEgcA"
    assert candidate.channel_id == "UCmLADXQtWVuzOnOK5TNrWaw"
    assert candidate.title == "HEAVY BAG DRILLS"
    assert candidate.media_files == [
        "channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022/"
        "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]/video.mp4"
    ]
    assert candidate.nfo is not None


def test_archive_rescan_plan_ignores_quarantine_sidecars(tmp_path: Path) -> None:
    archive_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Signal clip [sig01]"
    _write_sidecar_video(archive_dir, video_id="sig01", title="Signal clip")
    quarantine_dir = (
        tmp_path
        / ".channel-vault-quarantine"
        / "20260601-191000-000000"
        / "channels"
        / "signal [UC_SIGNAL]"
        / "2026"
        / "quarantined-json"
    )
    _write_sidecar_video(quarantine_dir, video_id="quarantine01", title="Quarantined JSON")

    plan = build_rescan_plan(tmp_path)

    assert plan.candidate_count == 1
    assert plan.candidates[0].video_id == "sig01"


def test_storage_scan_summarizes_real_archive_and_orphan_sidecars(tmp_path: Path) -> None:
    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Signal clip [sig01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "video.info.json").write_text("{}", encoding="utf-8")
    orphan_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "orphan"
    orphan_dir.mkdir(parents=True)
    (orphan_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")

    indexed_path = "channels/signal [UC_SIGNAL]/2026/Signal clip [sig01]/video.mp4"
    missing_index_path = "channels/signal [UC_SIGNAL]/2026/missing-from-disk/video.mp4"
    scan = build_storage_scan(tmp_path, indexed_media_paths={indexed_path, missing_index_path})

    assert scan.volume.exists is True
    assert scan.volume.file_count == 3
    assert scan.volume.archive_bytes > 0
    assert scan.channels[0].relative_path == "channels/signal [UC_SIGNAL]"
    assert scan.channels[0].media_count == 1
    assert scan.channels[0].sidecar_count == 2
    assert scan.channels[0].orphan_sidecar_count == 1
    assert scan.top_extensions[0].count >= 1
    assert scan.orphan_sidecars[0].kind == "subtitle"
    assert any(node.relative_path == "channels" for node in scan.folder_tree)
    assert scan.drift.unindexed_media_count == 0
    assert scan.drift.indexed_missing_count == 1
    assert scan.drift.indexed_missing[0].relative_path == missing_index_path
    export_rows = storage_scan_export_rows(scan)
    assert export_rows[0]["section"] == "volume"
    assert any(row.get("section") == "orphan_sidecar" and row.get("kind") == "subtitle" for row in export_rows)
    assert any(row.get("section") == "drift" and row.get("relative_path") == missing_index_path for row in export_rows)

    unindexed_scan = build_storage_scan(tmp_path, indexed_media_paths=set())
    assert unindexed_scan.drift.unindexed_media_count == 1
    assert unindexed_scan.drift.unindexed_media[0].relative_path == indexed_path


@pytest.mark.asyncio
async def test_storage_pressure_snapshots_track_growth(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(StoragePressureSnapshot))
        await session.commit()

    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Signal clip [sig01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.mp4").write_bytes(b"0" * 1024)

    first_scan = build_storage_scan(tmp_path)
    first_scan.scanned_at = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
    async with AsyncSessionLocal() as session:
        first = await capture_storage_pressure_snapshot(db=session, scan=first_scan)
        await session.commit()

    (video_dir / "video-2.mp4").write_bytes(b"1" * 2048)
    second_scan = build_storage_scan(tmp_path)
    second_scan.scanned_at = datetime(2026, 6, 2, 0, 0, tzinfo=UTC)
    async with AsyncSessionLocal() as session:
        second = await capture_storage_pressure_snapshot(db=session, scan=second_scan)
        trend = await build_storage_pressure_trend(db=session, limit=10)
        await session.commit()

    assert first.archive_bytes == 1024
    assert second.archive_bytes == 3072
    assert trend.latest is not None
    assert trend.previous is not None
    assert trend.delta_archive_bytes == 2048
    assert trend.daily_growth_bytes == 2048
    assert trend.runway_label != ""
    assert [snapshot.id for snapshot in trend.snapshots] == [first.id, second.id]


@pytest.mark.asyncio
async def test_archive_rescan_apply_indexes_sidecars_into_db(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        await session.commit()

    video_dir = (
        tmp_path
        / "channels"
        / "@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]"
        / "2022"
        / "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]"
    )
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        """
        {
          "id": "6lXl1hkEgcA",
          "title": "HEAVY BAG DRILLS",
          "channel": "wingnut987S",
          "channel_id": "UCmLADXQtWVuzOnOK5TNrWaw",
          "upload_date": "20220520"
        }
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "thumbnail.jpg").write_text("thumbnail", encoding="utf-8")
    (video_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")

    async def fake_probe(path: Path) -> MediaProbe:
        assert path.name == "video.mp4"
        return MediaProbe(
            container="mp4",
            video_codec="h264",
            audio_codec="aac",
            fps=29.97,
            width=1920,
            height=1080,
            duration_seconds=61,
        )

    monkeypatch.setattr("app.services.archive_rescan.probe_media_file", fake_probe)

    async with AsyncSessionLocal() as session:
        result = await apply_rescan_plan(session, tmp_path)
        await session.commit()

    assert result.candidates_seen == 1
    assert result.channels_created == 1
    assert result.videos_created == 1
    assert result.media_files_indexed == 1
    assert result.thumbnails_indexed == 1
    assert result.subtitles_indexed == 1

    async with AsyncSessionLocal() as session:
        channel = await session.scalar(select(Channel))
        video = await session.scalar(select(Video))
        media = await session.scalar(select(MediaFile))

    assert channel is not None
    assert channel.archived_count == 1
    assert channel.missing_count == 0
    assert video is not None
    assert video.external_id == "6lXl1hkEgcA"
    assert video.duration_seconds == 61
    assert media is not None
    assert media.size_bytes == 5
    assert media.container == "mp4"
    assert media.video_codec == "h264"
    assert media.audio_codec == "aac"
    assert media.fps == 29.97
    assert media.width == 1920
    assert media.height == 1080
    assert media.duration_seconds == 61
    assert media.thumbnail_path is not None

    async with AsyncSessionLocal() as session:
        library_files = await list_library_files(db=session, video_id=video.id, download_dir=tmp_path)

    assert library_files is not None
    assert library_files[0].exists is True
    assert library_files[0].integrity_state == "complete"
    assert library_files[0].info_json_exists is True
    assert library_files[0].thumbnail_exists is True
    assert {sidecar.kind for sidecar in library_files[0].sidecars} == {"info_json", "thumbnail", "subtitle"}


@pytest.mark.asyncio
async def test_storage_drift_actions_recover_and_prune_indexes(tmp_path: Path) -> None:
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
        await session.commit()

    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Signal clip [sig01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        """
        {
          "id": "sig01",
          "title": "Signal clip",
          "channel": "Signal",
          "channel_id": "UC_SIGNAL",
          "upload_date": "20260601"
        }
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "thumbnail.jpg").write_text("thumb", encoding="utf-8")
    (video_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")
    (video_dir / "video.nfo").write_text("nfo", encoding="utf-8")

    relative_media = "channels/signal [UC_SIGNAL]/2026/Signal clip [sig01]/video.mp4"
    async with AsyncSessionLocal() as session:
        dry_recovered = await recover_unindexed_media(
            db=session,
            download_dir=tmp_path,
            relative_path=relative_media,
            dry_run=True,
        )
        recovered = await recover_unindexed_media(
            db=session,
            download_dir=tmp_path,
            relative_path=relative_media,
        )
        await session.commit()

    assert dry_recovered.applied is False
    assert dry_recovered.planned_media_files == 1
    assert dry_recovered.planned_info_json == 1
    assert dry_recovered.planned_subtitles == 1
    assert dry_recovered.planned_thumbnails == 1
    assert dry_recovered.planned_nfo == 1
    assert recovered.applied is True
    assert recovered.rescan is not None
    assert recovered.rescan.media_files_indexed == 1

    missing_relative = "channels/signal [UC_SIGNAL]/2026/missing/video.mp4"
    async with AsyncSessionLocal() as session:
        video = (await session.execute(select(Video).where(Video.external_id == "sig01"))).scalar_one()
        session.add(
            MediaFile(
                video_id=video.id,
                relative_path=missing_relative,
                filename="video.mp4",
                size_bytes=100,
                container="mp4",
            )
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        dry_run = await prune_missing_media_index(
            db=session,
            download_dir=tmp_path,
            relative_path=missing_relative,
            dry_run=True,
        )
        pruned = await prune_missing_media_index(
            db=session,
            download_dir=tmp_path,
            relative_path=missing_relative,
        )
        await session.commit()
        remaining = await session.scalar(select(func.count(MediaFile.id)).where(MediaFile.relative_path == missing_relative))

    assert dry_run.applied is False
    assert dry_run.deleted_media_files == 1
    assert pruned.applied is True
    assert pruned.deleted_media_files == 1
    assert remaining == 0


@pytest.mark.asyncio
async def test_storage_drift_action_endpoints_recover_and_prune_indexes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(StoragePressureSnapshot))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.execute(delete(ArchiveEventLog))
        await session.commit()

    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Endpoint clip [endpoint01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        """
        {
          "id": "endpoint01",
          "title": "Endpoint clip",
          "channel": "Signal",
          "channel_id": "UC_SIGNAL",
          "upload_date": "20260601"
        }
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
    (video_dir / "thumbnail.jpg").write_text("thumb", encoding="utf-8")
    (video_dir / "video.ko.srt").write_text("subtitle", encoding="utf-8")
    relative_media = "channels/signal [UC_SIGNAL]/2026/Endpoint clip [endpoint01]/video.mp4"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        recovered = await client.post(
            "/api/storage/drift/recover-unindexed",
            json={"relative_path": relative_media, "dry_run": True},
        )
        applied_recovery = await client.post(
            "/api/storage/drift/recover-unindexed",
            json={"relative_path": relative_media},
        )
        scan = await client.get("/api/storage/scan")

    assert recovered.status_code == 200
    recovered_data = recovered.json()
    assert recovered_data["applied"] is False
    assert recovered_data["planned_media_files"] == 1
    assert recovered_data["planned_subtitles"] == 1
    assert recovered_data["planned_thumbnails"] == 1
    assert applied_recovery.status_code == 200
    assert applied_recovery.json()["applied"] is True
    assert applied_recovery.json()["rescan"]["media_files_indexed"] == 1
    assert scan.status_code == 200
    assert scan.json()["drift"]["unindexed_media_count"] == 0

    missing_relative = "channels/signal [UC_SIGNAL]/2026/missing/video.mp4"
    async with AsyncSessionLocal() as session:
        video = (await session.execute(select(Video).where(Video.external_id == "endpoint01"))).scalar_one()
        session.add(
            MediaFile(
                video_id=video.id,
                relative_path=missing_relative,
                filename="video.mp4",
                size_bytes=100,
                container="mp4",
            )
        )
        await session.commit()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dry_run = await client.post(
            "/api/storage/drift/prune-missing-index",
            json={"relative_path": missing_relative, "dry_run": True},
        )
        pruned = await client.post(
            "/api/storage/drift/prune-missing-index",
            json={"relative_path": missing_relative},
        )

    assert dry_run.status_code == 200
    assert dry_run.json()["applied"] is False
    assert dry_run.json()["deleted_media_files"] == 1
    assert pruned.status_code == 200
    assert pruned.json()["applied"] is True
    assert pruned.json()["deleted_media_files"] == 1


@pytest.mark.asyncio
async def test_storage_pressure_snapshot_endpoint(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(StoragePressureSnapshot))
        await session.commit()

    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    video_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Endpoint pressure [pressure01]"
    video_dir.mkdir(parents=True)
    (video_dir / "video.mp4").write_bytes(b"media")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        empty = await client.get("/api/storage/pressure/trend")
        captured = await client.post("/api/storage/pressure/snapshots")
        await event_bus.flush_persistence()
        trend = await client.get("/api/storage/pressure/trend")

    assert empty.status_code == 200
    assert empty.json()["snapshots"] == []
    assert captured.status_code == 200
    assert captured.json()["latest"]["archive_bytes"] == len("media")
    assert captured.json()["latest"]["file_count"] == 1
    assert trend.status_code == 200
    assert trend.json()["latest"]["archive_label"] == "5 B"


@pytest.mark.asyncio
async def test_storage_orphan_sidecar_quarantine_preview_and_apply(tmp_path: Path) -> None:
    orphan_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "subtitle-only"
    orphan_dir.mkdir(parents=True)
    orphan_path = orphan_dir / "video.ko.srt"
    orphan_path.write_text("subtitle", encoding="utf-8")
    relative_path = "channels/signal [UC_SIGNAL]/2026/subtitle-only/video.ko.srt"

    before_scan = build_storage_scan(tmp_path)
    assert before_scan.orphan_sidecars[0].relative_path == relative_path

    dry_run = await quarantine_orphan_sidecar(
        download_dir=tmp_path,
        relative_path=relative_path,
        dry_run=True,
    )
    assert dry_run.applied is False
    assert dry_run.destination_relative_path is not None
    assert dry_run.destination_relative_path.endswith(relative_path)
    assert orphan_path.exists()

    applied = await quarantine_orphan_sidecar(
        download_dir=tmp_path,
        relative_path=relative_path,
        dry_run=False,
    )
    assert applied.applied is True
    assert applied.destination_relative_path is not None
    assert not orphan_path.exists()
    assert (tmp_path / applied.destination_relative_path).exists()

    after_scan = build_storage_scan(tmp_path)
    assert after_scan.orphan_sidecars == []


@pytest.mark.asyncio
async def test_storage_orphan_quarantine_list_and_restore(tmp_path: Path) -> None:
    orphan_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "subtitle-only"
    orphan_dir.mkdir(parents=True)
    orphan_path = orphan_dir / "video.ko.srt"
    orphan_path.write_text("subtitle", encoding="utf-8")
    relative_path = "channels/signal [UC_SIGNAL]/2026/subtitle-only/video.ko.srt"

    quarantined = await quarantine_orphan_sidecar(
        download_dir=tmp_path,
        relative_path=relative_path,
        dry_run=False,
    )
    assert quarantined.destination_relative_path is not None

    listed = list_quarantined_sidecars(download_dir=tmp_path)
    assert listed.count == 1
    assert listed.items[0].relative_path == quarantined.destination_relative_path
    assert listed.items[0].original_relative_path == relative_path
    assert listed.items[0].restore_blocked_reason is None

    dry_run = await restore_quarantined_sidecar(
        download_dir=tmp_path,
        quarantine_relative_path=quarantined.destination_relative_path,
        dry_run=True,
    )
    assert dry_run.applied is False
    assert dry_run.destination_relative_path == relative_path
    assert not orphan_path.exists()

    restored = await restore_quarantined_sidecar(
        download_dir=tmp_path,
        quarantine_relative_path=quarantined.destination_relative_path,
        dry_run=False,
    )
    assert restored.applied is True
    assert restored.destination_relative_path == relative_path
    assert orphan_path.exists()
    assert list_quarantined_sidecars(download_dir=tmp_path).count == 0
    assert build_storage_scan(tmp_path).orphan_sidecars[0].relative_path == relative_path


@pytest.mark.asyncio
async def test_storage_orphan_quarantine_purge_requires_confirmation(tmp_path: Path) -> None:
    old_sidecar = (
        tmp_path
        / ".channel-vault-quarantine"
        / "20260401-000000-000000"
        / "channels"
        / "signal [UC_SIGNAL]"
        / "2026"
        / "old-subtitle"
        / "video.ko.srt"
    )
    fresh_sidecar = (
        tmp_path
        / ".channel-vault-quarantine"
        / "20260530-000000-000000"
        / "channels"
        / "signal [UC_SIGNAL]"
        / "2026"
        / "fresh-subtitle"
        / "video.ko.srt"
    )
    old_sidecar.parent.mkdir(parents=True)
    fresh_sidecar.parent.mkdir(parents=True)
    old_sidecar.write_text("old subtitle", encoding="utf-8")
    fresh_sidecar.write_text("fresh subtitle", encoding="utf-8")

    dry_run = await purge_quarantined_sidecars(
        download_dir=tmp_path,
        min_age_days=30,
        dry_run=True,
        now=datetime(2026, 6, 1, tzinfo=UTC),
    )

    assert dry_run.applied is False
    assert dry_run.candidate_count == 1
    assert dry_run.retained_count == 1
    assert dry_run.planned_bytes == len("old subtitle")
    assert dry_run.items[0].relative_path.endswith("old-subtitle/video.ko.srt")
    assert old_sidecar.exists() is True

    blocked = await purge_quarantined_sidecars(
        download_dir=tmp_path,
        min_age_days=30,
        dry_run=False,
        confirm_text="DELETE",
        now=datetime(2026, 6, 1, tzinfo=UTC),
    )

    assert blocked.applied is False
    assert blocked.deleted_files == 0
    assert blocked.required_confirmation == QUARANTINE_PURGE_CONFIRMATION
    assert blocked.warnings[0].startswith('type "PURGE QUARANTINE"')
    assert old_sidecar.exists() is True

    applied = await purge_quarantined_sidecars(
        download_dir=tmp_path,
        min_age_days=30,
        dry_run=False,
        confirm_text=QUARANTINE_PURGE_CONFIRMATION,
        now=datetime(2026, 6, 1, tzinfo=UTC),
    )
    await event_bus.flush_persistence()

    assert applied.applied is True
    assert applied.deleted_files == 1
    assert applied.deleted_bytes == len("old subtitle")
    assert old_sidecar.exists() is False
    assert fresh_sidecar.exists() is True
    assert list_quarantined_sidecars(download_dir=tmp_path).count == 1


@pytest.mark.asyncio
async def test_storage_orphan_quarantine_endpoint_respects_dry_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    orphan_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "json-only"
    orphan_dir.mkdir(parents=True)
    orphan_path = orphan_dir / "video.info.json"
    orphan_path.write_text("{}", encoding="utf-8")
    relative_path = "channels/signal [UC_SIGNAL]/2026/json-only/video.info.json"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dry_run = await client.post(
            "/api/storage/orphans/quarantine",
            json={"relative_path": relative_path, "dry_run": True},
        )
        list_before_apply = await client.get("/api/storage/orphans/quarantine")

    assert dry_run.status_code == 200
    assert dry_run.json()["applied"] is False
    assert orphan_path.exists() is True
    assert list_before_apply.status_code == 200
    assert list_before_apply.json()["count"] == 0

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        applied = await client.post(
            "/api/storage/orphans/quarantine",
            json={"relative_path": relative_path, "dry_run": False},
        )
        list_after_apply = await client.get("/api/storage/orphans/quarantine")
        restore_preview = await client.post(
            "/api/storage/orphans/quarantine/restore",
            json={"quarantine_relative_path": applied.json()["destination_relative_path"], "dry_run": True},
        )
        scan = await client.get("/api/storage/scan")

    assert orphan_path.exists() is False
    assert applied.status_code == 200
    assert applied.json()["applied"] is True
    assert list_after_apply.status_code == 200
    assert list_after_apply.json()["count"] == 1
    assert restore_preview.status_code == 200
    assert restore_preview.json()["destination_relative_path"] == relative_path
    assert scan.json()["orphan_sidecars"] == []


@pytest.mark.asyncio
async def test_storage_orphan_quarantine_purge_endpoint(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    old_sidecar = (
        tmp_path
        / ".channel-vault-quarantine"
        / "20260401-000000-000000"
        / "channels"
        / "signal [UC_SIGNAL]"
        / "2026"
        / "json-only"
        / "video.info.json"
    )
    old_sidecar.parent.mkdir(parents=True)
    old_sidecar.write_text("{}", encoding="utf-8")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dry_run = await client.post(
            "/api/storage/orphans/quarantine/purge",
            json={"min_age_days": 30, "dry_run": True},
        )
        blocked = await client.post(
            "/api/storage/orphans/quarantine/purge",
            json={"min_age_days": 30, "dry_run": False, "confirm_text": "DELETE"},
        )
        applied = await client.post(
            "/api/storage/orphans/quarantine/purge",
            json={"min_age_days": 30, "dry_run": False, "confirm_text": QUARANTINE_PURGE_CONFIRMATION},
        )
        await event_bus.flush_persistence()
        listed = await client.get("/api/storage/orphans/quarantine")

    assert dry_run.status_code == 200
    assert dry_run.json()["candidate_count"] == 1
    assert dry_run.json()["required_confirmation"] == QUARANTINE_PURGE_CONFIRMATION
    assert blocked.status_code == 200
    assert blocked.json()["applied"] is False
    assert old_sidecar.exists() is False
    assert applied.status_code == 200
    assert applied.json()["applied"] is True
    assert applied.json()["deleted_files"] == 1
    assert listed.json()["count"] == 0


@pytest.mark.asyncio
async def test_archive_rescan_target_indexes_only_requested_video_folder(tmp_path: Path) -> None:
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
        await session.commit()

    target_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Target clip [target01]"
    stray_dir = tmp_path / "channels" / "signal [UC_SIGNAL]" / "2026" / "Stray clip [stray01]"
    _write_sidecar_video(target_dir, video_id="target01", title="Target clip")
    _write_sidecar_video(stray_dir, video_id="stray01", title="Stray clip")

    async with AsyncSessionLocal() as session:
        result = await apply_rescan_target(session, tmp_path, target_dir)
        await session.commit()

    assert result.candidates_seen == 1
    assert result.channels_created == 1
    assert result.videos_created == 1
    assert result.media_files_indexed == 1
    assert result.warnings == []

    async with AsyncSessionLocal() as session:
        videos = (await session.execute(select(Video).order_by(Video.external_id))).scalars().all()
        media_files = (await session.execute(select(MediaFile))).scalars().all()

    assert [video.external_id for video in videos] == ["target01"]
    assert len(media_files) == 1
    assert media_files[0].relative_path.endswith("Target clip [target01]/video.mp4")


@pytest.mark.asyncio
async def test_archive_rescan_target_accepts_worker_relative_path_with_root_prefix(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
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
        await session.commit()

    archive_root = tmp_path / "downfolder"
    target_dir = archive_root / "channels" / "signal [UC_SIGNAL]" / "2026" / "Target clip [target01]"
    _write_sidecar_video(target_dir, video_id="target01", title="Target clip")
    monkeypatch.chdir(tmp_path)

    async with AsyncSessionLocal() as session:
        result = await apply_rescan_target(session, archive_root, Path("downfolder") / target_dir.relative_to(archive_root))
        await session.commit()

    assert result.candidates_seen == 1
    assert result.media_files_indexed == 1
    assert result.warnings == []

    async with AsyncSessionLocal() as session:
        media_count = await session.scalar(select(func.count(MediaFile.id)))
        channel = await session.scalar(select(Channel).where(Channel.external_id == "UC_SIGNAL"))

    assert media_count == 1
    assert channel is not None
    assert channel.archived_count == 1
    assert channel.missing_count == 0


def _write_sidecar_video(video_dir: Path, *, video_id: str, title: str) -> None:
    video_dir.mkdir(parents=True)
    (video_dir / "video.info.json").write_text(
        f"""
        {{
          "id": "{video_id}",
          "title": "{title}",
          "channel": "Signal Lab",
          "channel_id": "UC_SIGNAL",
          "upload_date": "20260530"
        }}
        """,
        encoding="utf-8",
    )
    (video_dir / "video.mp4").write_text("media", encoding="utf-8")
