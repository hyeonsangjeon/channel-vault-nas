"""Dashboard endpoint for the Archive Observatory."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.dashboard import DashboardSnapshot
from app.services.dashboard import build_dashboard_snapshot

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=DashboardSnapshot)
async def get_dashboard(db: DbSession) -> DashboardSnapshot:
    """Return a DB-backed archive observatory snapshot."""
    return await build_dashboard_snapshot(db, download_dir=settings.download_dir)
