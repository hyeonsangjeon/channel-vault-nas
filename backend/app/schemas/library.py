"""Library recovery, views, and rescan schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class RescanCandidate(BaseModel):
    """One video folder that can repopulate the metadata database."""

    relative_dir: str
    video_id: str | None
    title: str | None
    channel_id: str | None
    channel: str | None
    upload_date: str | None
    info_json: str
    media_files: list[str]
    thumbnails: list[str]
    subtitles: list[str]
    nfo: str | None


class RescanPlan(BaseModel):
    """Read-only plan describing what a DB rebuild can recover."""

    root: str
    candidates: list[RescanCandidate]
    candidate_count: int
    warnings: list[str]


class RescanApplyResult(BaseModel):
    """Result after applying a sidecar rescan plan to the DB index."""

    root: str
    candidates_seen: int
    channels_created: int
    videos_created: int
    media_files_indexed: int
    thumbnails_indexed: int
    subtitles_indexed: int
    warnings: list[str]


class LibraryFidelity(BaseModel):
    """Sidecar preservation signals for one library item."""

    info_json: bool
    media: bool
    thumbnail: bool
    subtitles: bool
    nfo: bool


class LibraryItem(BaseModel):
    """One indexed video in the archive library."""

    id: int
    channel_id: int
    channel_title: str
    video_external_id: str
    title: str
    url: str
    published_at: str | None
    duration_seconds: int | None
    thumbnail_url: str | None
    source_state: str
    archive_state: str
    integrity_state: str
    info_json_path: str | None
    media_files: list[str]
    media_count: int
    media_container: str | None
    video_codec: str | None
    audio_codec: str | None
    fps: float | None
    width: int | None
    height: int | None
    total_bytes: int
    total_label: str
    queue_status: str | None
    queue_priority: int | None
    fidelity: LibraryFidelity


class LibrarySnapshot(BaseModel):
    """Searchable DB-backed library index."""

    items: list[LibraryItem]
    total: int
    archived: int
    missing: int
    queued: int
    total_bytes: int
    total_label: str


class LibraryViewWrite(BaseModel):
    """Payload for a reusable saved library filter view."""

    name: str = Field(min_length=1, max_length=160)
    query: str = Field(default="", max_length=500)
    integrity: str = Field(default="all", max_length=40)
    sidecar: str = Field(default="all", max_length=40)
    codec: str = Field(default="", max_length=200)


class LibraryViewRead(BaseModel):
    """Persisted saved library filter view."""

    id: int
    name: str
    query: str
    integrity: str
    sidecar: str
    codec: str
    created_at: datetime
    updated_at: datetime


class LibrarySidecar(BaseModel):
    """One sidecar file expected or discovered near a media file."""

    kind: str
    relative_path: str
    exists: bool


class LibraryFile(BaseModel):
    """One media file attached to a library video."""

    video_id: int
    relative_path: str
    filename: str
    size_bytes: int | None
    container: str | None
    video_codec: str | None
    audio_codec: str | None
    fps: float | None
    width: int | None
    height: int | None
    duration_seconds: int | None
    exists: bool
    size_label: str
    integrity_state: str
    info_json_path: str | None
    thumbnail_path: str | None
    nfo_path: str | None
    info_json_exists: bool
    thumbnail_exists: bool
    nfo_exists: bool
    sidecars: list[LibrarySidecar]
    stream_url: str
