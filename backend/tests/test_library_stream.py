"""Library media streaming contract tests."""

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
    DownloadWorkerRun,
    MediaFile,
    SyncJob,
    Video,
)


@pytest.mark.asyncio
async def test_library_stream_supports_full_and_range_requests(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    run_migrations()
    await init_db()
    monkeypatch.setattr(settings, "download_dir", str(tmp_path))
    video_id, payload, audio_payload = await _seed_streamable_media(tmp_path)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = await client.get(f"/api/library/{video_id}/files")
        full = await client.get(f"/api/library/{video_id}/stream")
        partial = await client.get(f"/api/library/{video_id}/stream", headers={"Range": "bytes=2-5"})
        open_ended = await client.get(f"/api/library/{video_id}/stream", headers={"Range": "bytes=6-"})
        suffix = await client.get(f"/api/library/{video_id}/stream", headers={"Range": "bytes=-4"})
        invalid = await client.get(f"/api/library/{video_id}/stream", headers={"Range": "bytes=999-1000"})
        multi_range = await client.get(f"/api/library/{video_id}/stream", headers={"Range": "bytes=0-1,3-4"})
        assert files.status_code == 200
        files_payload = files.json()
        file_by_name = {item["filename"]: item for item in files_payload}
        audio_file = file_by_name["audio.m4a"]
        audio_specific = await client.get(audio_file["stream_url"], headers={"Range": "bytes=0-4"})
        wrong_video_specific = await client.get(f"/api/library/{video_id + 999}/files/{audio_file['id']}/stream")

    assert file_by_name["video.mp4"]["stream_url"] == f"/api/library/{video_id}/files/{file_by_name['video.mp4']['id']}/stream"
    assert audio_file["stream_url"] == f"/api/library/{video_id}/files/{audio_file['id']}/stream"
    assert full.status_code == 200
    assert full.headers["accept-ranges"] == "bytes"
    assert full.headers["content-length"] == str(len(payload))
    assert full.headers["content-type"].startswith("video/mp4")
    assert full.content == payload

    assert partial.status_code == 206
    assert partial.headers["accept-ranges"] == "bytes"
    assert partial.headers["content-range"] == f"bytes 2-5/{len(payload)}"
    assert partial.headers["content-length"] == "4"
    assert partial.content == payload[2:6]

    assert open_ended.status_code == 206
    assert open_ended.headers["content-range"] == f"bytes 6-{len(payload) - 1}/{len(payload)}"
    assert open_ended.content == payload[6:]

    assert suffix.status_code == 206
    assert suffix.headers["content-range"] == f"bytes {len(payload) - 4}-{len(payload) - 1}/{len(payload)}"
    assert suffix.content == payload[-4:]

    assert invalid.status_code == 416
    assert invalid.headers["content-range"] == f"bytes */{len(payload)}"
    assert multi_range.status_code == 416
    assert multi_range.headers["content-range"] == f"bytes */{len(payload)}"
    assert audio_specific.status_code == 206
    assert audio_specific.headers["content-range"] == f"bytes 0-4/{len(audio_payload)}"
    assert audio_specific.content == audio_payload[:5]
    assert wrong_video_specific.status_code == 404


async def _seed_streamable_media(tmp_path: Path) -> tuple[int, bytes, bytes]:
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
            source_url="https://www.youtube.com/@streamlab",
            external_id="UC_STREAM",
            handle="@streamlab",
            title="Stream Lab",
            description=None,
            thumbnail_url=None,
            status="active",
            source_video_count=1,
            archived_count=1,
            missing_count=0,
        )
        session.add(channel)
        await session.flush()

        video = Video(
            channel_id=channel.id,
            external_id="streamable01",
            title="Streamable archive clip",
            description=None,
            published_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
            upload_date=None,
            duration_seconds=42,
            thumbnail_url=None,
            view_count=None,
            source_state="available",
            tags=[],
            categories=[],
            chapters=[],
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
        )
        session.add(video)
        await session.flush()

        relative_path = "channels/@streamlab [UC_STREAM]/2026/Streamable archive clip [streamable01]/video.mp4"
        payload = b"channel-vault-media-bytes"
        audio_payload = b"channel-vault-audio-bytes"
        media_path = tmp_path / relative_path
        media_path.parent.mkdir(parents=True)
        media_path.write_bytes(payload)
        audio_relative_path = "channels/@streamlab [UC_STREAM]/2026/Streamable archive clip [streamable01]/audio.m4a"
        audio_path = tmp_path / audio_relative_path
        audio_path.write_bytes(audio_payload)

        session.add(
            MediaFile(
                video_id=video.id,
                relative_path=relative_path,
                filename="video.mp4",
                size_bytes=len(payload),
                container="mp4",
                video_codec="h264",
                audio_codec="aac",
                fps=30.0,
                width=1280,
                height=720,
                duration_seconds=42,
                info_json_path=None,
                nfo_path=None,
                thumbnail_path=None,
                checksum=None,
                created_at=datetime(2026, 6, 1, 12, 1, tzinfo=UTC),
            )
        )
        session.add(
            MediaFile(
                video_id=video.id,
                relative_path=audio_relative_path,
                filename="audio.m4a",
                size_bytes=len(audio_payload),
                container="m4a",
                video_codec=None,
                audio_codec="aac",
                fps=None,
                width=None,
                height=None,
                duration_seconds=42,
                info_json_path=None,
                nfo_path=None,
                thumbnail_path=None,
                checksum=None,
                created_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
            )
        )
        await session.commit()
        return video.id, payload, audio_payload
