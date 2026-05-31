"""Runtime settings and dependency health schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


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


class SchedulerTickRead(BaseModel):
    """Persisted scheduler tick log row."""

    id: int
    trigger: str
    status: str
    scheduler_enabled: bool
    worker_enabled: bool
    interval_seconds: int
    limit: int
    started_count: int
    completed_count: int
    failed_count: int
    skipped_reason: str | None
    error_message: str | None
    duration_seconds: int | None
    next_tick_at: datetime | None
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime


class RuntimeEnvOverride(BaseModel):
    """Managed runtime env override persisted for the next restart."""

    key: str
    value: str
    active_value: str | None
    pending_restart: bool


class RuntimeRestartAdapter(BaseModel):
    """Deployment-aware restart action surfaced to the operator UI."""

    adapter: str
    environment: str
    label: str
    command: str
    executable: bool
    manual_required: bool
    reason: str
    service_name: str | None = None
    compose_file: str | None = None


class RuntimeSettingsRead(BaseModel):
    """Operator-facing runtime settings snapshot."""

    download_worker_enabled: bool
    download_worker_scheduler_enabled: bool
    download_worker_scheduler_interval_seconds: int
    download_worker_scheduler_limit: int
    download_dir: str
    metadata_dir: str
    managed_env_file: str
    pending_restart: bool
    pending_overrides: list[RuntimeEnvOverride]
    restart_command: str
    restart_adapter: RuntimeRestartAdapter
    scheduler_status: SchedulerRuntimeStatus
    scheduler_ticks: list[SchedulerTickRead]
    binaries: list[BinaryHealth]


class RuntimeSettingsUpdate(BaseModel):
    """Editable non-secret runtime settings written to the managed env file."""

    download_worker_enabled: bool | None = None
    download_worker_scheduler_enabled: bool | None = None
    download_worker_scheduler_interval_seconds: int | None = Field(default=None, ge=5, le=86_400)
    download_worker_scheduler_limit: int | None = Field(default=None, ge=1, le=20)
    ytdlp_binary: str | None = Field(default=None, min_length=1, max_length=500)
    ffprobe_binary: str | None = Field(default=None, min_length=1, max_length=500)

    @field_validator("ytdlp_binary", "ffprobe_binary")
    @classmethod
    def clean_binary_command(cls, value: str | None) -> str | None:
        """Reject values that cannot safely be represented in a dotenv line."""
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned or "\n" in cleaned or "\r" in cleaned:
            raise ValueError("binary command must be a single non-empty line")
        return cleaned


class RuntimeSettingsApplyResult(BaseModel):
    """Result of writing runtime env overrides."""

    applied: bool
    restart_required: bool
    changed_keys: list[str]
    managed_env_file: str
    restart_command: str
    runtime: RuntimeSettingsRead


class RuntimeRestartRequest(BaseModel):
    """Operator restart request metadata."""

    reason: str | None = Field(default=None, max_length=300)


class RuntimeRestartResult(BaseModel):
    """Result from attempting a deployment-aware restart request."""

    requested: bool
    adapter: RuntimeRestartAdapter
    message: str
    exit_code: int | None = None
    stdout: str | None = None
    stderr: str | None = None
