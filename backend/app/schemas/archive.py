"""Archive priority API schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


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


class ArchiveTxtPreviewRequest(BaseModel):
    """Raw youtube-dl/yt-dlp archive.txt content to compare with the DB index."""

    content: str
    channel_id: int | None = None


class ArchiveTxtStageRequest(BaseModel):
    """Create metadata placeholders and queue candidates from archive.txt rows."""

    content: str
    channel_id: int = Field(ge=1)
    quality: str = "1080p"
    limit: int = Field(default=50, ge=1, le=500)
    create_candidates: bool = True


class ArchiveTxtPreviewItem(BaseModel):
    """One parsed archive.txt row and its local archive state."""

    line_number: int
    raw: str
    video_external_id: str | None
    state: str
    title: str | None = None
    channel_title: str | None = None
    reason: str


class ArchiveTxtPreviewResult(BaseModel):
    """Summary of archive.txt IDs compared with the current vault index."""

    total_lines: int
    parsed_count: int
    archived_count: int
    known_missing_count: int
    unknown_count: int
    duplicate_count: int
    invalid_count: int
    items: list[ArchiveTxtPreviewItem]


class ArchiveTxtStageResult(BaseModel):
    """Result of applying archive.txt preview rows to a selected channel."""

    channel_id: int
    videos_created: int
    candidates_created: int
    skipped_count: int
    video_ids: list[int]
    job_ids: list[int]
    preview: ArchiveTxtPreviewResult
    warnings: list[str] = Field(default_factory=list)
