"""Redacted public-alpha diagnostic bundle generation."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import (
    ArchiveEventLog,
    Channel,
    ChannelPolicy,
    DownloadJob,
    DownloadSchedulerTick,
    DownloadWorkerRun,
    MediaFile,
    MetadataSyncTick,
    StoragePressureSnapshot,
    SyncJob,
    Video,
)
from app.schemas.operations import OperationsReadiness, SupportBundleRead
from app.services.operations import build_operations_readiness
from app.services.storage_scanner import build_storage_scan

_SENSITIVE_KEY_PARTS = ("token", "secret", "password", "authorization", "cookie")
_PATH_KEYS = {
    "archive_dir",
    "archive_path",
    "destination_relative_path",
    "download_dir",
    "file",
    "filename",
    "info_json_path",
    "managed_env_file",
    "metadata_dir",
    "nfo_path",
    "original_relative_path",
    "path",
    "relative_path",
    "root",
    "runtime_env_file",
    "thumbnail_path",
}
_CONTENT_KEYS = {
    "channel_title",
    "description",
    "external_id",
    "handle",
    "source_url",
    "thumbnail_url",
    "title",
    "url",
    "video_external_id",
    "video_title",
}
_COMMAND_KEYS = {"command", "command_preview", "restart_command"}


async def build_support_bundle(
    db: AsyncSession,
    *,
    app_name: str,
    app_version: str,
    app_host: str,
    app_port: int,
    database_url: str,
    download_dir: str | Path,
    metadata_dir: str | Path,
    runtime_env_file: str,
    worker_enabled: bool,
    download_scheduler_enabled: bool,
    metadata_scheduler_enabled: bool,
    auth_enabled: bool,
    restart_adapter: str,
    restart_adapter_execute: bool,
) -> SupportBundleRead:
    """Build a shareable issue-report bundle without leaking local secrets."""
    generated_at = datetime.now(UTC)
    indexed_paths = await _indexed_media_paths(db)
    scan = build_storage_scan(download_dir, indexed_media_paths=indexed_paths)
    readiness = await build_operations_readiness(
        db=db,
        download_dir=download_dir,
        worker_enabled=worker_enabled,
        download_scheduler_enabled=download_scheduler_enabled,
        metadata_scheduler_enabled=metadata_scheduler_enabled,
        auth_enabled=auth_enabled,
        app_host=app_host,
    )
    return SupportBundleRead(
        kind="channel_vault_support_bundle",
        generated_at=generated_at,
        redaction={
            "safe_for_public_issue": True,
            "removed": [
                "operator tokens",
                "secrets",
                "absolute paths",
                "source URLs",
                "channel/video titles",
                "download commands",
            ],
            "path_placeholder": "<path:redacted>",
            "content_placeholder": "<content:redacted>",
        },
        app={
            "name": app_name,
            "version": app_version,
            "host_mode": _host_mode(app_host),
            "port": app_port,
            "database": _database_summary(database_url),
            "download_dir": "<archive_root>",
            "metadata_dir": _redact_path(metadata_dir),
            "runtime_env_file": _redact_path(runtime_env_file),
            "auth_enabled": auth_enabled,
            "worker_enabled": worker_enabled,
            "download_scheduler_enabled": download_scheduler_enabled,
            "metadata_scheduler_enabled": metadata_scheduler_enabled,
            "restart_adapter": restart_adapter,
            "restart_adapter_execute": restart_adapter_execute,
        },
        counts={
            "channels": await _count(db, Channel.id),
            "videos": await _count(db, Video.id),
            "policies": await _count(db, ChannelPolicy.id),
            "media_files": await _count(db, MediaFile.id),
            "sync_jobs": await _count(db, SyncJob.id),
            "download_jobs": await _count(db, DownloadJob.id),
            "worker_runs": await _count(db, DownloadWorkerRun.id),
            "storage_snapshots": await _count(db, StoragePressureSnapshot.id),
            "events": await _count(db, ArchiveEventLog.id),
            "download_jobs_by_status": await _status_counts(db, DownloadJob.status),
            "sync_jobs_by_status": await _status_counts(db, SyncJob.status),
        },
        queue={
            "candidate_count": await _count_where(db, DownloadJob.id, DownloadJob.status == "candidate"),
            "queued_count": await _count_where(db, DownloadJob.id, DownloadJob.status == "queued"),
            "running_count": await _count_where(db, DownloadJob.id, DownloadJob.status == "running"),
            "failed_count": await _count_where(db, DownloadJob.id, DownloadJob.status == "failed"),
            "latest_worker_runs": await _latest_worker_runs(db),
        },
        schedulers={
            "download_worker": {
                "enabled": download_scheduler_enabled,
                "latest_ticks": await _latest_download_ticks(db),
            },
            "metadata_sync": {
                "enabled": metadata_scheduler_enabled,
                "latest_ticks": await _latest_metadata_ticks(db),
            },
        },
        storage={
            "scanned_at": scan.scanned_at,
            "archive_root": "<archive_root>",
            "exists": scan.volume.exists,
            "archive_bytes": scan.volume.archive_bytes,
            "archive_label": scan.volume.archive_label,
            "free_label": scan.volume.free_label,
            "pressure_percent": scan.volume.pressure_percent,
            "file_count": scan.volume.file_count,
            "dir_count": scan.volume.dir_count,
            "channel_folder_count": len(scan.channels),
            "orphan_sidecar_count": len(scan.orphan_sidecars),
            "drift": {
                "unindexed_media_count": scan.drift.unindexed_media_count,
                "indexed_missing_count": scan.drift.indexed_missing_count,
            },
            "top_extensions": [
                {"extension": item.extension, "bytes": item.bytes, "count": item.count}
                for item in scan.top_extensions[:8]
            ],
            "warnings": [_redact_text(warning) or "" for warning in scan.warnings],
        },
        readiness=_redact_readiness(readiness),
        recent_events=await _recent_events(db),
    )


async def _indexed_media_paths(db: AsyncSession) -> set[str]:
    rows = await db.execute(select(MediaFile.relative_path))
    return {path for path in rows.scalars().all() if path}


async def _count(db: AsyncSession, column: Any) -> int:
    return int(await db.scalar(select(func.count(column))) or 0)


async def _count_where(db: AsyncSession, column: Any, condition: Any) -> int:
    return int(await db.scalar(select(func.count(column)).where(condition)) or 0)


async def _status_counts(db: AsyncSession, column: Any) -> dict[str, int]:
    rows = (await db.execute(select(column, func.count()).group_by(column))).all()
    return {str(status or "unknown"): int(count or 0) for status, count in rows}


async def _latest_worker_runs(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                select(DownloadWorkerRun)
                .order_by(desc(DownloadWorkerRun.started_at), desc(DownloadWorkerRun.id))
                .limit(5)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": row.id,
            "status": row.status,
            "dry_run": row.dry_run,
            "started_count": row.started_count,
            "completed_count": row.completed_count,
            "failed_count": row.failed_count,
            "skipped_reason": _redact_text(row.skipped_reason),
            "duration_seconds": _duration_seconds(row.started_at, row.completed_at),
            "started_at": row.started_at,
            "completed_at": row.completed_at,
        }
        for row in rows
    ]


async def _latest_download_ticks(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                select(DownloadSchedulerTick)
                .order_by(desc(DownloadSchedulerTick.started_at), desc(DownloadSchedulerTick.id))
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": row.id,
            "trigger": row.trigger,
            "status": row.status,
            "scheduler_enabled": row.scheduler_enabled,
            "worker_enabled": row.worker_enabled,
            "interval_seconds": row.interval_seconds,
            "limit": row.limit,
            "started_count": row.started_count,
            "completed_count": row.completed_count,
            "failed_count": row.failed_count,
            "skipped_reason": _redact_text(row.skipped_reason),
            "error_message": _redact_text(row.error_message),
            "duration_seconds": _duration_seconds(row.started_at, row.completed_at),
            "started_at": row.started_at,
            "completed_at": row.completed_at,
        }
        for row in rows
    ]


async def _latest_metadata_ticks(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                select(MetadataSyncTick).order_by(desc(MetadataSyncTick.started_at), desc(MetadataSyncTick.id)).limit(10)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": row.id,
            "trigger": row.trigger,
            "status": row.status,
            "scheduler_enabled": row.scheduler_enabled,
            "interval_seconds": row.interval_seconds,
            "limit": row.limit,
            "due_channel_count": row.due_channel_count,
            "synced_count": row.synced_count,
            "failed_count": row.failed_count,
            "videos_seen_count": row.videos_seen_count,
            "videos_created_count": row.videos_created_count,
            "candidates_created_count": row.candidates_created_count,
            "skipped_reason": _redact_text(row.skipped_reason),
            "error_message": _redact_text(row.error_message),
            "duration_seconds": _duration_seconds(row.started_at, row.completed_at),
            "started_at": row.started_at,
            "completed_at": row.completed_at,
        }
        for row in rows
    ]


async def _recent_events(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                select(ArchiveEventLog).order_by(desc(ArchiveEventLog.occurred_at), desc(ArchiveEventLog.id)).limit(25)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": row.id,
            "type": row.type,
            "occurred_at": row.occurred_at,
            "data": _redact_value(row.data or {}),
        }
        for row in rows
    ]


def _duration_seconds(started_at: datetime | None, completed_at: datetime | None) -> float | None:
    if started_at is None or completed_at is None:
        return None
    return round(max(0.0, (_as_utc(completed_at) - _as_utc(started_at)).total_seconds()), 3)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _host_mode(host: str) -> str:
    normalized = host.strip().lower()
    if normalized in {"0.0.0.0", "::", "[::]", "*"}:
        return "network"
    if normalized == "localhost" or normalized.startswith("127.") or normalized == "::1":
        return "loopback"
    return "custom"


def _database_summary(database_url: str) -> dict[str, Any]:
    scheme = database_url.split(":", 1)[0] if ":" in database_url else "unknown"
    return {
        "scheme": scheme,
        "path": "<database:redacted>" if scheme.startswith("sqlite") else None,
        "dsn_redacted": True,
    }


def _redact_readiness(readiness: OperationsReadiness) -> OperationsReadiness:
    safe = readiness.model_copy(deep=True)
    safe.warnings = [_redact_text(warning) or "" for warning in safe.warnings]
    for mission in safe.missions:
        mission.primary_value = _redact_text(mission.primary_value) or ""
        mission.secondary_value = _redact_text(mission.secondary_value) or ""
        if mission.target_path:
            mission.target_path = "<path:redacted>"
    return safe


def _redact_value(value: Any, key: str = "") -> Any:
    key_lower = key.lower()
    if any(part in key_lower for part in _SENSITIVE_KEY_PARTS):
        return "<secret:redacted>"
    if key_lower in _COMMAND_KEYS:
        return "<command:redacted>"
    if key_lower in _CONTENT_KEYS:
        return "<content:redacted>"
    if key_lower in _PATH_KEYS or key_lower.endswith("_path") or key_lower.endswith("_dir"):
        return _redact_path(value)
    if isinstance(value, dict):
        return {str(child_key): _redact_value(child_value, str(child_key)) for child_key, child_value in value.items()}
    if isinstance(value, list):
        return [_redact_value(item, key) for item in value[:25]]
    if isinstance(value, str):
        return _redact_text(value)
    return value


def _redact_path(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, list):
        return [_redact_path(item) for item in value[:25]]
    if not isinstance(value, str):
        return "<path:redacted>"
    if not value.strip():
        return value
    return "<path:redacted>"


def _redact_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return value
    lowered = stripped.lower()
    if any(marker in lowered for marker in ("token=", "secret=", "password=", "authorization")):
        return "<secret:redacted>"
    if "://" in stripped:
        return "<url:redacted>"
    if stripped.startswith(("/", "~/", "../")):
        return "<path:redacted>"
    if any(marker in lowered for marker in (" path=", " file=", " dir=", " archive_path=")):
        return "<path:redacted>"
    return value[:500]
