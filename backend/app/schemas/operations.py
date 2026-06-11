"""Operator readiness schemas for the NAS console."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

OperationSeverity = Literal["critical", "warning", "info", "good"]
OperationStatus = Literal["blocked", "action", "watch", "done"]
OperationActionKind = Literal["register", "storage", "snapshot", "runtime", "downloads", "library", "security", "refresh", "none"]
MountDoctorPathKind = Literal["database", "metadata", "download", "runtime"]
MountDoctorStatus = Literal["healthy", "warning", "critical"]


class OperationMetric(BaseModel):
    """Compact metric for the operator readiness rail."""

    key: str
    value: str
    raw_value: float | int | None = None
    tone: OperationSeverity


class OperationMission(BaseModel):
    """One actionable next step for the operator."""

    id: str
    severity: OperationSeverity
    status: OperationStatus
    action_kind: OperationActionKind
    count: int = 0
    primary_value: str = ""
    secondary_value: str = ""
    target_kind: str = ""
    target_id: str = ""
    target_channel_id: int | None = None
    target_path: str = ""
    resolved: bool = False


class OperationsReadiness(BaseModel):
    """Cross-system readiness summary for the app shell."""

    generated_at: datetime
    score: int
    stage: Literal["setup", "attention", "ready", "excellent"]
    metrics: list[OperationMetric]
    missions: list[OperationMission]
    warnings: list[str]


class MountDoctorPath(BaseModel):
    """One configured NAS/runtime path inspected by the mount doctor."""

    id: MountDoctorPathKind
    label: str
    configured: str
    resolved: str
    exists: bool
    writable: bool
    is_directory: bool
    is_file: bool
    is_mount: bool
    parent_exists: bool
    parent_writable: bool
    free_bytes: int | None = None
    free_label: str = ""
    total_bytes: int | None = None
    total_label: str = ""
    pressure_percent: float | None = None
    error: str | None = None


class MountDoctorIssue(BaseModel):
    """One mount or persistence issue found by the doctor."""

    id: str
    severity: OperationSeverity
    title: str
    detail: str
    path_id: MountDoctorPathKind | None = None


class MountDoctorRead(BaseModel):
    """NAS volume and persistence guardrail status."""

    generated_at: datetime
    status: MountDoctorStatus
    score: int
    running_in_container: bool
    database_kind: str
    paths: list[MountDoctorPath]
    issues: list[MountDoctorIssue]
    summary: str


class DemoWorkspaceResult(BaseModel):
    """Result of loading the safe public-alpha demo workspace."""

    created: bool
    skipped_reason: str | None = None
    channel_id: int | None = None
    channel_title: str = ""
    videos_created: int = 0
    jobs_created: int = 0
    files_created: int = 0
    archive_root: str


class DemoWorkspaceClearResult(BaseModel):
    """Result of removing the safe public-alpha demo workspace."""

    cleared: bool
    skipped_reason: str | None = None
    channel_id: int | None = None
    channel_title: str = ""
    db_rows_removed: int = 0
    files_removed: int = 0
    archive_root: str


class SupportBundleRead(BaseModel):
    """Redacted diagnostic bundle suitable for public-alpha issue reports."""

    kind: Literal["channel_vault_support_bundle"]
    generated_at: datetime
    redaction: dict[str, Any]
    app: dict[str, Any]
    counts: dict[str, Any]
    queue: dict[str, Any]
    schedulers: dict[str, Any]
    storage: dict[str, Any]
    readiness: OperationsReadiness
    recent_events: list[dict[str, Any]]
