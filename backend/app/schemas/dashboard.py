"""Dashboard snapshot schemas."""

from pydantic import BaseModel


class ArchiveMetric(BaseModel):
    """Top-level archive metric."""

    label: str
    value: str
    detail: str
    tone: str


class ChannelNode(BaseModel):
    """A channel node for the constellation visualization."""

    id: str
    title: str
    health: int
    storage_gb: float
    new_videos: int
    failed_jobs: int
    group: str


class ChannelLink(BaseModel):
    """Relationship between channel nodes."""

    source: str
    target: str
    weight: int


class QueueLane(BaseModel):
    """Operational queue lane."""

    label: str
    count: int
    status: str


class ActivityItem(BaseModel):
    """Recent archive activity."""

    title: str
    channel: str
    status: str
    time: str


class CoverageSummary(BaseModel):
    """Archive completeness summary for dashboard headline."""

    source: int
    archived: int
    missing: int
    removed_saved: int
    percent: float


class FidelitySummary(BaseModel):
    """Sidecar and metadata preservation summary."""

    info_json: int
    thumbnails: int
    subtitles: int
    nfo: int


class DashboardSnapshot(BaseModel):
    """Archive observatory mock payload."""

    coverage: CoverageSummary
    fidelity: FidelitySummary
    metrics: list[ArchiveMetric]
    channels: list[ChannelNode]
    links: list[ChannelLink]
    queue: list[QueueLane]
    activity: list[ActivityItem]
