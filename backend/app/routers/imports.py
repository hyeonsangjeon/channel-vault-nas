"""Archive import endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.archive import ArchiveTxtPreviewRequest, ArchiveTxtPreviewResult, ImportSource
from app.services.archive_txt import preview_archive_txt
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
