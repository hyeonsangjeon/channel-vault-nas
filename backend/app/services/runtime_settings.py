"""Runtime settings snapshots and managed env overrides for operator UI."""

from __future__ import annotations

import json
import re
from pathlib import Path
from shutil import which

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.archive import DownloadSchedulerTick
from app.schemas.settings import (
    BinaryHealth,
    RuntimeEnvOverride,
    RuntimeSettingsApplyResult,
    RuntimeSettingsRead,
    RuntimeSettingsUpdate,
    SchedulerTickRead,
)
from app.services.download_scheduler import get_download_worker_scheduler_status

ENV_LINE_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=")
RUNTIME_FIELD_TO_ENV_KEY = {
    "download_worker_enabled": "CVN_DOWNLOAD_WORKER_ENABLED",
    "download_worker_scheduler_enabled": "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED",
    "download_worker_scheduler_interval_seconds": "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS",
    "download_worker_scheduler_limit": "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT",
    "ytdlp_binary": "CVN_YTDLP_BINARY",
    "ffprobe_binary": "CVN_FFPROBE_BINARY",
}


async def get_runtime_settings(*, db: AsyncSession) -> RuntimeSettingsRead:
    """Return non-secret runtime flags, pending env overrides, and scheduler ticks."""
    scheduler_ticks = await list_scheduler_ticks(db=db, limit=8)
    scheduler_status = get_download_worker_scheduler_status()
    latest_tick = scheduler_ticks[0] if scheduler_ticks else None
    if scheduler_status.last_completed_at is None and latest_tick is not None:
        scheduler_status = scheduler_status.model_copy(
            update={
                "last_started_at": latest_tick.started_at,
                "last_completed_at": latest_tick.completed_at,
                "last_error": latest_tick.error_message,
                "last_result_status": latest_tick.status,
                "next_tick_at": scheduler_status.next_tick_at or latest_tick.next_tick_at,
            }
        )

    pending_overrides = _pending_overrides()
    return RuntimeSettingsRead(
        download_worker_enabled=settings.download_worker_enabled,
        download_worker_scheduler_enabled=settings.download_worker_scheduler_enabled,
        download_worker_scheduler_interval_seconds=settings.download_worker_scheduler_interval_seconds,
        download_worker_scheduler_limit=settings.download_worker_scheduler_limit,
        download_dir=settings.download_dir,
        metadata_dir=settings.metadata_dir,
        managed_env_file=str(_runtime_env_path()),
        pending_restart=any(item.pending_restart for item in pending_overrides),
        pending_overrides=pending_overrides,
        restart_command=_restart_command(),
        scheduler_status=scheduler_status,
        scheduler_ticks=scheduler_ticks,
        binaries=[
            _binary_health(name="yt-dlp", command=settings.ytdlp_binary),
            _binary_health(name="ffprobe", command=settings.ffprobe_binary),
        ],
    )


async def apply_runtime_settings(
    *,
    db: AsyncSession,
    payload: RuntimeSettingsUpdate,
) -> RuntimeSettingsApplyResult:
    """Persist selected runtime settings to the managed env file for restart."""
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    env_updates = {
        RUNTIME_FIELD_TO_ENV_KEY[field_name]: _stringify_env_value(value)
        for field_name, value in updates.items()
        if field_name in RUNTIME_FIELD_TO_ENV_KEY
    }
    changed_keys = _write_managed_env(env_updates) if env_updates else []
    runtime = await get_runtime_settings(db=db)
    return RuntimeSettingsApplyResult(
        applied=bool(changed_keys),
        restart_required=runtime.pending_restart,
        changed_keys=changed_keys,
        managed_env_file=runtime.managed_env_file,
        restart_command=runtime.restart_command,
        runtime=runtime,
    )


async def list_scheduler_ticks(*, db: AsyncSession, limit: int = 12, status: str | None = None) -> list[SchedulerTickRead]:
    """Return newest persistent scheduler tick telemetry rows."""
    effective_limit = max(1, min(limit, 100))
    query = select(DownloadSchedulerTick)
    if status:
        query = query.where(DownloadSchedulerTick.status == status)
    rows = (
        await db.execute(
            query.order_by(DownloadSchedulerTick.created_at.desc(), DownloadSchedulerTick.id.desc()).limit(effective_limit)
        )
    ).scalars()
    return [_to_scheduler_tick_read(row) for row in rows]


