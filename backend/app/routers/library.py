"""Library and recovery endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.library import (
    LibraryFile,
    LibraryItem,
    LibrarySnapshot,
    RescanApplyResult,
    RescanPlan,
)
from app.services.archive_rescan import apply_rescan_plan, build_rescan_plan
from app.services.library_index import (
    build_library_snapshot,
    first_streamable_file,
    get_library_item,
    list_library_files,
)

router = APIRouter(prefix="/api/library", tags=["library"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


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
async def stream_library_video(video_id: int, db: DbSession) -> FileResponse:
    """Stream the first indexed media file when it exists on disk."""
    media_path = await first_streamable_file(db=db, video_id=video_id, download_dir=settings.download_dir)
    if media_path is None:
        raise HTTPException(status_code=404, detail="Media file not found.")
    return FileResponse(media_path)


@router.get("/_rescan/plan", response_model=RescanPlan)
async def get_rescan_plan() -> RescanPlan:
    """Return sidecar-backed folders that can rebuild the metadata DB."""
    return build_rescan_plan(settings.download_dir)


@router.post("/_rescan/apply", response_model=RescanApplyResult)
async def apply_library_rescan(db: DbSession) -> RescanApplyResult:
    """Index sidecar-backed folders into SQLite without moving files."""
    return await apply_rescan_plan(db, settings.download_dir)
