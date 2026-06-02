"""Operator readiness schemas for the NAS console."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

OperationSeverity = Literal["critical", "warning", "info", "good"]
OperationStatus = Literal["blocked", "action", "watch", "done"]
OperationActionKind = Literal["register", "storage", "snapshot", "runtime", "downloads", "library", "refresh", "none"]


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
    resolved: bool = False


class OperationsReadiness(BaseModel):
    """Cross-system readiness summary for the app shell."""

    generated_at: datetime
    score: int
    stage: Literal["setup", "attention", "ready", "excellent"]
    metrics: list[OperationMetric]
    missions: list[OperationMission]
    warnings: list[str]
