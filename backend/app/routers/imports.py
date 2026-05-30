"""Archive import endpoints."""

from fastapi import APIRouter

from app.schemas.archive import ImportSource
from app.services.mock_archive import build_import_sources

router = APIRouter(prefix="/api/imports", tags=["imports"])


@router.get("/sources", response_model=list[ImportSource])
async def get_import_sources() -> list[ImportSource]:
    """Return supported import lanes for owned archives and local folders."""
    return build_import_sources()
