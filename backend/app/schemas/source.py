"""Source registration schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class SourceNormalizeRequest(BaseModel):
    """Raw source text submitted from the registration form."""

    value: str = Field(min_length=1)


class NormalizedSource(BaseModel):
    """Canonical source identity before the yt-dlp probe fills metadata."""

    original: str
    source_type: str
    identifier_type: str
    identifier: str
    canonical_url: str
    probe_url: str
    tracking_query_removed: bool


class ChannelProbeRequest(BaseModel):
    """User input for a read-only channel probe."""

    value: str = Field(min_length=1)
    max_quality: str = "1080p"
    audio_only: bool = False
    subtitles_enabled: bool = True


class ChannelRegistrationRequest(ChannelProbeRequest):
    """User input for committing a probed channel into the archive."""

    auto_download: bool = False
    backfill_mode: str = "all"


class SourceVideoPreview(BaseModel):
    """Flat video metadata returned by yt-dlp during registration."""

    external_id: str
    title: str
    url: str
    duration_seconds: int | None = None
    thumbnail_url: str | None = None
    published_at: datetime | None = None
    upload_date: str | None = None


class StorageForecast(BaseModel):
    """Rough storage forecast used before download policy commit."""

    video_count: int
    max_quality: str
    audio_only: bool
    estimated_bytes: int
    estimated_label: str
    confidence: str


class FolderPreview(BaseModel):
    """Predicted NAS folder contract for the channel."""

    root: str
    channel_dir: str
    example_video_dir: str | None
    sidecars: list[str]


class ChannelProbeResult(BaseModel):
    """Read-only channel identity and archive forecast before registration."""

    normalized: NormalizedSource
    title: str
    external_id: str | None
    handle: str | None
    source_url: str
    channel_url: str | None
    description: str | None
    thumbnail_url: str | None
    banner_url: str | None
    follower_count: int | None
    video_count: int
    videos: list[SourceVideoPreview]
    first_video_published_at: datetime | None
    latest_video_published_at: datetime | None
    storage_forecast: StorageForecast
    folder_preview: FolderPreview
    already_registered: bool = False
    existing_channel_id: int | None = None


class RegisteredChannel(BaseModel):
    """Persisted channel summary returned after registration."""

    id: int
    title: str
    external_id: str | None
    handle: str | None
    source_url: str
    video_count: int
    archived_count: int
    missing_count: int
    status: str
    created_at: datetime


class ChannelRegistrationResult(BaseModel):
    """Commit response for a channel registration."""

    channel: RegisteredChannel
    probe: ChannelProbeResult
    created: bool
