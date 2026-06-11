"""Archive import endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.archive import (
    ArchiveTxtPreviewRequest,
    ArchiveTxtPreviewResult,
    ArchiveTxtStageRequest,
    ArchiveTxtStageResult,
    ImportSource,
)
from app.services.archive_txt import preview_archive_txt, stage_archive_txt
from app.services.mock_archive import build_import_sources

router = APIRouter(prefix="/api/imports", tags=["imports"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/sources", response_model=list[ImportSource])
async def get_import_sources() -> list[ImportSource]:
    """Return supported import lanes for owned archives and local folders."""
    return build_import_sources()


@router.post("/archive-txt/preview", response_model=ArchiveTxtPreviewResult)
async def preview_archive_txt_import(payload: ArchiveTxtPreviewRequest, db: DbSession) -> ArchiveTxtPreviewResult:
    """Preview how a youtube-dl archive.txt maps to the current vault index."""
    return await preview_archive_txt(db, content=payload.content, channel_id=payload.channel_id)


@router.post("/archive-txt/stage", response_model=ArchiveTxtStageResult)
async def stage_archive_txt_import(payload: ArchiveTxtStageRequest, db: DbSession) -> ArchiveTxtStageResult:
    """Apply archive.txt rows as selected-channel placeholders and queue candidates."""
    result = await stage_archive_txt(
        db,
        content=payload.content,
        channel_id=payload.channel_id,
        quality=payload.quality,
        limit=payload.limit,
        create_candidates=payload.create_candidates,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return result
