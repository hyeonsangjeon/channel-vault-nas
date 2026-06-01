"""Filesystem storage scan schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.library import RescanApplyResult


class StorageVolumeRead(BaseModel):
    """Archive root and host volume capacity."""

    root: str
    exists: bool
    total_bytes: int
    used_bytes: int
    free_bytes: int
    archive_bytes: int
    pressure_percent: float
    archive_label: str
    used_label: str
    free_label: str
    total_label: str
    file_count: int
    dir_count: int


class StorageChannelRead(BaseModel):
    """One channel folder discovered under the archive root."""

    relative_path: str
    title: str
    bytes: int
    label: str
    file_count: int
    media_count: int
    sidecar_count: int
    orphan_sidecar_count: int
    video_folder_count: int
    pressure_score: int


class StorageExtensionRead(BaseModel):
    """Bytes grouped by file extension."""

    extension: str
    bytes: int
    label: str
    count: int


class StorageOrphanSidecarRead(BaseModel):
    """Sidecar with no media sibling in the same video folder."""

    relative_path: str
    kind: str
    size_bytes: int
    label: str
    reason: str


class StorageFolderNodeRead(BaseModel):
    """Compact folder tree node with accumulated bytes."""

    relative_path: str
    name: str
    depth: int
    bytes: int
    label: str
    file_count: int


class StorageDriftItemRead(BaseModel):
    """A filesystem/database mismatch found during a storage scan."""

    relative_path: str
    kind: str
    label: str
    reason: str


class StorageDriftRead(BaseModel):
    """Media index drift between SQLite and the archive filesystem."""

    unindexed_media_count: int
    indexed_missing_count: int
    unindexed_media: list[StorageDriftItemRead]
    indexed_missing: list[StorageDriftItemRead]


class StorageScanRead(BaseModel):
    """Filesystem scan result for NAS operator views."""

    scanned_at: datetime
    volume: StorageVolumeRead
    channels: list[StorageChannelRead]
    top_extensions: list[StorageExtensionRead]
    orphan_sidecars: list[StorageOrphanSidecarRead]
    folder_tree: list[StorageFolderNodeRead]
    drift: StorageDriftRead
    warnings: list[str]


class StorageDriftActionRequest(BaseModel):
    """Request to resolve one storage drift item without deleting archive files."""

    relative_path: str = Field(min_length=1, max_length=2000)
    dry_run: bool = False


class StorageDriftActionResult(BaseModel):
    """Result of a storage drift recovery or stale-index cleanup action."""

    action: str
    relative_path: str
    applied: bool
    dry_run: bool
    deleted_media_files: int = 0
    planned_media_files: int = 0
    planned_info_json: int = 0
    planned_subtitles: int = 0
    planned_thumbnails: int = 0
    planned_nfo: int = 0
    rescan: RescanApplyResult | None = None
    warnings: list[str] = Field(default_factory=list)


class StorageOrphanActionRequest(BaseModel):
    """Request to preview or apply a safe orphan-sidecar quarantine move."""

    relative_path: str = Field(min_length=1, max_length=2000)
    dry_run: bool = True


class StorageOrphanQuarantineResult(BaseModel):
    """Result of moving one orphan sidecar into the archive quarantine folder."""

    action: str
    relative_path: str
    applied: bool
    dry_run: bool
    destination_relative_path: str | None = None
    size_bytes: int = 0
    warnings: list[str] = Field(default_factory=list)


class StorageQuarantineItemRead(BaseModel):
    """One sidecar currently stored under the hidden quarantine folder."""

    relative_path: str
    original_relative_path: str
    kind: str
    size_bytes: int
    label: str
    quarantined_at: datetime | None = None
    restore_blocked_reason: str | None = None


class StorageQuarantineListRead(BaseModel):
    """Quarantined sidecars available for inspection or restore."""

    count: int
    total_bytes: int
    total_label: str
    items: list[StorageQuarantineItemRead]
    warnings: list[str] = Field(default_factory=list)


class StorageQuarantineRestoreRequest(BaseModel):
    """Request to preview or apply a quarantined sidecar restore."""

    quarantine_relative_path: str = Field(min_length=1, max_length=2400)
    dry_run: bool = True


class StorageQuarantineRestoreResult(BaseModel):
    """Result of restoring one quarantined sidecar back to its original path."""

    action: str
    quarantine_relative_path: str
    destination_relative_path: str | None = None
    applied: bool
    dry_run: bool
    size_bytes: int = 0
    warnings: list[str] = Field(default_factory=list)
