"""Job queue endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.jobs import (
    DownloadJobActionResult,
    DownloadJobBulkRequest,
    DownloadJobBulkResult,
    DownloadJobRead,
    DownloadWorkerPlan,
    DownloadWorkerRunRead,
    DownloadWorkerRunRequest,
    DownloadWorkerRunResult,
    QueuePreflightPlan,
    SyncJobRead,
)
from app.schemas.settings import MetadataSyncTickRead, SchedulerTickRead
from app.services.channel_sync import list_sync_jobs
from app.services.download_queue import (
    DownloadJobNotFoundError,
    build_queue_preflight_plan,
    bulk_update_download_jobs,
    cancel_download_job,
    list_download_jobs,
    retry_download_job,
)
from app.services.download_worker import (
    build_download_worker_plan,
    list_download_worker_runs,
    run_download_worker_once,
    stop_running_download_job,
)
from app.services.metadata_scheduler import (
    list_metadata_sync_ticks,
    run_metadata_sync_scheduler_tick,
)
from app.services.runtime_settings import list_scheduler_ticks

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/sync", response_model=list[SyncJobRead])
async def get_sync_jobs(
    db: DbSession,
    channel_id: int | None = None,
    status: str | None = None,
    trigger: str | None = None,
    limit: int = 50,
) -> list[SyncJobRead]:
    """Return recent metadata sync jobs."""
    return await list_sync_jobs(db, channel_id=channel_id, status=status, trigger=trigger, limit=limit)


@router.get("/downloads", response_model=list[DownloadJobRead])
async def get_download_jobs(
    db: DbSession,
    channel_id: int | None = None,
    status: str | None = None,
    preflight_status: str | None = None,
    limit: int = 100,
) -> list[DownloadJobRead]:
    """Return download queue rows."""
    return await list_download_jobs(
        db=db,
        channel_id=channel_id,
        status=status,
        preflight_status=preflight_status,
        limit=limit,
    )


@router.get("/downloads/preflight", response_model=QueuePreflightPlan)
async def get_download_preflight(db: DbSession, channel_id: int | None = None) -> QueuePreflightPlan:
    """Return a dry-run launch checklist for candidate and queued jobs."""
    return await build_queue_preflight_plan(db=db, channel_id=channel_id)


@router.get("/downloads/worker/plan", response_model=DownloadWorkerPlan)
async def get_download_worker_plan(
    db: DbSession,
    channel_id: int | None = None,
    limit: int | None = None,
) -> DownloadWorkerPlan:
    """Return the next queued jobs a safe worker would claim."""
    return await build_download_worker_plan(db=db, channel_id=channel_id, limit=limit)


@router.get("/downloads/worker/runs", response_model=list[DownloadWorkerRunRead])
async def get_download_worker_runs(
    db: DbSession,
    channel_id: int | None = None,
    status: str | None = None,
    dry_run: bool | None = None,
    failed_only: bool = False,
    limit: int = 10,
) -> list[DownloadWorkerRunRead]:
    """Return recent persisted worker pass audits."""
    return await list_download_worker_runs(
        db=db,
        channel_id=channel_id,
        status=status,
        dry_run=dry_run,
        failed_only=failed_only,
        limit=limit,
    )


@router.get("/downloads/scheduler/ticks", response_model=list[SchedulerTickRead])
async def get_download_scheduler_ticks(
    db: DbSession,
    status: str | None = None,
    min_duration_seconds: int | None = None,
    interval_seconds: int | None = None,
    worker_limit: int | None = None,
    limit: int = 12,
) -> list[SchedulerTickRead]:
    """Return recent persisted scheduler tick telemetry."""
    return await list_scheduler_ticks(
        db=db,
        status=status,
        min_duration_seconds=min_duration_seconds,
        interval_seconds=interval_seconds,
        worker_limit=worker_limit,
        limit=limit,
    )


@router.get("/sync/scheduler/ticks", response_model=list[MetadataSyncTickRead])
async def get_metadata_sync_scheduler_ticks(
    db: DbSession,
    status: str | None = None,
    min_duration_seconds: int | None = None,
    interval_seconds: int | None = None,
    scheduler_limit: int | None = None,
    limit: int = 12,
) -> list[MetadataSyncTickRead]:
    """Return recent persisted metadata sync scheduler telemetry."""
    return await list_metadata_sync_ticks(
        db=db,
        status=status,
        min_duration_seconds=min_duration_seconds,
        interval_seconds=interval_seconds,
        scheduler_limit=scheduler_limit,
        limit=limit,
    )


@router.post("/sync/scheduler/run-once", response_model=MetadataSyncTickRead)
async def run_metadata_sync_scheduler_once() -> MetadataSyncTickRead:
    """Run one metadata scheduler pass immediately, even when the loop is disabled."""
    return await run_metadata_sync_scheduler_tick(force=True, trigger="manual")


@router.post("/downloads/worker/run-once", response_model=DownloadWorkerRunResult)
async def run_download_worker(payload: DownloadWorkerRunRequest, db: DbSession) -> DownloadWorkerRunResult:
    """Run one bounded worker pass; default request is a safe dry-run."""
    return await run_download_worker_once(db=db, payload=payload)


@router.post("/downloads/{job_id:int}/stop", response_model=DownloadJobActionResult)
async def stop_download(job_id: int, db: DbSession) -> DownloadJobActionResult:
    """Stop a running media worker job or cancel a queued/candidate job."""
    try:
        return await stop_running_download_job(db=db, job_id=job_id)
    except DownloadJobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/downloads/bulk", response_model=DownloadJobBulkResult)
async def bulk_download_jobs(payload: DownloadJobBulkRequest, db: DbSession) -> DownloadJobBulkResult:
    """Apply a metadata-only bulk operation to download jobs."""
    return await bulk_update_download_jobs(db=db, payload=payload)


@router.post("/downloads/{job_id:int}/retry", response_model=DownloadJobActionResult)
async def retry_download(job_id: int, db: DbSession) -> DownloadJobActionResult:
    """Retry or queue a candidate download job."""
    try:
        return await retry_download_job(db=db, job_id=job_id)
    except DownloadJobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/downloads/{job_id:int}/cancel", response_model=DownloadJobActionResult)
async def cancel_download(job_id: int, db: DbSession) -> DownloadJobActionResult:
    """Cancel a download job before media transfer starts."""
    try:
        return await cancel_download_job(db=db, job_id=job_id)
    except DownloadJobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
