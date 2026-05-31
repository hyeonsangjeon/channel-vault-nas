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

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/sync", response_model=list[SyncJobRead])
async def get_sync_jobs(db: DbSession) -> list[SyncJobRead]:
    """Return recent metadata sync jobs."""
    return await list_sync_jobs(db)


@router.get("/downloads", response_model=list[DownloadJobRead])
async def get_download_jobs(db: DbSession, channel_id: int | None = None) -> list[DownloadJobRead]:
    """Return download queue rows."""
    return await list_download_jobs(db=db, channel_id=channel_id)


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
