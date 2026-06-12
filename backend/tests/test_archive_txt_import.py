"""Tests for youtube-dl archive.txt preview imports."""

from datetime import UTC, datetime
from pathlib import Path

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
    MediaFile,
    SyncJob,
    Video,
)
from app.schemas.source import (
    ChannelProbeResult,
    FolderPreview,
    NormalizedSource,
    SourceVideoPreview,
    StorageForecast,
)
from app.services.archive_txt import ARCHIVE_TXT_PLACEHOLDER_DESCRIPTION
from app.services.channel_registration import apply_probe_to_channel


@pytest.mark.asyncio
async def test_archive_txt_preview_splits_archived_missing_unknown_duplicate_and_invalid(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_migrations()
    await init_db()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()

        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@archive",
            external_id="UC_ARCHIVE",
            handle="@archive",
            title="Archive Channel",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=2,
            archived_count=1,
            missing_count=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(channel)
        await session.flush()
        archived = Video(
            channel_id=channel.id,
            external_id="abcDEF12345",
            title="Already saved",
            description=None,
            published_at=datetime.now(UTC),
            upload_date=None,
            duration_seconds=30,
            thumbnail_url=None,
            view_count=None,
            source_state="available",
            tags=None,
            categories=None,
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path="channels/archive/video.info.json",
            discovered_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        missing = Video(
            channel_id=channel.id,
            external_id="missDEF1234",
            title="Known missing",
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
        session.add_all([archived, missing])
        await session.flush()
        archived_media_relative = "channels/archive/video.mp4"
        archived_media_path = tmp_path / archived_media_relative
        archived_media_path.parent.mkdir(parents=True, exist_ok=True)
        archived_media_path.write_bytes(b"archived-on-disk")
        session.add(
            MediaFile(
                video_id=archived.id,
                relative_path=archived_media_relative,
                filename="video.mp4",
                size_bytes=100,
                container="mp4",
                video_codec="h264",
                audio_codec="aac",
                fps=30,
                width=1280,
                height=720,
                duration_seconds=30,
                info_json_path="channels/archive/video.info.json",
                nfo_path=None,
                thumbnail_path=None,
                checksum=None,
                created_at=datetime.now(UTC),
            )
        )
        await session.commit()

    content = "\n".join(
        [
            "youtube abcDEF12345",
            "https://youtu.be/missDEF1234",
            "youtube unkDEF12345",
            "youtube abcDEF12345",
            "not a usable line",
            "# ignored comment",
        ]
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/imports/archive-txt/preview", json={"content": content})

    assert response.status_code == 200
    data = response.json()
    states = [item["state"] for item in data["items"]]
    assert data["parsed_count"] == 3
    assert data["archived_count"] == 1
    assert data["known_missing_count"] == 1
    assert data["unknown_count"] == 1
    assert data["duplicate_count"] == 1
    assert data["invalid_count"] == 1
    assert states == ["archived", "known_missing", "unknown", "duplicate", "invalid"]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        staged = await client.post(
            "/api/imports/archive-txt/stage",
            json={"content": content, "channel_id": channel.id, "quality": "720p"},
        )

    assert staged.status_code == 200
    staged_data = staged.json()
    assert staged_data["videos_created"] == 1
    assert staged_data["candidates_created"] == 2
    assert staged_data["skipped_count"] == 3
    assert staged_data["preview"]["unknown_count"] == 0
    assert staged_data["preview"]["known_missing_count"] == 2

    async with AsyncSessionLocal() as session:
        staged_video = (
            await session.execute(select(Video).where(Video.external_id == "unkDEF12345"))
        ).scalar_one()
        jobs = (
            await session.execute(
                select(DownloadJob)
                .join(Video, DownloadJob.video_id == Video.id)
                .where(Video.external_id.in_(["missDEF1234", "unkDEF12345"]))
            )
        ).scalars().all()
        refreshed_channel = await session.get(Channel, channel.id)

    assert staged_video.title == "archive.txt import unkDEF12345"
    assert staged_video.description == ARCHIVE_TXT_PLACEHOLDER_DESCRIPTION
    assert {job.quality for job in jobs} == {"720p"}
    assert len(jobs) == 2
    assert refreshed_channel is not None
    assert refreshed_channel.source_video_count == 3
    assert refreshed_channel.archived_count == 1
    assert refreshed_channel.missing_count == 2

    async with AsyncSessionLocal() as session:
        refreshed_channel = await session.get(Channel, channel.id)
        assert refreshed_channel is not None
        summary = await apply_probe_to_channel(
            db=session,
            channel=refreshed_channel,
            probe=_probe_with_video(
                channel=refreshed_channel,
                video_external_id="unkDEF12345",
                title="Real title from metadata sync",
            ),
        )
        await session.commit()

    assert summary.videos_seen == 1
    assert summary.videos_created == 0
    assert summary.videos_enriched == 1

    async with AsyncSessionLocal() as session:
        enriched_video = (
            await session.execute(select(Video).where(Video.external_id == "unkDEF12345"))
        ).scalar_one()

    assert enriched_video.title == "Real title from metadata sync"
    assert enriched_video.description is None
    assert enriched_video.upload_date is not None
    assert enriched_video.duration_seconds == 121
    assert enriched_video.info_json_path is not None
    assert "Real title from metadata sync" in enriched_video.info_json_path


def _probe_with_video(*, channel: Channel, video_external_id: str, title: str) -> ChannelProbeResult:
    published_at = datetime(2026, 6, 3, 12, 0, tzinfo=UTC)
    source_url = channel.source_url
    return ChannelProbeResult(
        normalized=NormalizedSource(
            original=source_url,
            source_type="channel",
            identifier_type="url",
            identifier=source_url,
            canonical_url=source_url,
            probe_url=source_url,
            tracking_query_removed=False,
        ),
        title=channel.title,
        external_id=channel.external_id,
        handle=channel.handle,
        source_url=source_url,
        channel_url=source_url,
        description=channel.description,
        thumbnail_url=channel.thumbnail_url,
        banner_url=None,
        follower_count=None,
        video_count=3,
        videos=[
            SourceVideoPreview(
                external_id=video_external_id,
                title=title,
                url=f"https://www.youtube.com/watch?v={video_external_id}",
                duration_seconds=121,
                thumbnail_url="https://example.test/thumb.jpg",
                published_at=published_at,
                upload_date="20260603",
            )
        ],
        first_video_published_at=published_at,
        latest_video_published_at=published_at,
        storage_forecast=StorageForecast(
            video_count=3,
            max_quality="720p",
            audio_only=False,
            estimated_bytes=1,
            estimated_label="1 B",
            confidence="fixture",
        ),
        folder_preview=FolderPreview(
            root="downfolder",
            channel_dir="channels/archive",
            example_video_dir=None,
            sidecars=[],
        ),
    )
