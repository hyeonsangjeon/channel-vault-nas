"""Runtime settings endpoints."""

from fastapi import APIRouter

from app.schemas.settings import RuntimeSettingsRead
from app.services.runtime_settings import get_runtime_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/runtime", response_model=RuntimeSettingsRead)
async def read_runtime_settings() -> RuntimeSettingsRead:
    """Return non-secret runtime flags and tool availability."""
    return get_runtime_settings()
