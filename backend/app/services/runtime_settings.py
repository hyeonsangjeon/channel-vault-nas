"""Runtime settings snapshots and managed env overrides for operator UI."""

from __future__ import annotations

import asyncio
import json
import os
import re
import shlex
from datetime import UTC, datetime, timedelta
from pathlib import Path
from shutil import which

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import BACKEND_ROOT, settings
from app.models.archive import Channel, DownloadSchedulerTick
from app.schemas.settings import (
    BinaryHealth,
    RuntimeEnvOverride,
    RuntimeRestartAdapter,
    RuntimeRestartRequest,
    RuntimeRestartResult,
    RuntimeSettingsApplyResult,
    RuntimeSettingsRead,
    RuntimeSettingsUpdate,
    SchedulerTickRead,
)
from app.services.download_scheduler import get_download_worker_scheduler_status
from app.services.metadata_scheduler import (
    get_metadata_sync_scheduler_status,
    list_metadata_sync_ticks,
)

ENV_LINE_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=")
RUNTIME_FIELD_TO_ENV_KEY = {
    "download_worker_enabled": "CVN_DOWNLOAD_WORKER_ENABLED",
    "download_worker_scheduler_enabled": "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED",
    "download_worker_scheduler_interval_seconds": "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS",
    "download_worker_scheduler_limit": "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT",
    "metadata_sync_scheduler_enabled": "CVN_METADATA_SYNC_SCHEDULER_ENABLED",
    "metadata_sync_scheduler_interval_seconds": "CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS",
    "metadata_sync_scheduler_limit": "CVN_METADATA_SYNC_SCHEDULER_LIMIT",
    "ytdlp_binary": "CVN_YTDLP_BINARY",
    "ffprobe_binary": "CVN_FFPROBE_BINARY",
}


async def get_runtime_settings(*, db: AsyncSession) -> RuntimeSettingsRead:
    """Return non-secret runtime flags, pending env overrides, and scheduler ticks."""
    scheduler_ticks = await list_scheduler_ticks(db=db, limit=8)
    metadata_sync_ticks = await list_metadata_sync_ticks(db=db, limit=6)
    scheduler_status = get_download_worker_scheduler_status()
    metadata_scheduler_status = get_metadata_sync_scheduler_status()
    latest_tick = scheduler_ticks[0] if scheduler_ticks else None
    latest_metadata_tick = metadata_sync_ticks[0] if metadata_sync_ticks else None
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
    if metadata_scheduler_status.last_completed_at is None and latest_metadata_tick is not None:
        metadata_scheduler_status = metadata_scheduler_status.model_copy(
            update={
                "last_started_at": latest_metadata_tick.started_at,
                "last_completed_at": latest_metadata_tick.completed_at,
                "last_error": latest_metadata_tick.error_message,
                "last_result_status": latest_metadata_tick.status,
                "next_tick_at": metadata_scheduler_status.next_tick_at or latest_metadata_tick.next_tick_at,
            }
        )
    due_channel_count, next_due_at = await _metadata_scheduler_due_summary(db)
    metadata_scheduler_status = metadata_scheduler_status.model_copy(
        update={
            "due_channel_count": due_channel_count,
            "next_due_at": next_due_at,
        }
    )

    pending_overrides = _pending_overrides()
    return RuntimeSettingsRead(
        download_worker_enabled=settings.download_worker_enabled,
        download_worker_scheduler_enabled=settings.download_worker_scheduler_enabled,
        download_worker_scheduler_interval_seconds=settings.download_worker_scheduler_interval_seconds,
        download_worker_scheduler_limit=settings.download_worker_scheduler_limit,
        metadata_sync_scheduler_enabled=settings.metadata_sync_scheduler_enabled,
        metadata_sync_scheduler_interval_seconds=settings.metadata_sync_scheduler_interval_seconds,
        metadata_sync_scheduler_limit=settings.metadata_sync_scheduler_limit,
        download_dir=settings.download_dir,
        metadata_dir=settings.metadata_dir,
        managed_env_file=str(_runtime_env_path()),
        pending_restart=any(item.pending_restart for item in pending_overrides),
        pending_overrides=pending_overrides,
        restart_command=_restart_command(),
        restart_adapter=get_runtime_restart_adapter(),
        scheduler_status=scheduler_status,
        metadata_scheduler_status=metadata_scheduler_status,
        scheduler_ticks=scheduler_ticks,
        metadata_sync_ticks=metadata_sync_ticks,
        binaries=[
            _binary_health(name="yt-dlp", command=settings.ytdlp_binary),
            _binary_health(name="ffprobe", command=settings.ffprobe_binary),
        ],
    )


