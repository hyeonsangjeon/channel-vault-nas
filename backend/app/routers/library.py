"""Library and recovery endpoints."""

import mimetypes
from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.library import (
    LibraryFile,
    LibraryItem,
    LibrarySnapshot,
    LibraryViewBundle,
    LibraryViewImportRequest,
    LibraryViewImportResult,
    LibraryViewRead,
    LibraryViewWrite,
    RescanApplyResult,
    RescanPlan,
)
from app.services.archive_rescan import apply_rescan_plan, build_rescan_plan
from app.services.library_index import (
    build_library_snapshot,
    first_streamable_file,
    get_library_item,
    list_library_files,
    streamable_file_by_id,
)
from app.services.library_views import (
    delete_library_view,
    export_library_views,
    import_library_views,
    list_library_views,
    save_library_view,
)

router = APIRouter(prefix="/api/library", tags=["library"])
DbSession = Annotated[AsyncSession, Depends(get_db)]
STREAM_CHUNK_SIZE = 1024 * 1024


@router.get("", response_model=LibrarySnapshot)
async def get_library(
    db: DbSession,
    channel_id: int | None = None,
    query: str | None = None,
    status: str | None = None,
    integrity: str | None = None,
    codec: str | None = None,
    missing_sidecar: str | None = None,
) -> LibrarySnapshot:
    """Return the searchable DB-backed archive library."""
    return await build_library_snapshot(
        db=db,
        download_dir=settings.download_dir,
        channel_id=channel_id,
        query=query,
        status=status,
        integrity=integrity,
        codec=codec,
        missing_sidecar=missing_sidecar,
    )


@router.get("/views", response_model=list[LibraryViewRead])
async def get_saved_library_views(db: DbSession, limit: int = 20) -> list[LibraryViewRead]:
    """Return persisted reusable library filter views."""
    return await list_library_views(db=db, limit=limit)


@router.post("/views", response_model=LibraryViewRead)
async def post_saved_library_view(payload: LibraryViewWrite, db: DbSession) -> LibraryViewRead:
    """Create or update a reusable library filter view."""
    return await save_library_view(db=db, payload=payload)


@router.get("/views/export", response_model=LibraryViewBundle)
async def export_saved_library_views(db: DbSession, limit: int = 50) -> LibraryViewBundle:
    """Return saved library views as a portable bundle."""
    return await export_library_views(db=db, limit=limit)


@router.post("/views/import", response_model=LibraryViewImportResult)
async def import_saved_library_views(payload: LibraryViewImportRequest, db: DbSession) -> LibraryViewImportResult:
    """Import saved library views from a portable bundle."""
    return await import_library_views(db=db, payload=payload)


@router.delete("/views/{view_id:int}")
async def delete_saved_library_view(view_id: int, db: DbSession) -> dict[str, bool]:
    """Delete a reusable library filter view."""
    deleted = await delete_library_view(db=db, view_id=view_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Library view not found.")
    return {"deleted": True}


@router.get("/{video_id:int}", response_model=LibraryItem)
async def get_library_video(video_id: int, db: DbSession) -> LibraryItem:
    """Return one indexed library item."""
    item = await get_library_item(db=db, video_id=video_id, download_dir=settings.download_dir)
    if item is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return item


@router.get("/{video_id:int}/files", response_model=list[LibraryFile])
async def get_library_files(video_id: int, db: DbSession) -> list[LibraryFile]:
    """Return indexed media files for one library item."""
    files = await list_library_files(db=db, video_id=video_id, download_dir=settings.download_dir)
    if files is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return files


@router.get("/{video_id:int}/stream")
async def stream_library_video(
    video_id: int,
    db: DbSession,
    range_header: Annotated[str | None, Header(alias="Range")] = None,
) -> Response:
    """Stream the first indexed media file when it exists on disk."""
    media_path = await first_streamable_file(db=db, video_id=video_id, download_dir=settings.download_dir)
    if media_path is None:
        raise HTTPException(status_code=404, detail="Media file not found.")
    return _stream_file(media_path, range_header)


@router.get("/{video_id:int}/files/{media_file_id:int}/stream")
async def stream_library_media_file(
    video_id: int,
    media_file_id: int,
    db: DbSession,
    range_header: Annotated[str | None, Header(alias="Range")] = None,
) -> Response:
    """Stream one indexed media file when it belongs to the video and exists."""
    media_path = await streamable_file_by_id(
        db=db,
        video_id=video_id,
        media_file_id=media_file_id,
        download_dir=settings.download_dir,
    )
    if media_path is None:
        raise HTTPException(status_code=404, detail="Media file not found.")
    return _stream_file(media_path, range_header)


@router.get("/_rescan/plan", response_model=RescanPlan)
async def get_rescan_plan() -> RescanPlan:
    """Return sidecar-backed folders that can rebuild the metadata DB."""
    return build_rescan_plan(settings.download_dir)


@router.post("/_rescan/apply", response_model=RescanApplyResult)
async def apply_library_rescan(db: DbSession) -> RescanApplyResult:
    """Index sidecar-backed folders into SQLite without moving files."""
    return await apply_rescan_plan(db, settings.download_dir)


def _stream_file(path: Path, range_header: str | None) -> Response:
    size = path.stat().st_size
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    base_headers = {"Accept-Ranges": "bytes"}

    if size == 0:
        if range_header:
            return _range_not_satisfiable(size=size, media_type=media_type)
        return Response(content=b"", media_type=media_type, headers={**base_headers, "Content-Length": "0"})

    if range_header:
        try:
            start, end = _parse_range_header(range_header, size=size)
        except ValueError:
            return _range_not_satisfiable(size=size, media_type=media_type)
        headers = {
            **base_headers,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(end - start + 1),
        }
        return StreamingResponse(
            _file_range_iterator(path=path, start=start, end=end),
            status_code=206,
            headers=headers,
            media_type=media_type,
        )

    return StreamingResponse(
        _file_range_iterator(path=path, start=0, end=size - 1),
        headers={**base_headers, "Content-Length": str(size)},
        media_type=media_type,
    )


def _parse_range_header(range_header: str, *, size: int) -> tuple[int, int]:
    if not range_header.startswith("bytes="):
        raise ValueError("Only byte ranges are supported.")
    range_value = range_header.removeprefix("bytes=").strip()
    if "," in range_value:
        raise ValueError("Multi-range requests are not supported.")

    start_text, separator, end_text = range_value.partition("-")
    if separator != "-" or (not start_text and not end_text):
        raise ValueError("Malformed range header.")

    if start_text:
        if not start_text.isdigit() or (end_text and not end_text.isdigit()):
            raise ValueError("Malformed range offsets.")
        start = int(start_text)
        end = int(end_text) if end_text else size - 1
    else:
        if not end_text.isdigit():
            raise ValueError("Malformed suffix range.")
        suffix_length = int(end_text)
        if suffix_length <= 0:
            raise ValueError("Suffix range must be positive.")
        start = max(size - suffix_length, 0)
        end = size - 1

    if start < 0 or end < start or start >= size:
        raise ValueError("Range is outside the media file.")
    return start, min(end, size - 1)


def _range_not_satisfiable(*, size: int, media_type: str) -> Response:
    return Response(
        status_code=416,
        media_type=media_type,
        headers={"Accept-Ranges": "bytes", "Content-Range": f"bytes */{size}"},
    )


def _file_range_iterator(*, path: Path, start: int, end: int) -> Iterator[bytes]:
    with path.open("rb") as media_file:
        media_file.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = media_file.read(min(STREAM_CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk
