"""Operator readiness endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.operations import OperationsReadiness
from app.services.operations import build_operations_readiness

router = APIRouter(prefix="/api/ops", tags=["operations"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/readiness", response_model=OperationsReadiness)
async def get_operations_readiness(db: DbSession) -> OperationsReadiness:
    """Return the app-level operational mission board."""
    return await build_operations_readiness(
        db=db,
        download_dir=settings.download_dir,
        worker_enabled=settings.download_worker_enabled,
        download_scheduler_enabled=settings.download_worker_scheduler_enabled,
        metadata_scheduler_enabled=settings.metadata_sync_scheduler_enabled,
    )
