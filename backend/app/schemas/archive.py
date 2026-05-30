"""Archive priority API schemas."""

from datetime import datetime

from pydantic import BaseModel


class ChannelCoverage(BaseModel):
    """Completeness snapshot for one channel."""

    channel_id: str
    source: int
    archived: int
    missing: int
    removed_saved: int
    percent: float
    updated_at: datetime


class MissingVideo(BaseModel):
    """Video that still exists in the source but is not mirrored locally."""

    id: str
    title: str
    published_at: datetime
    source_state: str
    reason: str


class RemovedVideo(BaseModel):
    """Video no longer available at source but safely preserved locally."""

    id: str
    title: str
    published_at: datetime
    removed_detected_at: datetime
    local_relative_path: str


class CadenceBucket(BaseModel):
    """Upload histogram bucket."""

    dow: int
    label: str
    count: int
    typical_hour: int


class ChannelCadence(BaseModel):
    """Upload rhythm summary for one channel."""

    channel_id: str
    first_video_published_at: datetime
    latest_video_published_at: datetime
    avg_upload_interval_days: float
    typical_upload_dow: int
    typical_upload_hour: int
    next_expected_at: datetime
    buckets: list[CadenceBucket]


class ArchiveFileLayout(BaseModel):
    """Filesystem contract shown to clients and settings screens."""

    option: str
    root: str
    template: str
    sidecars: list[str]
    invariants: list[str]


class ImportSource(BaseModel):
    """Supported archive import source."""

    id: str
    title: str
    description: str
    trust_level: str
    status: str
