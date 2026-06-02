"""Tests for youtube-dl archive.txt preview imports."""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

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


@pytest.mark.asyncio
async def test_archive_txt_preview_splits_archived_missing_unknown_duplicate_and_invalid() -> None:
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
        session.add(
            MediaFile(
                video_id=archived.id,
                relative_path="channels/archive/video.mp4",
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
