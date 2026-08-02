"""Preservation Watch: source-presence reconciliation and preserved surfacing."""

from datetime import UTC, datetime, timedelta
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
    DownloadWorkerRun,
    LibraryView,
    MediaFile,
    MetadataSyncTick,
    SyncJob,
    Video,
)
from app.schemas.source import ChannelProbeRequest
from app.services.source_normalizer import normalize_source_input
from app.services.source_reconciliation import reconcile_source_presence
from app.services.ytdlp_probe import build_probe_result

BASE = datetime(2026, 6, 1, tzinfo=UTC)


def _entry(video_id: str, published: datetime) -> dict:
    return {
        "id": video_id,
        "title": f"Video {video_id}",
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "timestamp": int(published.timestamp()),
        "duration": 120,
    }


def _probe(entries: list[dict], *, playlist_count: int | None = None, payload_value: str = "https://youtube.com/@demo"):
    raw = {
        "id": "UCdemo",
        "channel": "Demo Channel",
        "channel_id": "UCdemo",
        "uploader_id": "@demo",
        "channel_url": "https://www.youtube.com/channel/UCdemo",
        "playlist_count": playlist_count if playlist_count is not None else len(entries),
        "entries": entries,
    }
    return build_probe_result(
        normalized=normalize_source_input(payload_value),
        raw=raw,
        max_quality="1080p",
        audio_only=False,
    )


async def _reset() -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        for model in (
            DownloadJob,
            ArchiveEventLog,
            DownloadWorkerRun,
            MetadataSyncTick,
            SyncJob,
            LibraryView,
            ChannelPolicy,
            MediaFile,
            Video,
            Channel,
        ):
            await session.execute(delete(model))
        await session.commit()


async def _seed_channel(**overrides) -> int:
    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_url="https://youtube.com/@demo",
            external_id="UCdemo",
            title="Demo Channel",
            status="active",
            **overrides,
        )
        session.add(channel)
        await session.flush()
        channel_id = channel.id
        await session.commit()
        return channel_id


def _video(channel_id: int, external_id: str, *, published: datetime, last_seen: datetime, source_state: str = "available", removed_detected_at: datetime | None = None) -> Video:
    return Video(
        channel_id=channel_id,
        external_id=external_id,
        title=f"Video {external_id}",
        published_at=published,
        source_state=source_state,
        last_seen_in_source_at=last_seen,
        removed_detected_at=removed_detected_at,
        discovered_at=published,
        created_at=published,
        updated_at=last_seen,
    )


@pytest.mark.asyncio
async def test_absent_upload_confirmed_removed_after_window() -> None:
    await _reset()
    channel_id = await _seed_channel(source_video_count=1)
    async with AsyncSessionLocal() as session:
        session.add(_video(channel_id, "aged", published=BASE - timedelta(days=30), last_seen=BASE - timedelta(days=10)))
        session.add(_video(channel_id, "fresh", published=BASE - timedelta(days=2), last_seen=BASE - timedelta(hours=1)))
        await session.commit()

    async with AsyncSessionLocal() as session:
        summary = await reconcile_source_presence(
            db=session,
            channel_id=channel_id,
            probe=_probe([_entry("current", BASE - timedelta(hours=2))]),
            now=BASE,
            confirm_after=timedelta(hours=24),
        )
        await session.commit()

    assert summary.newly_removed == 1
    assert summary.suspected == 1
    async with AsyncSessionLocal() as session:
        states = dict((row.external_id, row) for row in (await session.execute(select(Video).where(Video.channel_id == channel_id))).scalars())
    assert states["aged"].source_state == "removed"
    assert states["aged"].removed_detected_at is not None
    assert states["fresh"].source_state == "available"
    assert states["fresh"].removed_detected_at is None


@pytest.mark.asyncio
async def test_truncated_listing_only_judges_covered_window() -> None:
    await _reset()
    channel_id = await _seed_channel(source_video_count=1000)
    async with AsyncSessionLocal() as session:
        # An old upload beyond the returned recency window must never be flagged.
        session.add(_video(channel_id, "ancient", published=BASE - timedelta(days=900), last_seen=BASE - timedelta(days=200)))
        # A recent upload inside the window that vanished should be flagged.
        session.add(_video(channel_id, "recent", published=BASE - timedelta(days=1, hours=12), last_seen=BASE - timedelta(days=5)))
        await session.commit()

    async with AsyncSessionLocal() as session:
        summary = await reconcile_source_presence(
            db=session,
            channel_id=channel_id,
            probe=_probe(
                [
                    _entry("newest", BASE - timedelta(days=1)),
                    _entry("second", BASE - timedelta(days=2)),
                ],
                playlist_count=1000,
            ),
            now=BASE,
            confirm_after=timedelta(hours=24),
        )
        await session.commit()

    assert summary.newly_removed == 1
    async with AsyncSessionLocal() as session:
        states = dict((row.external_id, row.source_state) for row in (await session.execute(select(Video).where(Video.channel_id == channel_id))).scalars())
    assert states["ancient"] == "available"
    assert states["recent"] == "removed"


