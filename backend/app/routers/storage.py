"""Storage scanner endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.archive import MediaFile
from app.schemas.storage import StorageScanRead
from app.services.storage_scanner import build_storage_scan

router = APIRouter(prefix="/api/storage", tags=["storage"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/scan", response_model=StorageScanRead)
async def get_storage_scan(db: DbSession) -> StorageScanRead:
    """Return a filesystem-backed scan of the archive root."""
    rows = await db.execute(select(MediaFile.relative_path))
    indexed_paths = {path for path in rows.scalars().all() if path}
    return build_storage_scan(settings.download_dir, indexed_media_paths=indexed_paths)
