"""Runtime settings endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.settings import (
    RuntimeSettingsApplyResult,
    RuntimeSettingsRead,
    RuntimeSettingsUpdate,
)
from app.services.runtime_settings import apply_runtime_settings, get_runtime_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/runtime", response_model=RuntimeSettingsRead)
async def read_runtime_settings(db: DbSession) -> RuntimeSettingsRead:
    """Return non-secret runtime flags and tool availability."""
    return await get_runtime_settings(db=db)


@router.patch("/runtime", response_model=RuntimeSettingsApplyResult)
async def update_runtime_settings(payload: RuntimeSettingsUpdate, db: DbSession) -> RuntimeSettingsApplyResult:
    """Write non-secret runtime overrides to the managed env file."""
    return await apply_runtime_settings(db=db, payload=payload)
