"""Disk-aware library archive state contract tests.

These lock the behavior that the Library index trusts actual media files on disk
under the archive root instead of stale ``MediaFile`` DB rows:

- A DB-only ``MediaFile`` row (no file on disk) is not counted as archived.
- An actual media file on disk is counted as archived and stays streamable.
- A video with both a present and a stale row stays archived, but only the
  present file contributes bytes while the stale row remains inspectable.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import delete

from app.database import AsyncSessionLocal, init_db, run_migrations
from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadWorkerRun,
    MediaFile,
    SyncJob,
    Video,
)
from app.services.library_index import (
    build_library_snapshot,
    first_streamable_file,
    get_library_item,
    list_library_files,
    streamable_file_by_id,
)

CHANNEL_DIR = "channels/@diskaware [UC_DISKAWARE]/2026/Disk aware clip [diskaware01]"


async def _reset_archive_tables() -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(DownloadJob))
        await session.execute(delete(DownloadWorkerRun))
        await session.execute(delete(SyncJob))
        await session.execute(delete(ChannelPolicy))
        await session.execute(delete(MediaFile))
        await session.execute(delete(Video))
        await session.execute(delete(Channel))
        await session.commit()


async def _seed_channel_and_video() -> tuple[int, int]:
    async with AsyncSessionLocal() as session:
        channel = Channel(
            source_type="channel",
            source_url="https://www.youtube.com/@diskaware",
            external_id="UC_DISKAWARE",
            handle="@diskaware",
            title="Disk Aware Lab",
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
            external_id="diskaware01",
            title="Disk aware clip",
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
        await session.commit()
        return channel.id, video.id


async def _add_media_file(
    *,
    video_id: int,
    relative_path: str,
    size_bytes: int,
    info_json_path: str | None = None,
    thumbnail_path: str | None = None,
    nfo_path: str | None = None,
    created_at: datetime,
) -> int:
    async with AsyncSessionLocal() as session:
        media = MediaFile(
            video_id=video_id,
            relative_path=relative_path,
            filename=Path(relative_path).name,
            size_bytes=size_bytes,
            container="mp4",
            video_codec="h264",
            audio_codec="aac",
            fps=30.0,
            width=1920,
            height=1080,
            duration_seconds=42,
            info_json_path=info_json_path,
            nfo_path=nfo_path,
            thumbnail_path=thumbnail_path,
            checksum=None,
            created_at=created_at,
        )
        session.add(media)
        await session.flush()
        await session.commit()
        return media.id


@pytest.mark.asyncio
async def test_db_only_media_is_not_counted_as_archived(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()
    await _add_media_file(
        video_id=video_id,
        relative_path=f"{CHANNEL_DIR}/video.mp4",
        size_bytes=512_000_000,
        info_json_path=f"{CHANNEL_DIR}/video.info.json",
        thumbnail_path=f"{CHANNEL_DIR}/thumbnail.jpg",
        nfo_path=f"{CHANNEL_DIR}/video.nfo",
        created_at=datetime(2026, 6, 1, 12, 1, tzinfo=UTC),
    )

    async with AsyncSessionLocal() as session:
        snapshot = await build_library_snapshot(db=session, download_dir=tmp_path, channel_id=channel_id)
        item = await get_library_item(db=session, video_id=video_id, download_dir=tmp_path)
        streamable = await first_streamable_file(db=session, video_id=video_id, download_dir=tmp_path)

    assert snapshot.total == 1
    assert snapshot.archived == 0
    assert snapshot.missing == 1
    assert snapshot.total_bytes == 0

    assert item is not None
    assert item.archive_state == "missing"
    assert item.integrity_state == "missing_media"
    assert item.fidelity.media is False
    assert item.total_bytes == 0
    # The stale row stays visible as indexed metadata so the UI can flag it.
    assert item.media_count == 1
    assert item.video_codec == "h264"

    assert streamable is None


@pytest.mark.asyncio
async def test_actual_disk_media_is_archived_and_streamable(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()

    payload = b"channel-vault-disk-aware-media"
    media_dir = tmp_path / CHANNEL_DIR
    media_dir.mkdir(parents=True)
    (media_dir / "video.mp4").write_bytes(payload)
    (media_dir / "video.info.json").write_text("{}", encoding="utf-8")
    (media_dir / "thumbnail.jpg").write_text("thumb", encoding="utf-8")
    (media_dir / "video.nfo").write_text("nfo", encoding="utf-8")

    await _add_media_file(
        video_id=video_id,
        relative_path=f"{CHANNEL_DIR}/video.mp4",
        size_bytes=len(payload),
        info_json_path=f"{CHANNEL_DIR}/video.info.json",
        thumbnail_path=f"{CHANNEL_DIR}/thumbnail.jpg",
        nfo_path=f"{CHANNEL_DIR}/video.nfo",
        created_at=datetime(2026, 6, 1, 12, 1, tzinfo=UTC),
    )

    async with AsyncSessionLocal() as session:
        snapshot = await build_library_snapshot(db=session, download_dir=tmp_path, channel_id=channel_id)
        item = await get_library_item(db=session, video_id=video_id, download_dir=tmp_path)
        streamable = await first_streamable_file(db=session, video_id=video_id, download_dir=tmp_path)

    assert snapshot.total == 1
    assert snapshot.archived == 1
    assert snapshot.missing == 0
    assert snapshot.total_bytes == len(payload)

    assert item is not None
    assert item.archive_state == "archived"
    assert item.fidelity.media is True
    assert item.total_bytes == len(payload)
    assert item.integrity_state in {"complete", "partial_sidecars", "media_only"}

    assert streamable is not None
    assert streamable.read_bytes() == payload


@pytest.mark.asyncio
async def test_mixed_media_counts_only_existing_bytes(tmp_path: Path) -> None:
    run_migrations()
    await init_db()
    await _reset_archive_tables()
    channel_id, video_id = await _seed_channel_and_video()

    payload = b"present-media-bytes"
    media_dir = tmp_path / CHANNEL_DIR
    media_dir.mkdir(parents=True)
    (media_dir / "video.mp4").write_bytes(payload)

    present_id = await _add_media_file(
        video_id=video_id,
        relative_path=f"{CHANNEL_DIR}/video.mp4",
        size_bytes=len(payload),
        created_at=datetime(2026, 6, 1, 12, 2, tzinfo=UTC),
    )
    await _add_media_file(
        video_id=video_id,
        relative_path=f"{CHANNEL_DIR}/extra.mp4",
        size_bytes=999_999,
        created_at=datetime(2026, 6, 1, 12, 1, tzinfo=UTC),
    )

    async with AsyncSessionLocal() as session:
        snapshot = await build_library_snapshot(db=session, download_dir=tmp_path, channel_id=channel_id)
        item = await get_library_item(db=session, video_id=video_id, download_dir=tmp_path)
        files = await list_library_files(db=session, video_id=video_id, download_dir=tmp_path)
        present_stream = await streamable_file_by_id(
            db=session, video_id=video_id, media_file_id=present_id, download_dir=tmp_path
        )
        stale_id = next(file.id for file in (files or []) if file.id != present_id)
        stale_stream = await streamable_file_by_id(
            db=session, video_id=video_id, media_file_id=stale_id, download_dir=tmp_path
        )

    assert snapshot.archived == 1
    assert snapshot.missing == 0
    assert snapshot.total_bytes == len(payload)

    assert item is not None
    assert item.archive_state == "archived"
    assert item.fidelity.media is True
    assert item.total_bytes == len(payload)
    # Both rows remain indexed; the stale one does not inflate counted bytes.
    assert item.media_count == 2

    assert files is not None
    by_id = {file.id: file for file in files}
    assert by_id[present_id].exists is True
    stale = next(file for file in files if file.id != present_id)
    assert stale.exists is False
    assert stale.integrity_state == "missing_media"

    # The present row stays streamable per-file; the stale row never resolves to a path.
    assert present_stream is not None
    assert present_stream.read_bytes() == payload
    assert stale_stream is None
