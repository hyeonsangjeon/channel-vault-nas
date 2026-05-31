"""Storage scanner endpoints."""

from fastapi import APIRouter

from app.config import settings
from app.schemas.storage import StorageScanRead
from app.services.storage_scanner import build_storage_scan

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/scan", response_model=StorageScanRead)
async def get_storage_scan() -> StorageScanRead:
    """Return a filesystem-backed scan of the archive root."""
    return build_storage_scan(settings.download_dir)
