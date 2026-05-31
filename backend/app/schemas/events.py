"""Realtime event schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ArchiveEvent(BaseModel):
    """Realtime archive event sent over WebSocket and retained briefly in memory."""

    type: str
    data: dict[str, Any]
    occurred_at: datetime
