"""Filesystem-backed storage scanner for NAS operator panels."""

from __future__ import annotations

import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.config import settings
from app.schemas.storage import (
    StorageChannelRead,
    StorageDriftItemRead,
    StorageDriftRead,
    StorageExtensionRead,
    StorageFolderNodeRead,
    StorageOrphanSidecarRead,
    StorageScanRead,
    StorageVolumeRead,
)
from app.services.archive_rescan import (
    INFO_JSON_NAME,
    MEDIA_EXTENSIONS,
    NFO_NAME,
    SUBTITLE_EXTENSIONS,
    THUMBNAIL_EXTENSIONS,
)


@dataclass
class FolderStat:
    """Accumulated bytes and file count for one folder tree node."""

    bytes: int = 0
    file_count: int = 0


@dataclass
class ChannelStat:
    """Accumulated bytes and file counts for one channel folder."""

    bytes: int = 0
    file_count: int = 0
    media_count: int = 0
    sidecar_count: int = 0
    orphan_sidecar_count: int = 0
    video_folders: set[str] | None = None

    def ensure_video_folders(self) -> set[str]:
        if self.video_folders is None:
            self.video_folders = set()
        return self.video_folders


def build_storage_scan(download_dir: str | Path, indexed_media_paths: set[str] | None = None) -> StorageScanRead:
    """Scan the archive root and summarize real filesystem pressure."""
    root = Path(download_dir).expanduser().resolve()
    warnings: list[str] = []
    indexed_paths = {path for path in (indexed_media_paths or set()) if path}
    if not root.exists():
        return StorageScanRead(
            scanned_at=datetime.now(UTC),
            volume=_volume(root=root, archive_bytes=0, file_count=0, dir_count=0, exists=False),
            channels=[],
            top_extensions=[],
            orphan_sidecars=[],
            folder_tree=[],
            drift=_drift_read(media_paths={}, indexed_paths=indexed_paths),
            warnings=["download root does not exist"],
        )

    files: list[tuple[Path, int]] = []
    file_size_by_relative: dict[str, int] = {}
    dir_count = 0
    for path in root.rglob("*"):
        if path.is_dir():
            dir_count += 1
            continue
        if not path.is_file():
            continue
        try:
            size = path.stat().st_size
        except OSError as exc:
            warnings.append(f"cannot stat {_relative(path, root)}: {exc}")
            continue
        files.append((path, size))
        file_size_by_relative[_relative(path, root)] = size
        if len(files) >= settings.storage_scan_max_files:
            warnings.append(f"scan stopped after {settings.storage_scan_max_files} files")
            break

    media_dirs = {path.parent for path, _size in files if path.suffix.lower() in MEDIA_EXTENSIONS}
    media_paths = {
        _relative(path, root): file_size_by_relative[_relative(path, root)]
        for path, _size in files
        if path.suffix.lower() in MEDIA_EXTENSIONS
    }
    channel_stats: dict[str, ChannelStat] = defaultdict(ChannelStat)
    extension_stats: Counter[str] = Counter()
    extension_bytes: Counter[str] = Counter()
    folder_stats: dict[str, FolderStat] = defaultdict(FolderStat)
    orphan_sidecars: list[StorageOrphanSidecarRead] = []

    for path, size in files:
        relative = _relative(path, root)
        suffix = path.suffix.lower() or "(none)"
        extension_stats[suffix] += 1
        extension_bytes[suffix] += size
        _accumulate_folder_stats(root=root, path=path, size=size, stats=folder_stats)

        channel_key = _channel_key(path=path, root=root)
        if channel_key is not None:
            channel = channel_stats[channel_key]
            channel.bytes += size
            channel.file_count += 1
            if path.suffix.lower() in MEDIA_EXTENSIONS:
                channel.media_count += 1
                channel.ensure_video_folders().add(_relative(path.parent, root))
            elif _is_sidecar(path):
                channel.sidecar_count += 1

        if _is_sidecar(path) and path.parent not in media_dirs:
            if channel_key is not None:
                channel_stats[channel_key].orphan_sidecar_count += 1
            if len(orphan_sidecars) < settings.storage_scan_max_orphans:
                orphan_sidecars.append(
                    StorageOrphanSidecarRead(
                        relative_path=relative,
                        kind=_sidecar_kind(path),
                        size_bytes=size,
                        label=_format_bytes(size),
                        reason="no media file in the same folder",
                    )
                )

    archive_bytes = sum(size for _path, size in files)
    return StorageScanRead(
        scanned_at=datetime.now(UTC),
        volume=_volume(root=root, archive_bytes=archive_bytes, file_count=len(files), dir_count=dir_count, exists=True),
        channels=_channel_reads(channel_stats),
        top_extensions=_extension_reads(extension_stats=extension_stats, extension_bytes=extension_bytes),
        orphan_sidecars=orphan_sidecars,
        folder_tree=_folder_reads(folder_stats),
        drift=_drift_read(media_paths=media_paths, indexed_paths=indexed_paths),
        warnings=warnings,
    )


