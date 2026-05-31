"""Runtime settings and dependency health schemas."""

from datetime import datetime

from pydantic import BaseModel


class BinaryHealth(BaseModel):
    """Resolved local binary state."""

    name: str
    command: str
    available: bool
    resolved_path: str | None


class SchedulerRuntimeStatus(BaseModel):
    """In-process scheduler status for operator review."""

    state: str
    enabled: bool
    worker_enabled: bool
    running: bool
    interval_seconds: int
    limit: int
    last_started_at: datetime | None
    last_completed_at: datetime | None
    last_error: str | None
    last_result_status: str | None
    next_tick_at: datetime | None


class RuntimeSettingsRead(BaseModel):
    """Operator-facing runtime settings snapshot."""

    download_worker_enabled: bool
    download_worker_scheduler_enabled: bool
    download_worker_scheduler_interval_seconds: int
    download_worker_scheduler_limit: int
    download_dir: str
    metadata_dir: str
    scheduler_status: SchedulerRuntimeStatus
    binaries: list[BinaryHealth]
