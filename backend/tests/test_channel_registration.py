"""Channel registration end-to-end API tests."""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadWorkerRun,
    MediaFile,
    SyncJob,
    Video,
)
from app.schemas.source import ChannelProbeRequest
from app.services.source_normalizer import normalize_source_input
from app.services.ytdlp_probe import build_probe_result


@pytest.mark.asyncio
async def test_channel_registration_probe_commit_and_dedupe(monkeypatch: pytest.MonkeyPatch) -> None:
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

    async def fake_probe(payload: ChannelProbeRequest):
        raw = {
            "id": "UCmLADXQtWVuzOnOK5TNrWaw",
            "channel": "wingnut987S",
            "channel_id": "UCmLADXQtWVuzOnOK5TNrWaw",
            "uploader": "wingnut987S",
            "uploader_id": "@wingnut987s4",
            "uploader_url": "https://www.youtube.com/@wingnut987s4",
            "channel_url": "https://www.youtube.com/channel/UCmLADXQtWVuzOnOK5TNrWaw",
            "description": "Working in Amazon Web Services",
            "playlist_count": 2,
            "channel_follower_count": 17,
            "thumbnails": [
                {"url": "https://example.test/avatar.jpg", "id": "avatar_uncropped", "width": 900, "height": 900},
                {"url": "https://example.test/banner.jpg", "id": "banner_uncropped", "width": 2560, "height": 424},
            ],
            "entries": [
                {
                    "id": "6lXl1hkEgcA",
                    "title": "HEAVY BAG DRILLS",
                    "url": "https://www.youtube.com/watch?v=6lXl1hkEgcA",
                    "duration": 61,
                    "timestamp": 1653041065,
                    "upload_date": "20220520",
                    "thumbnails": [{"url": "https://example.test/heavy-bag.jpg", "width": 336, "height": 188}],
                },
                {
                    "id": "n5soSphTPnI",
                    "title": "BERT based datalake",
                    "url": "https://www.youtube.com/watch?v=n5soSphTPnI",
                    "duration": 600,
                    "timestamp": 1653127465,
                    "upload_date": "20220521",
                },
            ],
        }
        return build_probe_result(
            normalized=normalize_source_input(payload.value),
            raw=raw,
            max_quality=payload.max_quality,
            audio_only=payload.audio_only,
        )

    monkeypatch.setattr("app.services.channel_registration.probe_channel_source", fake_probe)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        preview = await client.post(
            "/api/channels/_probe",
            json={"value": "https://youtube.com/@wingnut987s4?si=LZr7f3vNJZsuoRo1"},
        )
        created = await client.post(
            "/api/channels",
            json={"value": "https://youtube.com/@wingnut987s4?si=LZr7f3vNJZsuoRo1"},
        )
        deduped = await client.post("/api/channels", json={"value": "UCmLADXQtWVuzOnOK5TNrWaw"})
        channels = await client.get("/api/channels")

    assert preview.status_code == 200
    preview_data = preview.json()
    assert preview_data["title"] == "wingnut987S"
    assert preview_data["video_count"] == 2
    assert preview_data["normalized"]["tracking_query_removed"] is True
    assert preview_data["folder_preview"]["channel_dir"] == "channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]"
    assert preview_data["storage_forecast"]["estimated_label"].endswith("GB")

    assert created.status_code == 200
    created_data = created.json()
    assert created_data["created"] is True
    assert created_data["channel"]["video_count"] == 2
    assert created_data["channel"]["missing_count"] == 2

    assert deduped.status_code == 200
    assert deduped.json()["created"] is False
    assert deduped.json()["channel"]["id"] == created_data["channel"]["id"]

    assert channels.status_code == 200
    assert channels.json()[0]["title"] == "wingnut987S"

    async with AsyncSessionLocal() as session:
        channel_count = await session.scalar(select(func.count()).select_from(Channel))
        video_count = await session.scalar(select(func.count()).select_from(Video))
        video = await session.scalar(select(Video).where(Video.external_id == "6lXl1hkEgcA"))

    assert channel_count == 1
    assert video_count == 2
    assert video is not None
    assert video.published_at is not None
    assert video.published_at.replace(tzinfo=UTC) == datetime.fromtimestamp(1653041065, tz=UTC)
    assert video.info_json_path.endswith("2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]/video.info.json")
