"""Sync and download queue API schemas."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.source import RegisteredChannel


class ChannelSyncRequest(BaseModel):
    """Manual metadata sync options."""

    max_quality: str = "1080p"
    audio_only: bool = False
    subtitles_enabled: bool = True


class SyncJobRead(BaseModel):
    """Metadata sync job state."""

    id: int
    channel_id: int
    channel_title: str
    trigger: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    videos_seen: int
    videos_created: int
    candidates_created: int
    error_message: str | None
    created_at: datetime


class ChannelSyncResult(BaseModel):
    """Manual channel sync response."""

    job: SyncJobRead
    channel: RegisteredChannel
    videos_seen: int
    videos_created: int
    candidates_created: int = 0


class ChannelDetail(BaseModel):
    """Registered channel detail for the post-registration screen."""

    id: int
    title: str
    external_id: str | None
    handle: str | None
    source_url: str
    description: str | None
    thumbnail_url: str | None
    status: str
    video_count: int
    archived_count: int
    missing_count: int
    removed_saved_count: int
    last_synced_at: datetime | None
    sync_interval_minutes: int
    next_sync_due_at: datetime | None
    last_auto_synced_at: datetime | None
    last_auto_sync_status: str | None
    last_auto_candidates_created: int
    first_video_published_at: datetime | None
    latest_video_published_at: datetime | None
    avg_upload_interval_days: float | None
    typical_upload_dow: int | None
    typical_upload_hour: int | None
    created_at: datetime
    updated_at: datetime


class ChannelPolicyRead(BaseModel):
    """Persisted per-channel archive policy."""

    channel_id: int
    auto_download: bool
    max_quality: str
    audio_only: bool
    subtitles_enabled: bool
    subtitle_languages: list[str]
    retention_policy: str
    worker_paused: bool
    worker_pause_reason: str | None
    created_at: datetime
    updated_at: datetime


class ChannelPolicyUpdate(BaseModel):
    """Editable channel archive policy fields."""

    auto_download: bool | None = None
    max_quality: str | None = None
    audio_only: bool | None = None
    subtitles_enabled: bool | None = None
    subtitle_languages: list[str] | None = None
    retention_policy: str | None = None
    worker_paused: bool | None = None
    worker_pause_reason: str | None = None


class ChannelVideoRead(BaseModel):
    """Video metadata row shown on a channel timeline."""

    id: int
    channel_id: int
    external_id: str
    title: str
    url: str
    published_at: datetime | None
    upload_date: date | None
    duration_seconds: int | None
    thumbnail_url: str | None
    source_state: str
    archive_state: str
    info_json_path: str | None
    discovered_at: datetime


class DownloadCandidateRequest(BaseModel):
    """Create candidate queue rows without starting media downloads."""

    quality: str = "1080p"
    limit: int = Field(default=50, ge=1, le=500)


class DownloadJobRead(BaseModel):
    """Download queue row."""

    id: int
    video_id: int
    video_external_id: str
    video_title: str
    channel_id: int
    channel_title: str
    status: str
    progress: float
    quality: str
    priority: int
    preflight_status: str
    estimated_bytes: int | None
    preflight_checked_at: datetime | None
    error_message: str | None
    attempt_count: int
    archive_path: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DownloadJobBulkRequest(BaseModel):
    """Bulk operation for download jobs."""

    job_ids: list[int] = Field(min_length=1)
    action: Literal["queue", "cancel", "prioritize", "retry"]
    priority: int | None = Field(default=None, ge=0, le=100)
    quality: str | None = None


class DownloadCandidateResult(BaseModel):
    """Candidate queue creation response."""

    channel: RegisteredChannel
    candidates_created: int
    total_candidates: int
    jobs: list[DownloadJobRead]


class VideoDownloadRequest(BaseModel):
    """Explicit one-video download queue request."""

    quality: str = "1080p"


class VideoDownloadResult(BaseModel):
    """Explicit one-video download queue response."""

    job: DownloadJobRead


class DownloadJobActionResult(BaseModel):
    """Download job state transition response."""

    job: DownloadJobRead


class DownloadJobBulkResult(BaseModel):
    """Bulk download job operation response."""

    updated: int
    jobs: list[DownloadJobRead]


class QueuePreflightPlan(BaseModel):
    """Download launch preflight summary without starting media transfer."""

    channel_id: int | None
    job_count: int
    candidate_count: int
    queued_count: int
    estimated_bytes: int
    estimated_label: str
    ready_job_ids: list[int]
    warnings: list[str]
    command_preview: list[str]
    jobs: list[DownloadJobRead]


class DownloadWorkerPlanJob(BaseModel):
    """One queued job as a media worker would see it."""

    job: DownloadJobRead
    archive_dir: str
    output_template: str
    command_preview: str
    status_note: str | None


class DownloadWorkerPlan(BaseModel):
    """Safe media worker launch plan without starting downloads."""

    enabled: bool
    dry_run: bool
    channel_id: int | None
    limit: int
    queued_count: int
    claimable_count: int
    running_count: int
    locked_reason: str | None
    running_jobs: list[DownloadWorkerPlanJob]
    jobs: list[DownloadWorkerPlanJob]


class DownloadWorkerRunRequest(BaseModel):
    """Request one bounded worker pass."""

    channel_id: int | None = None
    limit: int = Field(default=1, ge=1, le=5)
    dry_run: bool = True


class DownloadWorkerRunResult(BaseModel):
    """Result of one safe worker pass."""

    enabled: bool
    dry_run: bool
    started: int
    completed: int
    failed: int
    skipped_reason: str | None
    plan: DownloadWorkerPlan
    jobs: list[DownloadJobRead]


class DownloadWorkerRunRead(BaseModel):
    """Persisted audit row for a worker pass."""

    id: int
    channel_id: int | None
    channel_title: str | None
    status: str
    dry_run: bool
    started_count: int
    completed_count: int
    failed_count: int
    skipped_reason: str | None
    duration_seconds: int | None
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
