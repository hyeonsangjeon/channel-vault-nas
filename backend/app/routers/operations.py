"""Operator readiness endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.operations import (
    DemoWorkspaceClearResult,
    DemoWorkspaceResult,
    MountDoctorRead,
    OperationsReadiness,
    SupportBundleRead,
)
from app.services.demo_workspace import clear_demo_workspace, seed_demo_workspace
from app.services.mount_doctor import build_mount_doctor
from app.services.operations import build_operations_readiness
from app.services.support_bundle import build_support_bundle

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
        auth_enabled=bool(settings.auth_token.strip()),
        app_host=settings.app_host,
    )


@router.get("/mount-doctor", response_model=MountDoctorRead)
async def get_mount_doctor() -> MountDoctorRead:
    """Return NAS volume mount and persistence diagnostics."""
    return build_mount_doctor(
        database_url=settings.database_url,
        metadata_dir=settings.metadata_dir,
        download_dir=settings.download_dir,
        runtime_env_file=settings.runtime_env_file,
    )


@router.post("/demo-workspace", response_model=DemoWorkspaceResult)
async def create_demo_workspace(db: DbSession) -> DemoWorkspaceResult:
    """Seed the safe public-alpha demo workspace when the app is empty."""
    return await seed_demo_workspace(db=db, download_dir=settings.download_dir)


@router.delete("/demo-workspace", response_model=DemoWorkspaceClearResult)
async def delete_demo_workspace(db: DbSession) -> DemoWorkspaceClearResult:
    """Remove only the safe public-alpha demo workspace."""
    return await clear_demo_workspace(db=db, download_dir=settings.download_dir)


@router.get("/support-bundle", response_model=SupportBundleRead)
async def get_support_bundle(db: DbSession) -> SupportBundleRead:
    """Return a redacted diagnostic snapshot for public-alpha support."""
    return await build_support_bundle(
        db=db,
        app_name=settings.app_name,
        app_version=settings.app_version,
        app_host=settings.app_host,
        app_port=settings.app_port,
        database_url=settings.database_url,
        download_dir=settings.download_dir,
        metadata_dir=settings.metadata_dir,
        runtime_env_file=settings.runtime_env_file,
        worker_enabled=settings.download_worker_enabled,
        download_scheduler_enabled=settings.download_worker_scheduler_enabled,
        metadata_scheduler_enabled=settings.metadata_sync_scheduler_enabled,
        auth_enabled=bool(settings.auth_token.strip()),
        restart_adapter=settings.restart_adapter,
        restart_adapter_execute=settings.restart_adapter_execute,
    )
