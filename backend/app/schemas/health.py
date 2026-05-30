"""Health response schemas."""

from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health endpoint payload."""

    status: str
    app: str
    version: str
    checked_at: datetime
