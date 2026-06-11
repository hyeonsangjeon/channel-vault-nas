"""Runtime settings endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.settings import (
    RuntimeRestartAdapter,
    RuntimeRestartRequest,
    RuntimeRestartResult,
    RuntimeSettingsApplyResult,
    RuntimeSettingsRead,
    RuntimeSettingsUpdate,
)
from app.services.runtime_settings import (
    apply_runtime_settings,
    get_runtime_restart_adapter,
    get_runtime_settings,
    request_runtime_restart,
)

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


@router.get("/runtime/restart", response_model=RuntimeRestartAdapter)
async def read_runtime_restart_adapter() -> RuntimeRestartAdapter:
    """Return the deployment-aware restart adapter for this process."""
    return get_runtime_restart_adapter()


@router.post("/runtime/restart", response_model=RuntimeRestartResult)
async def restart_runtime(payload: RuntimeRestartRequest) -> RuntimeRestartResult:
    """Request a restart through the configured deployment adapter."""
    return await request_runtime_restart(payload)
