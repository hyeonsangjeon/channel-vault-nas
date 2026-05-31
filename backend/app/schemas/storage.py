"""Filesystem storage scan schemas."""

from datetime import datetime

from pydantic import BaseModel


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
