"""Disk-aware archive coverage helpers.

These translate the Library's "trust files on disk" rule into reusable
aggregate counts so the Dashboard, Channel detail, and Coverage surfaces report
the same archived/downloaded/bytes numbers as the Library. A stale ``MediaFile``
row whose file is gone from disk must not be presented as archived/downloaded.

When no archive root is configured (``download_dir`` is ``None``) the helpers
fall back to trusting the DB index, preserving prior behavior for callers that
intentionally want indexed counts. Surfaces that decide whether a video is
archived/skipped or missing/stageable (Library, Channel, Dashboard, Coverage,
archive.txt preview/stage, download candidates, and operations readiness) pass
``settings.download_dir`` so they all agree on the same on-disk truth.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import MediaFile, Video
from app.services.library_index import media_path_on_disk


def resolve_archive_root(download_dir: str | Path | None) -> Path | None:
    """Resolve the configured archive root, or ``None`` to trust the index."""
    return Path(download_dir).resolve() if download_dir is not None else None


def _media_file_scope(channel_id: int | None):
    statement = select(MediaFile.video_id, MediaFile.relative_path, MediaFile.size_bytes)
    if channel_id is not None:
        statement = statement.where(
            MediaFile.video_id.in_(select(Video.id).where(Video.channel_id == channel_id))
        )
    return statement


async def archived_video_ids_on_disk(
    *,
    db: AsyncSession,
    root: Path | None,
    channel_id: int | None = None,
) -> set[int]:
    """Return ids of videos that have at least one media file present on disk."""
    archived: set[int] = set()
    for video_id, relative_path, _size in (await db.execute(_media_file_scope(channel_id))).all():
        if video_id in archived:
            continue
        if media_path_on_disk(root=root, relative_path=relative_path):
            archived.add(video_id)
    return archived


async def archived_bytes_on_disk(
    *,
    db: AsyncSession,
    root: Path | None,
    channel_id: int | None = None,
) -> int:
    """Return total recorded bytes for media files that actually exist on disk."""
    total = 0
    for _video_id, relative_path, size_bytes in (await db.execute(_media_file_scope(channel_id))).all():
        if media_path_on_disk(root=root, relative_path=relative_path):
            total += size_bytes or 0
    return total