def get_runtime_restart_adapter() -> RuntimeRestartAdapter:
    """Return the best restart adapter for the current deployment."""
    configured_adapter = settings.restart_adapter.strip().lower() or "auto"
    hook_command = settings.restart_hook_command.strip()
    service_name = settings.restart_service_name.strip() or None

    if configured_adapter == "disabled":
        return RuntimeRestartAdapter(
            adapter="disabled",
            environment="manual",
            label="Restart disabled",
            command=_restart_command(),
            executable=False,
            manual_required=True,
            reason="runtime restart adapter is disabled",
        )

    if hook_command:
        return RuntimeRestartAdapter(
            adapter="supervised-hook",
            environment=_runtime_environment(),
            label="Supervised restart hook",
            command=hook_command,
            executable=True,
            manual_required=False,
            reason="CVN_RESTART_HOOK_COMMAND is configured",
            service_name=service_name,
        )

    if configured_adapter == "supervisor" or (configured_adapter == "auto" and os.environ.get("SUPERVISOR_ENABLED")):
        command = _supervisor_restart_command(service_name=service_name)
        return RuntimeRestartAdapter(
            adapter="supervisor",
            environment="supervised",
            label="Supervisor restart",
            command=command,
            executable=settings.restart_adapter_execute and service_name is not None,
            manual_required=not settings.restart_adapter_execute or service_name is None,
            reason=(
                "set CVN_RESTART_SERVICE_NAME and CVN_RESTART_ADAPTER_EXECUTE=true to run supervisorctl"
                if service_name is None or not settings.restart_adapter_execute
                else "supervisorctl restart is executable by configuration"
            ),
            service_name=service_name,
        )

    compose_file = _detect_compose_file()
    if configured_adapter == "docker_compose" or (configured_adapter == "auto" and compose_file is not None):
        command = _docker_compose_restart_command(compose_file=compose_file, service_name=service_name)
        return RuntimeRestartAdapter(
            adapter="docker-compose",
            environment="container" if _running_in_container() else "docker-compose",
            label="Docker Compose restart",
            command=command,
            executable=settings.restart_adapter_execute,
            manual_required=not settings.restart_adapter_execute,
            reason=(
                "docker compose file detected; enable CVN_RESTART_ADAPTER_EXECUTE=true to run it from the UI"
                if not settings.restart_adapter_execute
                else "docker compose restart command is executable by configuration"
            ),
            service_name=service_name,
            compose_file=str(compose_file) if compose_file is not None else None,
        )

    if configured_adapter == "systemd":
        command = _systemd_restart_command(service_name=service_name)
        return RuntimeRestartAdapter(
            adapter="systemd",
            environment="nas-service",
            label="System service restart",
            command=command,
            executable=settings.restart_adapter_execute and service_name is not None,
            manual_required=not settings.restart_adapter_execute or service_name is None,
            reason=(
                "set CVN_RESTART_SERVICE_NAME and CVN_RESTART_ADAPTER_EXECUTE=true to run systemctl"
                if service_name is None or not settings.restart_adapter_execute
                else "system service restart is executable by configuration"
            ),
            service_name=service_name,
        )

    if configured_adapter == "local" or configured_adapter == "local_dev":
        return RuntimeRestartAdapter(
            adapter="local-dev",
            environment="local-dev",
            label="Local dev restart",
            command=_restart_command(),
            executable=settings.restart_adapter_execute,
            manual_required=not settings.restart_adapter_execute,
            reason=(
                "local dev restart stays manual unless CVN_RESTART_ADAPTER_EXECUTE=true"
                if not settings.restart_adapter_execute
                else "local restart command is executable by configuration"
            ),
        )

    return RuntimeRestartAdapter(
        adapter="manual",
        environment=_runtime_environment(),
        label="Manual restart",
        command=_restart_command(),
        executable=False,
        manual_required=True,
        reason="no restart hook or deployment adapter was detected",
    )


async def request_runtime_restart(payload: RuntimeRestartRequest) -> RuntimeRestartResult:
    """Run a configured restart adapter, or return manual guidance."""
    adapter = get_runtime_restart_adapter()
    reason = payload.reason or "runtime settings changed"
    if not adapter.executable:
        return RuntimeRestartResult(
            requested=False,
            adapter=adapter,
            message=f"Manual restart required: {adapter.reason}",
        )

    env = os.environ.copy()
    env["CVN_RESTART_REASON"] = reason
    process = await asyncio.create_subprocess_shell(
        adapter.command,
        cwd=str(BACKEND_ROOT.parent),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=max(1, settings.restart_command_timeout_seconds),
        )
    except TimeoutError:
        return RuntimeRestartResult(
            requested=True,
            adapter=adapter,
            message="Restart command was dispatched and is still running.",
        )

    return RuntimeRestartResult(
        requested=process.returncode == 0,
        adapter=adapter,
        message="Restart command completed." if process.returncode == 0 else "Restart command failed.",
        exit_code=process.returncode,
        stdout=_trim_command_output(stdout.decode(errors="replace")),
        stderr=_trim_command_output(stderr.decode(errors="replace")),
    )