def _volume(*, root: Path, archive_bytes: int, file_count: int, dir_count: int, exists: bool) -> StorageVolumeRead:
    total = used = free = 0
    pressure = 0.0
    if exists:
        try:
            usage = shutil.disk_usage(root)
            total = usage.total
            free = usage.free
            used = usage.used
            pressure = round((used / total) * 100, 1) if total else 0.0
        except OSError:
            total = used = free = 0
    return StorageVolumeRead(
        root=str(root),
        exists=exists,
        total_bytes=total,
        used_bytes=used,
        free_bytes=free,
        archive_bytes=archive_bytes,
        pressure_percent=pressure,
        archive_label=_format_bytes(archive_bytes),
        used_label=_format_bytes(used),
        free_label=_format_bytes(free),
        total_label=_format_bytes(total),
        file_count=file_count,
        dir_count=dir_count,
    )


def _accumulate_folder_stats(*, root: Path, path: Path, size: int, stats: dict[str, FolderStat]) -> None:
    try:
        parts = path.relative_to(root).parts[:-1]
    except ValueError:
        return
    for depth in range(1, min(len(parts), 4) + 1):
        key = Path(*parts[:depth]).as_posix()
        stats[key].bytes += size
        stats[key].file_count += 1


def _channel_key(*, path: Path, root: Path) -> str | None:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return None
    if len(parts) >= 2 and parts[0] == "channels":
        return f"channels/{parts[1]}"
    if parts:
        return parts[0]
    return None


def _channel_reads(channel_stats: dict[str, ChannelStat]) -> list[StorageChannelRead]:
    total_bytes = sum(stat.bytes for stat in channel_stats.values()) or 1
    rows: list[StorageChannelRead] = []
    for relative_path, stat in channel_stats.items():
        rows.append(
            StorageChannelRead(
                relative_path=relative_path,
                title=Path(relative_path).name,
                bytes=stat.bytes,
                label=_format_bytes(stat.bytes),
                file_count=stat.file_count,
                media_count=stat.media_count,
                sidecar_count=stat.sidecar_count,
                orphan_sidecar_count=stat.orphan_sidecar_count,
                video_folder_count=len(stat.video_folders or set()),
                pressure_score=max(1, round((stat.bytes / total_bytes) * 100)),
            )
        )
    return sorted(rows, key=lambda row: row.bytes, reverse=True)[:16]


def _extension_reads(*, extension_stats: Counter[str], extension_bytes: Counter[str]) -> list[StorageExtensionRead]:
    rows = [
        StorageExtensionRead(
            extension=extension,
            bytes=bytes_value,
            label=_format_bytes(bytes_value),
            count=extension_stats[extension],
        )
        for extension, bytes_value in extension_bytes.items()
    ]
    return sorted(rows, key=lambda row: row.bytes, reverse=True)[:10]


def _folder_reads(folder_stats: dict[str, FolderStat]) -> list[StorageFolderNodeRead]:
    rows = [
        StorageFolderNodeRead(
            relative_path=relative_path,
            name=Path(relative_path).name,
            depth=len(Path(relative_path).parts) - 1,
            bytes=stat.bytes,
            label=_format_bytes(stat.bytes),
            file_count=stat.file_count,
        )
        for relative_path, stat in folder_stats.items()
    ]
    rows.sort(key=lambda row: (row.depth, row.relative_path.lower()))
    return rows[: settings.storage_scan_max_folders]


def _drift_read(*, media_paths: dict[str, int], indexed_paths: set[str]) -> StorageDriftRead:
    unindexed = sorted(set(media_paths) - indexed_paths)
    indexed_missing = sorted(indexed_paths - set(media_paths))
    return StorageDriftRead(
        unindexed_media_count=len(unindexed),
        indexed_missing_count=len(indexed_missing),
        unindexed_media=[
            StorageDriftItemRead(
                relative_path=relative_path,
                kind="unindexed_media",
                label=_format_bytes(media_paths[relative_path]),
                reason="media file exists on disk but is not indexed in SQLite",
            )
            for relative_path in unindexed[: settings.storage_scan_max_orphans]
        ],
        indexed_missing=[
            StorageDriftItemRead(
                relative_path=relative_path,
                kind="indexed_missing",
                label="0 MB",
                reason="SQLite media index points to a file missing on disk",
            )
            for relative_path in indexed_missing[: settings.storage_scan_max_orphans]
        ],
    )


def _is_sidecar(path: Path) -> bool:
    suffix = path.suffix.lower()
    return (
        path.name == INFO_JSON_NAME
        or path.name == NFO_NAME
        or suffix in SUBTITLE_EXTENSIONS
        or (suffix in THUMBNAIL_EXTENSIONS and path.stem in {"thumbnail", "poster", "cover"})
    )


def _sidecar_kind(path: Path) -> str:
    if path.name == INFO_JSON_NAME:
        return "info_json"
    if path.name == NFO_NAME:
        return "nfo"
    suffix = path.suffix.lower()
    if suffix in SUBTITLE_EXTENSIONS:
        return "subtitle"
    if suffix in THUMBNAIL_EXTENSIONS:
        return "thumbnail"
    return "sidecar"


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _format_bytes(value: int) -> str:
    if value >= 1024**4:
        return f"{value / 1024**4:.1f} TB"
    if value >= 1024**3:
        return f"{value / 1024**3:.1f} GB"
    if value >= 1024**2:
        return f"{round(value / 1024**2)} MB"
    if value >= 1024:
        return f"{round(value / 1024)} KB"
    if value > 0:
        return f"{value} B"
    return "0 MB"