def _binary_health(*, name: str, command: str) -> BinaryHealth:
    resolved = which(command)
    return BinaryHealth(
        name=name,
        command=command,
        available=resolved is not None,
        resolved_path=resolved,
    )


def _runtime_env_path() -> Path:
    return Path(settings.runtime_env_file).expanduser().resolve()


def _restart_command() -> str:
    return "cd backend && uvicorn app.main:app --reload"


def _current_env_values() -> dict[str, str]:
    return {
        "CVN_DOWNLOAD_WORKER_ENABLED": _stringify_env_value(settings.download_worker_enabled),
        "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED": _stringify_env_value(settings.download_worker_scheduler_enabled),
        "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS": _stringify_env_value(
            settings.download_worker_scheduler_interval_seconds
        ),
        "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT": _stringify_env_value(settings.download_worker_scheduler_limit),
        "CVN_YTDLP_BINARY": settings.ytdlp_binary,
        "CVN_FFPROBE_BINARY": settings.ffprobe_binary,
    }


def _pending_overrides() -> list[RuntimeEnvOverride]:
    managed = _read_managed_env()
    active = _current_env_values()
    rows = []
    for key in RUNTIME_FIELD_TO_ENV_KEY.values():
        if key not in managed:
            continue
        rows.append(
            RuntimeEnvOverride(
                key=key,
                value=managed[key],
                active_value=active.get(key),
                pending_restart=managed[key] != active.get(key),
            )
        )
    return rows


def _read_managed_env() -> dict[str, str]:
    path = _runtime_env_path()
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = ENV_LINE_RE.match(line)
        if not match:
            continue
        key = match.group(1)
        if key not in RUNTIME_FIELD_TO_ENV_KEY.values():
            continue
        _prefix, raw_value = line.split("=", 1)
        values[key] = _parse_env_value(raw_value.strip())
    return values


def _write_managed_env(env_updates: dict[str, str]) -> list[str]:
    path = _runtime_env_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else _initial_env_lines()
    changed: list[str] = []
    seen: set[str] = set()
    next_lines: list[str] = []

    for line in lines:
        match = ENV_LINE_RE.match(line)
        key = match.group(1) if match else None
        if key in env_updates:
            seen.add(key)
            next_line = f"{key}={_quote_env_value(env_updates[key])}"
            if line != next_line:
                changed.append(key)
            next_lines.append(next_line)
        else:
            next_lines.append(line)

    missing = [key for key in env_updates if key not in seen]
    if missing and next_lines and next_lines[-1].strip():
        next_lines.append("")
    for key in missing:
        changed.append(key)
        next_lines.append(f"{key}={_quote_env_value(env_updates[key])}")

    path.write_text("\n".join(next_lines).rstrip() + "\n", encoding="utf-8")
    return sorted(set(changed), key=list(env_updates).index)


def _initial_env_lines() -> list[str]:
    return [
        "# Managed by Channel Vault NAS runtime settings.",
        "# Restart the backend process after changing these values.",
        "",
    ]


def _stringify_env_value(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _quote_env_value(value: str) -> str:
    if not value or any(char.isspace() for char in value) or any(char in value for char in ['"', "'", "#", "$"]):
        return json.dumps(value)
    return value


def _parse_env_value(raw_value: str) -> str:
    if raw_value.startswith(("'", '"')):
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, str):
                return parsed
        except json.JSONDecodeError:
            return raw_value.strip("'\"")
    return raw_value


def _to_scheduler_tick_read(row: DownloadSchedulerTick) -> SchedulerTickRead:
    duration_seconds = None
    if row.completed_at is not None:
        duration_seconds = max(0, round((row.completed_at - row.started_at).total_seconds()))
    return SchedulerTickRead(
        id=row.id,
        trigger=row.trigger,
        status=row.status,
        scheduler_enabled=row.scheduler_enabled,
        worker_enabled=row.worker_enabled,
        interval_seconds=row.interval_seconds,
        limit=row.limit,
        started_count=row.started_count,
        completed_count=row.completed_count,
        failed_count=row.failed_count,
        skipped_reason=row.skipped_reason,
        error_message=row.error_message,
        duration_seconds=duration_seconds,
        next_tick_at=row.next_tick_at,
        started_at=row.started_at,
        completed_at=row.completed_at,
        created_at=row.created_at,
    )