async def _metadata_scheduler_due_summary(db: AsyncSession) -> tuple[int, datetime | None]:
    """Return due-channel count and the next channel-level due time."""
    now = datetime.now(UTC)
    rows = (await db.execute(select(Channel).where(Channel.status == "active"))).scalars().all()
    due_count = 0
    next_due_at: datetime | None = None
    for channel in rows:
        due_at = _channel_next_sync_due_at(channel, now)
        if due_at <= now:
            due_count += 1
        if next_due_at is None or due_at < next_due_at:
            next_due_at = due_at
    return due_count, next_due_at


def _channel_next_sync_due_at(channel: Channel, now: datetime) -> datetime:
    if channel.last_synced_at is None:
        return now
    base = channel.last_synced_at
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    return base + timedelta(minutes=max(1, channel.sync_interval_minutes))


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


async def list_scheduler_ticks(
    *,
    db: AsyncSession,
    limit: int = 12,
    status: str | None = None,
    min_duration_seconds: int | None = None,
    interval_seconds: int | None = None,
    worker_limit: int | None = None,
) -> list[SchedulerTickRead]:
    """Return newest persistent scheduler tick telemetry rows."""
    effective_limit = max(1, min(limit, 100))
    fetch_limit = min(500, effective_limit * 5) if min_duration_seconds is not None else effective_limit
    query = select(DownloadSchedulerTick)
    if status:
        query = query.where(DownloadSchedulerTick.status == status)
    if interval_seconds is not None:
        query = query.where(DownloadSchedulerTick.interval_seconds == interval_seconds)
    if worker_limit is not None:
        query = query.where(DownloadSchedulerTick.limit == worker_limit)
    rows = (
        await db.execute(
            query.order_by(DownloadSchedulerTick.created_at.desc(), DownloadSchedulerTick.id.desc()).limit(fetch_limit)
        )
    ).scalars()
    ticks = [_to_scheduler_tick_read(row) for row in rows]
    if min_duration_seconds is not None:
        ticks = [
            tick
            for tick in ticks
            if tick.duration_seconds is not None and tick.duration_seconds >= min_duration_seconds
        ]
    return ticks[:effective_limit]


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


def _detect_compose_file() -> Path | None:
    root = BACKEND_ROOT.parent
    for name in ("compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"):
        candidate = root / name
        if candidate.exists():
            return candidate
    return None


def _docker_compose_restart_command(*, compose_file: Path | None, service_name: str | None) -> str:
    parts = ["docker", "compose"]
    if compose_file is not None:
        parts.extend(["-f", str(compose_file)])
    parts.append("restart")
    if service_name:
        parts.append(service_name)
    return " ".join(shlex.quote(part) for part in parts)


def _systemd_restart_command(*, service_name: str | None) -> str:
    service = service_name or "channel-vault-nas"
    return " ".join(shlex.quote(part) for part in ("systemctl", "restart", service))


def _supervisor_restart_command(*, service_name: str | None) -> str:
    service = service_name or "channel-vault-nas"
    return " ".join(shlex.quote(part) for part in ("supervisorctl", "restart", service))


def _running_in_container() -> bool:
    return Path("/.dockerenv").exists() or os.environ.get("container") is not None


def _runtime_environment() -> str:
    if _running_in_container():
        return "container"
    if os.environ.get("INVOCATION_ID") or os.environ.get("SYSTEMD_EXEC_PID"):
        return "systemd"
    if os.environ.get("SUPERVISOR_ENABLED"):
        return "supervised"
    return "local-dev"


def _trim_command_output(value: str) -> str | None:
    cleaned = value.strip()
    if not cleaned:
        return None
    if len(cleaned) <= 1200:
        return cleaned
    return cleaned[:1200] + "\n..."


def _current_env_values() -> dict[str, str]:
    return {
        "CVN_DOWNLOAD_WORKER_ENABLED": _stringify_env_value(settings.download_worker_enabled),
        "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED": _stringify_env_value(settings.download_worker_scheduler_enabled),
        "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS": _stringify_env_value(
            settings.download_worker_scheduler_interval_seconds
        ),
        "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT": _stringify_env_value(settings.download_worker_scheduler_limit),
        "CVN_METADATA_SYNC_SCHEDULER_ENABLED": _stringify_env_value(settings.metadata_sync_scheduler_enabled),
        "CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS": _stringify_env_value(
            settings.metadata_sync_scheduler_interval_seconds
        ),
        "CVN_METADATA_SYNC_SCHEDULER_LIMIT": _stringify_env_value(settings.metadata_sync_scheduler_limit),
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