@pytest.mark.asyncio
async def test_empty_probe_never_mass_removes() -> None:
    await _reset()
    channel_id = await _seed_channel(source_video_count=2)
    async with AsyncSessionLocal() as session:
        session.add(_video(channel_id, "a", published=BASE - timedelta(days=5), last_seen=BASE - timedelta(days=5)))
        session.add(_video(channel_id, "b", published=BASE - timedelta(days=6), last_seen=BASE - timedelta(days=6)))
        await session.commit()

    async with AsyncSessionLocal() as session:
        summary = await reconcile_source_presence(
            db=session,
            channel_id=channel_id,
            probe=_probe([]),
            now=BASE,
            confirm_after=timedelta(hours=0),
        )
        await session.commit()

    assert summary.newly_removed == 0
    async with AsyncSessionLocal() as session:
        states = [row.source_state for row in (await session.execute(select(Video).where(Video.channel_id == channel_id))).scalars()]
    assert states == ["available", "available"]


@pytest.mark.asyncio
async def test_reappeared_upload_is_resurrected() -> None:
    await _reset()
    channel_id = await _seed_channel(source_video_count=1)
    async with AsyncSessionLocal() as session:
        session.add(
            _video(
                channel_id,
                "back",
                published=BASE - timedelta(days=4),
                last_seen=BASE - timedelta(days=9),
                source_state="removed",
                removed_detected_at=BASE - timedelta(days=3),
            )
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        summary = await reconcile_source_presence(
            db=session,
            channel_id=channel_id,
            probe=_probe([_entry("back", BASE - timedelta(days=4))]),
            now=BASE,
            confirm_after=timedelta(hours=24),
        )
        await session.commit()

    assert summary.resurrected == 1
    async with AsyncSessionLocal() as session:
        row = (await session.execute(select(Video).where(Video.channel_id == channel_id))).scalar_one()
    assert row.source_state == "available"
    assert row.removed_detected_at is None


@pytest.mark.asyncio
async def test_manual_sync_detects_vanished_upload(monkeypatch: pytest.MonkeyPatch) -> None:
    await _reset()
    monkeypatch.setattr(settings, "preservation_confirm_hours", 0)

    async def fake_initial_probe(payload: ChannelProbeRequest):
        return _probe(
            [
                _entry("keep01", BASE - timedelta(days=1)),
                _entry("gone01", BASE - timedelta(days=2)),
            ],
            payload_value=payload.value,
        )

    async def fake_sync_probe(payload: ChannelProbeRequest):
        return _probe([_entry("keep01", BASE - timedelta(days=1))], payload_value=payload.value)

    monkeypatch.setattr("app.services.channel_registration.probe_channel_source", fake_initial_probe)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post("/api/channels", json={"value": "https://youtube.com/@demo"})
        channel_id = created.json()["channel"]["id"]

        monkeypatch.setattr("app.services.channel_sync.probe_channel_source", fake_sync_probe)
        await client.post(f"/api/channels/{channel_id}/sync", json={})
        videos = await client.get(f"/api/channels/{channel_id}/videos")
        missing = await client.get(f"/api/channels/{channel_id}/missing")

    timeline = {row["external_id"]: row for row in videos.json()}
    assert timeline["gone01"]["source_state"] == "removed"
    assert timeline["gone01"]["removed_detected_at"] is not None
    assert timeline["keep01"]["source_state"] == "available"
    assert all(item["id"] != "gone01" for item in missing.json())


@pytest.mark.asyncio
async def test_preserved_videos_surface_and_export(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    await _reset()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    relative_path = "channels/@demo [UCdemo]/2026/Golden hour archive [keepA]/video.mp4"
    media_file = tmp_path / relative_path
    media_file.parent.mkdir(parents=True, exist_ok=True)
    media_file.write_bytes(b"0" * 2048)

    channel_id = await _seed_channel(source_video_count=1, removed_saved_count=1)
    async with AsyncSessionLocal() as session:
        video = _video(
            channel_id,
            "keepA",
            published=BASE - timedelta(days=5),
            last_seen=BASE - timedelta(days=12),
            source_state="removed",
            removed_detected_at=BASE - timedelta(days=1),
        )
        session.add(video)
        await session.flush()
        session.add(
            MediaFile(
                video_id=video.id,
                relative_path=relative_path,
                filename="video.mp4",
                size_bytes=2048,
                created_at=BASE,
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        removed = await client.get(f"/api/channels/{channel_id}/removed")
        coverage = await client.get(f"/api/channels/{channel_id}/coverage")
        videos = await client.get(f"/api/channels/{channel_id}/videos")
        export_csv = await client.get(f"/api/channels/{channel_id}/removed/export?format=csv")
        dashboard = await client.get("/api/dashboard")

    assert [row["id"] for row in removed.json()] == ["keepA"]
    assert removed.json()[0]["removed_detected_at"] is not None
    assert coverage.json()["removed_saved"] == 1
    timeline = {row["external_id"]: row for row in videos.json()}
    assert timeline["keepA"]["archive_state"] == "archived"
    assert timeline["keepA"]["source_state"] == "removed"
    assert timeline["keepA"]["removed_detected_at"] is not None
    assert "preserved-videos-channel" in export_csv.headers["content-disposition"]
    assert "video.mp4" in export_csv.text
    metrics = {metric["label"]: metric for metric in dashboard.json()["metrics"]}
    assert metrics["Preserved"]["value"] == "1"
    assert dashboard.json()["coverage"]["removed_saved"] == 1
