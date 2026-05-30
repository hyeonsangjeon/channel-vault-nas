"""Mock dashboard endpoint for the first Archive Observatory slice."""

from fastapi import APIRouter

from app.schemas.dashboard import DashboardSnapshot
from app.services.mock_observatory import build_dashboard_snapshot

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSnapshot)
async def get_dashboard() -> DashboardSnapshot:
    """Return a mock archive observatory snapshot."""
    return build_dashboard_snapshot()
