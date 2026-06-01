"""Storage scanner endpoints."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.archive import MediaFile
from app.schemas.storage import (
    StorageDriftActionRequest,
    StorageDriftActionResult,
    StorageOrphanActionRequest,
    StorageOrphanQuarantineResult,
    StorageQuarantineListRead,
    StorageQuarantineRestoreRequest,
    StorageQuarantineRestoreResult,
    StorageScanRead,
)
from app.services.audit_export import audit_export_response
from app.services.storage_drift import prune_missing_media_index, recover_unindexed_media
from app.services.storage_orphans import (
    list_quarantined_sidecars,
    quarantine_orphan_sidecar,
    restore_quarantined_sidecar,
)
from app.services.storage_scanner import build_storage_scan, storage_scan_export_rows

router = APIRouter(prefix="/api/storage", tags=["storage"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/scan", response_model=StorageScanRead)
async def get_storage_scan(db: DbSession) -> StorageScanRead:
    """Return a filesystem-backed scan of the archive root."""
    return await _read_storage_scan(db)


@router.get("/scan/export", response_class=Response)
async def export_storage_scan(
    db: DbSession,
    export_format: Literal["ndjson", "csv"] = Query(default="csv", alias="format"),
) -> Response:
    """Download the current filesystem-backed storage scan as NDJSON or CSV."""
    scan = await _read_storage_scan(db)
    return audit_export_response(
        rows=storage_scan_export_rows(scan),
        filename_prefix="storage-scan",
        export_format=export_format,
    )


@router.post("/drift/recover-unindexed", response_model=StorageDriftActionResult)
async def recover_unindexed_storage_drift(
    payload: StorageDriftActionRequest,
    db: DbSession,
) -> StorageDriftActionResult:
    """Index one unindexed media folder through its local sidecar metadata."""
    return await recover_unindexed_media(
        db=db,
        download_dir=settings.download_dir,
        relative_path=payload.relative_path,
        dry_run=payload.dry_run,
    )


@router.post("/drift/prune-missing-index", response_model=StorageDriftActionResult)
async def prune_missing_storage_index(
    payload: StorageDriftActionRequest,
    db: DbSession,
) -> StorageDriftActionResult:
    """Remove stale SQLite media index rows when the media file is missing on disk."""
    return await prune_missing_media_index(
        db=db,
        download_dir=settings.download_dir,
        relative_path=payload.relative_path,
        dry_run=payload.dry_run,
    )


@router.post("/orphans/quarantine", response_model=StorageOrphanQuarantineResult)
async def quarantine_storage_orphan(
    payload: StorageOrphanActionRequest,
) -> StorageOrphanQuarantineResult:
    """Preview or move one orphan sidecar into the hidden archive quarantine folder."""
    return await quarantine_orphan_sidecar(
        download_dir=settings.download_dir,
        relative_path=payload.relative_path,
        dry_run=payload.dry_run,
    )


@router.get("/orphans/quarantine", response_model=StorageQuarantineListRead)
async def get_storage_orphan_quarantine(
    limit: int = Query(default=100, ge=1, le=500),
) -> StorageQuarantineListRead:
    """List orphan sidecars currently held in the hidden archive quarantine."""
    return list_quarantined_sidecars(download_dir=settings.download_dir, limit=limit)


@router.post("/orphans/quarantine/restore", response_model=StorageQuarantineRestoreResult)
async def restore_storage_orphan_quarantine(
    payload: StorageQuarantineRestoreRequest,
) -> StorageQuarantineRestoreResult:
    """Preview or restore one quarantined sidecar back to its original path."""
    return await restore_quarantined_sidecar(
        download_dir=settings.download_dir,
        quarantine_relative_path=payload.quarantine_relative_path,
        dry_run=payload.dry_run,
    )


async def _read_storage_scan(db: AsyncSession) -> StorageScanRead:
    """Build the storage scan with current SQLite media index paths."""
    rows = await db.execute(select(MediaFile.relative_path))
    indexed_paths = {path for path in rows.scalars().all() if path}
    return build_storage_scan(settings.download_dir, indexed_media_paths=indexed_paths)
