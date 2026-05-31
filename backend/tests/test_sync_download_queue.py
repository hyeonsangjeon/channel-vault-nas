"""Manual sync, scheduled metadata sync, and download queue API tests."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.config import settings
from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadWorkerRun,
    LibraryView,
    MediaFile,
    MetadataSyncTick,
    SyncJob,
    Video,
)
from app.schemas.source import ChannelProbeRequest
from app.services.download_worker import build_download_worker_plan
from app.services.metadata_scheduler import find_due_sync_channels, run_metadata_sync_scheduler_tick
from app.services.source_normalizer import normalize_source_input
from app.services.ytdlp_probe import build_probe_result


@pytest.mark.asyncio
async def test_manual_sync_creates_job_and_download_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(MetadataSyncTick))
        await session.execute(delete(SyncJob))
        await session.execute(delete(LibraryView))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()

    async def fake_initial_probe(payload: ChannelProbeRequest):
        return _probe_result(
            payload,
            entries=[
                {
                    "id": "6lXl1hkEgcA",
                    "title": "HEAVY BAG DRILLS",
                    "url": "https://www.youtube.com/watch?v=6lXl1hkEgcA",
                    "duration": 61,
                    "timestamp": 1653041065,
                    "upload_date": "20220520",
                }
            ],
        )

    async def fake_sync_probe(payload: ChannelProbeRequest):
        return _probe_result(
            payload,
            entries=[
                {
                    "id": "n5soSphTPnI",
                    "title": "BERT based datalake",
                    "url": "https://www.youtube.com/watch?v=n5soSphTPnI",
                    "duration": 600,
                    "timestamp": 1653127465,
                    "upload_date": "20220521",
                },
                {
                    "id": "6lXl1hkEgcA",
                    "title": "HEAVY BAG DRILLS",
                    "url": "https://www.youtube.com/watch?v=6lXl1hkEgcA",
                    "duration": 61,
                    "timestamp": 1653041065,
                    "upload_date": "20220520",
                },
            ],
        )

    monkeypatch.setattr("app.services.channel_registration.probe_channel_source", fake_initial_probe)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            "/api/channels",
            json={"value": "https://youtube.com/@wingnut987s4?si=LZr7f3vNJZsuoRo1"},
        )
        channel_id = created.json()["channel"]["id"]

        monkeypatch.setattr("app.services.channel_sync.probe_channel_source", fake_sync_probe)
        synced = await client.post(f"/api/channels/{channel_id}/sync", json={"max_quality": "720p"})
        detail = await client.get(f"/api/channels/{channel_id}")
        channel_settings = await client.patch(f"/api/channels/{channel_id}", json={"sync_interval_minutes": 120})
        videos = await client.get(f"/api/channels/{channel_id}/videos")
        candidates = await client.post(
            f"/api/channels/{channel_id}/downloads/candidates",
            json={"quality": "720p", "limit": 10},
        )
        first_video_id = videos.json()[0]["id"]
        queued = await client.post(f"/api/videos/{first_video_id}/download", json={"quality": "720p"})
        first_job_id = queued.json()["job"]["id"]
        cancelled = await client.post(f"/api/jobs/downloads/{first_job_id}/cancel")
        retried = await client.post(f"/api/jobs/downloads/{first_job_id}/retry")
        preflight = await client.get(f"/api/jobs/downloads/preflight?channel_id={channel_id}")
        worker_plan = await client.get(f"/api/jobs/downloads/worker/plan?channel_id={channel_id}")
        worker_run = await client.post(
            "/api/jobs/downloads/worker/run-once",
            json={"channel_id": channel_id, "limit": 2, "dry_run": True},
        )
        worker_runs = await client.get(f"/api/jobs/downloads/worker/runs?channel_id={channel_id}")
        bulk = await client.post(
            "/api/jobs/downloads/bulk",
            json={"job_ids": preflight.json()["ready_job_ids"], "action": "prioritize", "priority": 95},
        )
        async with AsyncSessionLocal() as session:
            session.add(
                MediaFile(
                    video_id=first_video_id,
                    relative_path="channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022/"
                    "2022-05-21 - BERT based datalake [n5soSphTPnI]/video.mp4",
                    filename="video.mp4",
                    size_bytes=512_000_000,
                    info_json_path="channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022/"
                    "2022-05-21 - BERT based datalake [n5soSphTPnI]/video.info.json",
                    thumbnail_path="channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022/"
                    "2022-05-21 - BERT based datalake [n5soSphTPnI]/thumbnail.jpg",
                    nfo_path="channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022/"
                    "2022-05-21 - BERT based datalake [n5soSphTPnI]/video.nfo",
                    container="mp4",
                    video_codec="h264",
                    audio_codec="aac",
                    fps=30.0,
                    width=1920,
                    height=1080,
                    duration_seconds=600,
                )
            )
            await session.commit()
        library = await client.get(f"/api/library?channel_id={channel_id}&query=BERT")
        library_integrity = await client.get(f"/api/library?channel_id={channel_id}&integrity=partial_sidecars")
        library_codec = await client.get(f"/api/library?channel_id={channel_id}&codec=h264%201080p")
        library_missing_sidecar = await client.get(f"/api/library?channel_id={channel_id}&missing_sidecar=subtitles")
        library_codec_empty = await client.get(f"/api/library?channel_id={channel_id}&codec=vp9")
        library_item = await client.get(f"/api/library/{first_video_id}")
        library_files = await client.get(f"/api/library/{first_video_id}/files")
        library_stream = await client.get(f"/api/library/{first_video_id}/stream")
        coverage = await client.get(f"/api/channels/{channel_id}/coverage")
        missing = await client.get(f"/api/channels/{channel_id}/missing")
        removed = await client.get(f"/api/channels/{channel_id}/removed")
        cadence = await client.get(f"/api/channels/{channel_id}/cadence")
        saved_view = await client.post(
            "/api/library/views",
            json={
                "name": "무자막 h264",
                "query": "BERT",
                "integrity": "partial_sidecars",
                "sidecar": "subtitles",
                "codec": "h264 1080p",
            },
        )
        saved_view_updated = await client.post(
            "/api/library/views",
            json={
                "name": "무자막 h264",
                "query": "BERT",
                "integrity": "partial_sidecars",
                "sidecar": "any",
                "codec": "h264 1080p",
            },
        )
        saved_views = await client.get("/api/library/views")
        deleted_view = await client.delete(f"/api/library/views/{saved_view.json()['id']}")
        saved_views_after_delete = await client.get("/api/library/views")
        policy = await client.patch(
            f"/api/channels/{channel_id}/policy",
            json={"max_quality": "best", "auto_download": True, "subtitle_languages": ["ko", "en", "ja"]},
        )
        jobs = await client.get(f"/api/jobs/downloads?channel_id={channel_id}")
        queued_jobs = await client.get(f"/api/jobs/downloads?channel_id={channel_id}&status=queued&limit=5")
        sync_jobs = await client.get("/api/jobs/sync")
        filtered_sync_jobs = await client.get(
            f"/api/jobs/sync?channel_id={channel_id}&trigger=manual&status=completed&limit=5"
        )
        dashboard = await client.get("/api/dashboard")
        events = await client.get("/api/events/recent")

    assert created.status_code == 200
    assert synced.status_code == 200
    assert synced.json()["job"]["status"] == "completed"
    assert synced.json()["videos_seen"] == 2
    assert synced.json()["videos_created"] == 1

    assert detail.status_code == 200
    assert detail.json()["video_count"] == 2
    assert detail.json()["latest_video_published_at"] is not None
    assert detail.json()["typical_upload_dow"] == datetime.fromtimestamp(1653041065, tz=UTC).weekday()
    assert channel_settings.status_code == 200
    assert channel_settings.json()["sync_interval_minutes"] == 120
    assert channel_settings.json()["next_sync_due_at"] is not None

    assert videos.status_code == 200
    assert [video["external_id"] for video in videos.json()] == ["n5soSphTPnI", "6lXl1hkEgcA"]

    assert candidates.status_code == 200
    assert candidates.json()["candidates_created"] == 2
    assert candidates.json()["total_candidates"] == 2

    assert queued.status_code == 200
    assert queued.json()["job"]["status"] == "queued"
    assert queued.json()["job"]["quality"] == "720p"
    assert queued.json()["job"]["archive_path"].endswith("2022-05-21 - BERT based datalake [n5soSphTPnI]")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelled"
    assert retried.status_code == 200
    assert retried.json()["job"]["status"] == "queued"
    assert retried.json()["job"]["attempt_count"] == 1
    assert preflight.status_code == 200
    assert preflight.json()["job_count"] == 2
    assert preflight.json()["estimated_label"].endswith("MB")
    assert len(preflight.json()["ready_job_ids"]) == 2
    assert worker_plan.status_code == 200
    assert worker_plan.json()["enabled"] is False
    assert worker_plan.json()["queued_count"] == 1
    assert worker_plan.json()["claimable_count"] == 1
    assert worker_plan.json()["running_count"] == 0
    assert worker_plan.json()["running_jobs"] == []
    assert "yt-dlp" in worker_plan.json()["jobs"][0]["command_preview"]
    assert "video.%(ext)s" in worker_plan.json()["jobs"][0]["output_template"]
    assert worker_run.status_code == 200
    assert worker_run.json()["dry_run"] is True
    assert worker_run.json()["started"] == 0
    assert worker_run.json()["plan"]["claimable_count"] == 1
    assert worker_runs.status_code == 200
    assert worker_runs.json()[0]["status"] == "locked"
    assert worker_runs.json()[0]["dry_run"] is True
    assert bulk.status_code == 200
    assert bulk.json()["updated"] == 2
    assert {job["priority"] for job in bulk.json()["jobs"]} == {95}
    assert library.status_code == 200
    assert library.json()["total"] == 1
    assert library.json()["archived"] == 1
    assert library.json()["items"][0]["archive_state"] == "archived"
    assert library.json()["items"][0]["integrity_state"] == "partial_sidecars"
    assert library.json()["items"][0]["queue_status"] == "queued"
    assert library.json()["items"][0]["video_codec"] == "h264"
    assert library.json()["items"][0]["fidelity"]["media"] is True
    assert library_integrity.status_code == 200
    assert library_integrity.json()["total"] == 1
    assert library_codec.status_code == 200
    assert library_codec.json()["total"] == 1
    assert library_missing_sidecar.status_code == 200
    assert library_missing_sidecar.json()["total"] == 2
    assert library_codec_empty.status_code == 200
    assert library_codec_empty.json()["total"] == 0
    assert library_item.status_code == 200
    assert library_item.json()["id"] == first_video_id
    assert library_files.status_code == 200
    assert library_files.json()[0]["filename"] == "video.mp4"
    assert library_files.json()[0]["exists"] is False
    assert library_files.json()[0]["integrity_state"] == "missing_media"
    assert library_files.json()[0]["size_label"].endswith("MB")
    assert library_files.json()[0]["info_json_exists"] is False
    assert {sidecar["kind"] for sidecar in library_files.json()[0]["sidecars"]} == {"info_json", "thumbnail", "nfo"}
    assert library_stream.status_code == 404
    assert coverage.status_code == 200
    assert coverage.json()["source"] == 2
    assert coverage.json()["archived"] == 1
    assert coverage.json()["missing"] == 1
    assert missing.status_code == 200
    assert [video["id"] for video in missing.json()] == ["6lXl1hkEgcA"]
    assert removed.status_code == 200
    assert removed.json() == []
    assert cadence.status_code == 200
    assert cadence.json()["avg_upload_interval_days"] > 0
    assert sum(bucket["count"] for bucket in cadence.json()["buckets"]) == 2
    assert saved_view.status_code == 200
    assert saved_view.json()["name"] == "무자막 h264"
    assert saved_view.json()["sidecar"] == "subtitles"
    assert saved_view_updated.status_code == 200
    assert saved_view_updated.json()["id"] == saved_view.json()["id"]
    assert saved_view_updated.json()["sidecar"] == "any"
    assert saved_views.status_code == 200
    assert len(saved_views.json()) == 1
    assert deleted_view.status_code == 200
    assert deleted_view.json()["deleted"] is True
    assert saved_views_after_delete.status_code == 200
    assert saved_views_after_delete.json() == []
    assert policy.status_code == 200
    assert policy.json()["max_quality"] == "best"
    assert policy.json()["auto_download"] is True

    assert jobs.status_code == 200
    assert sorted(job["status"] for job in jobs.json()) == ["candidate", "queued"]
    assert queued_jobs.status_code == 200
    assert len(queued_jobs.json()) == 1
    assert queued_jobs.json()[0]["status"] == "queued"
    assert sync_jobs.status_code == 200
    assert sync_jobs.json()[0]["status"] == "completed"
    assert filtered_sync_jobs.status_code == 200
    assert len(filtered_sync_jobs.json()) == 1
    assert filtered_sync_jobs.json()[0]["trigger"] == "manual"
    assert dashboard.status_code == 200
    assert dashboard.json()["coverage"]["source"] == 2
    assert dashboard.json()["channels"][0]["storage_gb"] > 0
    assert dashboard.json()["queue"][2]["label"] == "Queued"
    assert events.status_code == 200
    assert {event["type"] for event in events.json()} >= {
        "sync.completed",
        "download.queued",
        "download.cancelled",
        "policy.updated",
    }

    async with AsyncSessionLocal() as session:
        download_job_count = len((await session.execute(select(DownloadJob))).scalars().all())
        sync_job_count = len((await session.execute(select(SyncJob))).scalars().all())

    assert download_job_count == 2
    assert sync_job_count == 1


@pytest.mark.asyncio
async def test_metadata_scheduler_detects_new_video_and_stages_candidates_when_worker_paused(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(MetadataSyncTick))
        await session.execute(delete(SyncJob))
        await session.execute(delete(LibraryView))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()

    monkeypatch.setattr(settings, "metadata_sync_scheduler_enabled", True)
    monkeypatch.setattr(settings, "metadata_sync_scheduler_interval_seconds", 60)
    monkeypatch.setattr(settings, "metadata_sync_scheduler_limit", 5)
    monkeypatch.setattr(settings, "metadata_sync_auto_candidates_limit", 10)
    monkeypatch.setattr(settings, "download_worker_enabled", True)

    async def fake_initial_probe(payload: ChannelProbeRequest):
        return _probe_result(
            payload,
            entries=[
                {
                    "id": "oldArchive01",
                    "title": "Already mirrored briefing",
                    "url": "https://www.youtube.com/watch?v=oldArchive01",
                    "duration": 300,
                    "timestamp": 1772107200,
                    "upload_date": "20260228",
                }
            ],
        )

    async def fake_scheduler_probe(payload: ChannelProbeRequest):
        return _probe_result(
            payload,
            entries=[
                {
                    "id": "newArchive02",
                    "title": "Scheduler found this first",
                    "url": "https://www.youtube.com/watch?v=newArchive02",
                    "duration": 420,
                    "timestamp": 1772193600,
                    "upload_date": "20260301",
                },
                {
                    "id": "oldArchive01",
                    "title": "Already mirrored briefing",
                    "url": "https://www.youtube.com/watch?v=oldArchive01",
                    "duration": 300,
                    "timestamp": 1772107200,
                    "upload_date": "20260228",
                },
            ],
        )

    monkeypatch.setattr("app.services.channel_registration.probe_channel_source", fake_initial_probe)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            "/api/channels",
            json={
                "value": "https://youtube.com/@wingnut987s4",
                "auto_download": True,
                "max_quality": "1080p",
            },
        )
        channel_id = created.json()["channel"]["id"]

        async with AsyncSessionLocal() as session:
            channel = await session.get(Channel, channel_id)
            assert channel is not None
            channel.last_synced_at = datetime.now(UTC) - timedelta(minutes=30)
            channel.sync_interval_minutes = 5
            channel.archived_count = 1
            policy = await session.scalar(select(ChannelPolicy).where(ChannelPolicy.channel_id == channel_id))
            assert policy is not None
            policy.auto_download = True
            policy.worker_paused = True
            policy.worker_pause_reason = "operator maintenance"
            old_video = await session.scalar(select(Video).where(Video.channel_id == channel_id))
            assert old_video is not None
            session.add(
                MediaFile(
                    video_id=old_video.id,
                    relative_path="channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2026/"
                    "2026-02-28 - Already mirrored briefing [oldArchive01]/video.mp4",
                    filename="video.mp4",
                    size_bytes=120_000_000,
                    container="mp4",
                    video_codec="h264",
                    audio_codec="aac",
                    fps=30.0,
                    width=1920,
                    height=1080,
                    duration_seconds=300,
                )
            )
            due_before = await find_due_sync_channels(db=session, now=datetime.now(UTC), limit=10)
            await session.commit()

        monkeypatch.setattr("app.services.channel_sync.probe_channel_source", fake_scheduler_probe)
        tick = await run_metadata_sync_scheduler_tick()
        metadata_ticks = await client.get("/api/jobs/sync/scheduler/ticks?limit=5")
        detail = await client.get(f"/api/channels/{channel_id}")
        manual_tick = await client.post("/api/jobs/sync/scheduler/run-once")

    assert created.status_code == 200
    assert [channel.id for channel in due_before] == [channel_id]
    assert tick.status == "completed"
    assert tick.due_channel_count == 1
    assert tick.synced_count == 1
    assert tick.failed_count == 0
    assert tick.videos_seen_count == 2
    assert tick.videos_created_count == 1
    assert tick.candidates_created_count == 1
    assert metadata_ticks.status_code == 200
    assert metadata_ticks.json()[0]["candidates_created_count"] == 1
    assert manual_tick.status_code == 200
    assert manual_tick.json()["trigger"] == "manual"
    assert manual_tick.json()["status"] == "skipped"
    assert detail.status_code == 200
    assert detail.json()["last_auto_sync_status"] == "completed"
    assert detail.json()["last_auto_candidates_created"] == 1
    assert detail.json()["next_sync_due_at"] is not None

    async with AsyncSessionLocal() as session:
        download_jobs = (await session.execute(select(DownloadJob))).scalars().all()
        sync_job = await session.scalar(select(SyncJob).order_by(SyncJob.created_at.desc()))
        videos = (await session.execute(select(Video).order_by(Video.published_at.desc()))).scalars().all()
        due_after = await find_due_sync_channels(db=session, now=datetime.now(UTC), limit=10)
        assert len(download_jobs) == 1
        assert download_jobs[0].status == "candidate"
        assert download_jobs[0].quality == "1080p"
        assert sync_job is not None
        assert sync_job.trigger == "scheduler"
        assert sync_job.candidates_created == 1
        assert [video.external_id for video in videos] == ["newArchive02", "oldArchive01"]
        assert due_after == []

        download_jobs[0].status = "queued"
        await session.commit()
        worker_plan = await build_download_worker_plan(db=session, channel_id=channel_id, limit=5)

    assert worker_plan.queued_count == 1
    assert worker_plan.claimable_count == 0
    assert worker_plan.locked_reason is not None
    assert "Worker is paused" in worker_plan.locked_reason


def _probe_result(payload: ChannelProbeRequest, entries: list[dict]):
    raw = {
        "id": "UCmLADXQtWVuzOnOK5TNrWaw",
        "channel": "wingnut987S",
        "channel_id": "UCmLADXQtWVuzOnOK5TNrWaw",
        "uploader": "wingnut987S",
        "uploader_id": "@wingnut987s4",
        "uploader_url": "https://www.youtube.com/@wingnut987s4",
        "channel_url": "https://www.youtube.com/channel/UCmLADXQtWVuzOnOK5TNrWaw",
        "description": "Working in Amazon Web Services",
        "playlist_count": len(entries),
        "channel_follower_count": 17,
        "entries": entries,
    }
    return build_probe_result(
        normalized=normalize_source_input(payload.value),
        raw=raw,
        max_quality=payload.max_quality,
        audio_only=payload.audio_only,
    )
