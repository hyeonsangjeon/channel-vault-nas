"""Tests for redacted public-alpha support bundle export."""

import json
from datetime import UTC, datetime
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
    MetadataSyncTick,
    StorageChannelPressureSnapshot,
    StoragePressureSnapshot,
    SyncJob,
    Video,
)


@pytest.mark.asyncio
async def test_support_bundle_redacts_sensitive_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    await _clear_archive_tables()
    archive_root = tmp_path / "private archive"
    metadata_root = tmp_path / "private metadata"
    archive_root.mkdir()
    metadata_root.mkdir()
    monkeypatch.setattr(settings, "download_dir", str(archive_root))
    monkeypatch.setattr(settings, "metadata_dir", str(metadata_root))
    monkeypatch.setattr(settings, "runtime_env_file", str(tmp_path / ".env.runtime"))
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{tmp_path / 'private.db'}")
    monkeypatch.setattr(settings, "auth_token", "super-secret-token")
    monkeypatch.setattr(settings, "app_host", "0.0.0.0")
    now = datetime(2026, 6, 6, 10, 0, tzinfo=UTC)

    media_dir = archive_root / "channels" / "@secret [UC_SECRET]" / "2026" / "Secret Clip [abc]"
    media_dir.mkdir(parents=True)
    media_path = media_dir / "video.mp4"
    media_path.write_bytes(b"media")

    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@secret",
            external_id="UC_SECRET",
            handle="@secret",
            title="Secret Channel",
            description="private description",
            thumbnail_url="https://example.test/thumb.jpg",
            status="active",
            source_video_count=1,
            archived_count=0,
            missing_count=1,
            created_at=now,
            updated_at=now,
        )
        session.add(channel)
        await session.flush()
        session.add(
            ChannelPolicy(
                channel_id=channel.id,
                auto_download=True,
                max_quality="720p",
                audio_only=False,
                subtitles_enabled=True,
                subtitle_languages=["ko"],
                retention_policy="keep",
                worker_paused=False,
            )
        )
        video = Video(
            channel_id=channel.id,
            external_id="abc",
            title="Secret Clip",
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
            info_json_path=str(media_dir / "video.info.json"),
            discovered_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(video)
        await session.flush()
        session.add(
            MediaFile(
                video_id=video.id,
                relative_path="channels/@secret [UC_SECRET]/2026/Secret Clip [abc]/video.mp4",
                filename="video.mp4",
                size_bytes=5,
                container="mp4",
                video_codec="h264",
                audio_codec="aac",
                fps=30,
                width=1280,
                height=720,
                duration_seconds=60,
                info_json_path=str(media_dir / "video.info.json"),
                nfo_path=None,
                thumbnail_path=None,
                checksum=None,
                created_at=now,
            )
        )
        session.add(
            DownloadJob(
                video_id=video.id,
                status="failed",
                progress=0,
                quality="720p",
                priority=80,
                preflight_status="review",
                estimated_bytes=1000,
                error_message=f"failed at {media_path}",
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            DownloadSchedulerTick(
                trigger="manual",
                status="failed",
                scheduler_enabled=True,
                worker_enabled=True,
                interval_seconds=300,
                limit=1,
                started_count=1,
                completed_count=0,
                failed_count=1,
                skipped_reason=None,
                error_message=f"token=super-secret-token path={media_path}",
                started_at=now,
                completed_at=now,
                created_at=now,
            )
        )
        session.add(
            MetadataSyncTick(
                trigger="manual",
                status="completed",
                scheduler_enabled=True,
                interval_seconds=900,
                limit=1,
                due_channel_count=1,
                synced_count=1,
                failed_count=0,
                videos_seen_count=1,
                videos_created_count=0,
                videos_enriched_count=0,
                candidates_created_count=0,
                started_at=now,
                completed_at=now,
                created_at=now,
            )
        )
        session.add(
            ArchiveEventLog(
                type="download.worker.failed",
                data={
                    "token": "super-secret-token",
                    "archive_path": str(media_path),
                    "source_url": "https://www.youtube.com/watch?v=abc",
                    "command_preview": f"yt-dlp -P {media_dir} https://www.youtube.com/watch?v=abc",
                    "video_title": "Secret Clip",
                    "status": "failed",
                    "count": 1,
                },
                occurred_at=now,
                created_at=now,
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": "Bearer super-secret-token"},
    ) as client:
        response = await client.get("/api/ops/support-bundle")

    assert response.status_code == 200
    data = response.json()
    dumped = json.dumps(data, ensure_ascii=False)
    assert data["kind"] == "channel_vault_support_bundle"
    assert data["redaction"]["safe_for_public_issue"] is True
    assert data["app"]["auth_enabled"] is True
    assert data["app"]["download_dir"] == "<archive_root>"
    assert data["counts"]["channels"] == 1
    assert data["counts"]["download_jobs_by_status"]["failed"] == 1
    assert data["queue"]["failed_count"] == 1
    assert data["recent_events"][0]["data"]["token"] == "<secret:redacted>"
    assert data["recent_events"][0]["data"]["archive_path"] == "<path:redacted>"
    assert data["recent_events"][0]["data"]["source_url"] == "<content:redacted>"
    assert data["recent_events"][0]["data"]["command_preview"] == "<command:redacted>"
    assert str(tmp_path) not in dumped
    assert "super-secret-token" not in dumped
    assert "https://www.youtube.com" not in dumped
    assert "Secret Channel" not in dumped
    assert "Secret Clip" not in dumped


async def _clear_archive_tables() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(ArchiveEventLog))
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadSchedulerTick))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(MetadataSyncTick))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.execute(delete(StorageChannelPressureSnapshot))
        await session.execute(delete(StoragePressureSnapshot))
        await session.commit()
