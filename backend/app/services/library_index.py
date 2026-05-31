"""DB-backed library index services."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, DownloadJob, MediaFile, Video
from app.schemas.library import (
    LibraryFidelity,
    LibraryFile,
    LibraryItem,
    LibrarySidecar,
    LibrarySnapshot,
)

QUEUE_STATUSES = {"candidate", "queued", "running"}
SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".ass", ".ssa", ".json3", ".srv1", ".srv2", ".srv3", ".ttml"}


async def build_library_snapshot(
    *,
    db: AsyncSession,
    download_dir: str | Path | None = None,
    channel_id: int | None = None,
    query: str | None = None,
    status: str | None = None,
    integrity: str | None = None,
    codec: str | None = None,
    missing_sidecar: str | None = None,
    limit: int = 80,
) -> LibrarySnapshot:
    """Return a searchable video library with archive and queue context."""
    root = Path(download_dir).resolve() if download_dir is not None else None
    rows = await db.execute(_video_query(channel_id=channel_id, query=query).limit(limit))
    items: list[LibraryItem] = []
    for video, channel in rows.all():
        item = await _library_item(db=db, video=video, channel=channel, root=root)
        if _matches_library_filters(
            item=item,
            status=status,
            integrity=integrity,
            codec=codec,
            missing_sidecar=missing_sidecar,
        ):
            items.append(item)

    archived = sum(1 for item in items if item.archive_state == "archived")
    queued = sum(1 for item in items if item.queue_status in QUEUE_STATUSES)
    total_bytes = sum(item.total_bytes for item in items)
    return LibrarySnapshot(
        items=items,
        total=len(items),
        archived=archived,
        missing=sum(1 for item in items if item.archive_state == "missing"),
        queued=queued,
        total_bytes=total_bytes,
        total_label=_bytes_label(total_bytes),
    )


async def get_library_item(
    *,
    db: AsyncSession,
    video_id: int,
    download_dir: str | Path | None = None,
) -> LibraryItem | None:
    """Return one library item by video id."""
    row = await db.execute(select(Video, Channel).join(Channel, Video.channel_id == Channel.id).where(Video.id == video_id))
    result = row.one_or_none()
    if result is None:
        return None
    video, channel = result
    root = Path(download_dir).resolve() if download_dir is not None else None
    return await _library_item(db=db, video=video, channel=channel, root=root)


async def list_library_files(*, db: AsyncSession, video_id: int, download_dir: str | Path) -> list[LibraryFile] | None:
    """Return file metadata for one video without opening the media."""
    if await db.get(Video, video_id) is None:
        return None
    root = Path(download_dir).resolve()
    result = await db.execute(select(MediaFile).where(MediaFile.video_id == video_id).order_by(MediaFile.created_at.desc()))
    return [_to_library_file(media=media, root=root) for media in result.scalars().all()]


async def first_streamable_file(*, db: AsyncSession, video_id: int, download_dir: str | Path) -> Path | None:
    """Return the first indexed media file that exists under the archive root."""
    files = await list_library_files(db=db, video_id=video_id, download_dir=download_dir)
    if files is None:
        return None
    root = Path(download_dir).resolve()
    for item in files:
        candidate = _safe_archive_path(root=root, relative_path=item.relative_path)
        if candidate is not None and candidate.exists() and candidate.is_file():
            return candidate
    return None


def _video_query(*, channel_id: int | None, query: str | None) -> Select[tuple[Video, Channel]]:
    statement = select(Video, Channel).join(Channel, Video.channel_id == Channel.id)
    if channel_id is not None:
        statement = statement.where(Video.channel_id == channel_id)
    if query:
        like = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                Video.title.ilike(like),
                Video.external_id.ilike(like),
                Channel.title.ilike(like),
                Channel.handle.ilike(like),
            )
        )
    return statement.order_by(Video.published_at.desc().nullslast(), Video.discovered_at.desc())


async def _library_item(*, db: AsyncSession, video: Video, channel: Channel, root: Path | None = None) -> LibraryItem:
    media_files = (
        await db.execute(select(MediaFile).where(MediaFile.video_id == video.id).order_by(MediaFile.created_at.desc()))
    ).scalars().all()
    job = await db.scalar(
        select(DownloadJob)
        .where(DownloadJob.video_id == video.id)
        .order_by(DownloadJob.updated_at.desc(), DownloadJob.created_at.desc())
        .limit(1)
    )
    media_paths = [media.relative_path for media in media_files]
    media_bytes = sum(media.size_bytes or 0 for media in media_files)
    primary_media = media_files[0] if media_files else None
    archived = bool(media_files)
    thumbnail_available = bool(video.thumbnail_url) or any(media.thumbnail_path for media in media_files)
    subtitle_available = any(_has_subtitle_hint(media, root=root) for media in media_files)
    nfo_available = any(media.nfo_path for media in media_files)
    fidelity = LibraryFidelity(
        info_json=bool(video.info_json_path) or any(media.info_json_path for media in media_files),
        media=archived,
        thumbnail=thumbnail_available,
        subtitles=subtitle_available,
        nfo=nfo_available,
    )
    return LibraryItem(
        id=video.id,
        channel_id=channel.id,
        channel_title=channel.title,
        video_external_id=video.external_id,
        title=video.title,
        url=f"https://www.youtube.com/watch?v={video.external_id}",
        published_at=video.published_at.isoformat() if video.published_at else None,
        duration_seconds=video.duration_seconds,
        thumbnail_url=video.thumbnail_url,
        source_state=video.source_state,
        archive_state="archived" if archived else "missing",
        integrity_state=_item_integrity_state(fidelity),
        info_json_path=video.info_json_path,
        media_files=media_paths,
        media_count=len(media_files),
        media_container=primary_media.container if primary_media else None,
        video_codec=primary_media.video_codec if primary_media else None,
        audio_codec=primary_media.audio_codec if primary_media else None,
        fps=primary_media.fps if primary_media else None,
        width=primary_media.width if primary_media else None,
        height=primary_media.height if primary_media else None,
        total_bytes=media_bytes,
        total_label=_bytes_label(media_bytes),
        queue_status=job.status if job else None,
        queue_priority=job.priority if job else None,
        fidelity=fidelity,
    )


def _matches_library_filters(
    *,
    item: LibraryItem,
    status: str | None,
    integrity: str | None,
    codec: str | None,
    missing_sidecar: str | None,
) -> bool:
    if status is not None and item.archive_state != status and item.queue_status != status:
        return False
    if integrity is not None and item.integrity_state != integrity:
        return False
    if codec is not None:
        tokens = [token for token in codec.strip().lower().split() if token]
        codec_values = [
            item.media_container,
            item.video_codec,
            item.audio_codec,
            f"{item.height}p" if item.height else None,
        ]
        haystack = " ".join(str(value).lower() for value in codec_values if value)
        if tokens and not all(token in haystack for token in tokens):
            return False
    if missing_sidecar is not None and not _is_missing_sidecar(item, missing_sidecar):
        return False
    return True


def _is_missing_sidecar(item: LibraryItem, sidecar: str) -> bool:
    requested = sidecar.strip().lower()
    sidecar_states = {
        "info_json": item.fidelity.info_json,
        "info": item.fidelity.info_json,
        "thumbnail": item.fidelity.thumbnail,
        "subtitles": item.fidelity.subtitles,
        "subtitle": item.fidelity.subtitles,
        "nfo": item.fidelity.nfo,
    }
    if requested == "any":
        return not all(sidecar_states[key] for key in ("info_json", "thumbnail", "subtitles", "nfo"))
    return requested in sidecar_states and not sidecar_states[requested]


def _item_integrity_state(fidelity: LibraryFidelity) -> str:
    if not fidelity.media:
        return "missing_media"
    sidecars = [fidelity.info_json, fidelity.thumbnail, fidelity.subtitles, fidelity.nfo]
    if all(sidecars):
        return "complete"
    if any(sidecars):
        return "partial_sidecars"
    return "media_only"


def _has_subtitle_hint(media: MediaFile, root: Path | None = None) -> bool:
    paths = [media.relative_path, media.info_json_path, media.nfo_path, media.thumbnail_path]
    if any(bool(path and (".srt" in path or ".vtt" in path)) for path in paths):
        return True
    if root is None:
        return False
    media_path = _safe_archive_path(root=root, relative_path=media.relative_path)
    if media_path is None or not media_path.parent.exists():
        return False
    return any(
        candidate.is_file() and candidate.suffix.lower() in SUBTITLE_EXTENSIONS
        for candidate in media_path.parent.iterdir()
    )


def _to_library_file(*, media: MediaFile, root: Path) -> LibraryFile:
    path = _safe_archive_path(root=root, relative_path=media.relative_path)
    exists = bool(path and path.exists() and path.is_file())
    sidecars = _library_sidecars(media=media, root=root)
    expected_sidecars = [item for item in sidecars if item.kind != "subtitle"]
    missing_expected = [item for item in expected_sidecars if not item.exists]
    return LibraryFile(
        video_id=media.video_id,
        relative_path=media.relative_path,
        filename=media.filename,
        size_bytes=media.size_bytes,
        container=media.container,
        video_codec=media.video_codec,
        audio_codec=media.audio_codec,
        fps=media.fps,
        width=media.width,
        height=media.height,
        duration_seconds=media.duration_seconds,
        exists=exists,
        size_label=_bytes_label(media.size_bytes or 0),
        integrity_state=_integrity_state(exists=exists, expected_sidecars=expected_sidecars, missing_expected=missing_expected),
        info_json_path=media.info_json_path,
        thumbnail_path=media.thumbnail_path,
        nfo_path=media.nfo_path,
        info_json_exists=_relative_file_exists(root=root, relative_path=media.info_json_path),
        thumbnail_exists=_relative_file_exists(root=root, relative_path=media.thumbnail_path),
        nfo_exists=_relative_file_exists(root=root, relative_path=media.nfo_path),
        sidecars=sidecars,
        stream_url=f"/api/library/{media.video_id}/stream",
    )


def _library_sidecars(*, media: MediaFile, root: Path) -> list[LibrarySidecar]:
    sidecars = [
        _sidecar(kind="info_json", root=root, relative_path=media.info_json_path),
        _sidecar(kind="thumbnail", root=root, relative_path=media.thumbnail_path),
        _sidecar(kind="nfo", root=root, relative_path=media.nfo_path),
    ]
    sidecars.extend(_subtitle_sidecars(media=media, root=root))
    return [item for item in sidecars if item is not None]


def _sidecar(*, kind: str, root: Path, relative_path: str | None) -> LibrarySidecar | None:
    if not relative_path:
        return None
    return LibrarySidecar(
        kind=kind,
        relative_path=relative_path,
        exists=_relative_file_exists(root=root, relative_path=relative_path),
    )


def _subtitle_sidecars(*, media: MediaFile, root: Path) -> list[LibrarySidecar]:
    media_path = _safe_archive_path(root=root, relative_path=media.relative_path)
    if media_path is None:
        return []
    folder = media_path.parent
    if not folder.exists() or not folder.is_dir():
        return []
    sidecars: list[LibrarySidecar] = []
    for candidate in sorted(folder.iterdir()):
        if candidate.is_file() and candidate.suffix.lower() in SUBTITLE_EXTENSIONS:
            sidecars.append(
                LibrarySidecar(
                    kind="subtitle",
                    relative_path=candidate.relative_to(root).as_posix(),
                    exists=True,
                )
            )
    return sidecars


def _integrity_state(
    *,
    exists: bool,
    expected_sidecars: list[LibrarySidecar],
    missing_expected: list[LibrarySidecar],
) -> str:
    if not exists:
        return "missing_media"
    if missing_expected:
        return "partial_sidecars"
    if expected_sidecars:
        return "complete"
    return "media_only"


def _relative_file_exists(*, root: Path, relative_path: str | None) -> bool:
    if not relative_path:
        return False
    path = _safe_archive_path(root=root, relative_path=relative_path)
    return bool(path and path.exists() and path.is_file())


def _safe_archive_path(*, root: Path, relative_path: str) -> Path | None:
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate


def _bytes_label(value: int) -> str:
    if value >= 1024**4:
        return f"{value / 1024**4:.1f} TB"
    if value >= 1024**3:
        return f"{value / 1024**3:.1f} GB"
    if value >= 1024**2:
        return f"{value / 1024**2:.0f} MB"
    if value >= 1024:
        return f"{value / 1024:.0f} KB"
    if value > 0:
        return f"{value} B"
    return "0 MB"
