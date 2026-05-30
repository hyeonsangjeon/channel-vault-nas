"""Health endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter

from app.config import settings
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return application health and version metadata."""
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        checked_at=datetime.now(UTC),
    )
