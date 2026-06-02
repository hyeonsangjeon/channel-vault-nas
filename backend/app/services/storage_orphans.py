"""Safe actions for orphan sidecar files discovered by the storage scanner."""

from __future__ import annotations

import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.schemas.storage import (
    StorageOrphanQuarantineResult,
    StorageQuarantineItemRead,
    StorageQuarantineListRead,
    StorageQuarantinePurgeResult,
    StorageQuarantineRestoreResult,
)
from app.services.archive_rescan import (
    INFO_JSON_NAME,
    MEDIA_EXTENSIONS,
    NFO_NAME,
    SUBTITLE_EXTENSIONS,
    THUMBNAIL_EXTENSIONS,
)
from app.services.event_bus import event_bus
from app.services.storage_scanner import QUARANTINE_DIR_NAME

QUARANTINE_PURGE_CONFIRMATION = "PURGE QUARANTINE"


async def quarantine_orphan_sidecar(
    *,
    download_dir: str | Path,
    relative_path: str,
    dry_run: bool = True,
) -> StorageOrphanQuarantineResult:
    """Move one orphan sidecar under a hidden quarantine folder instead of deleting it."""
    root = Path(download_dir).expanduser().resolve()
    source, warnings = _safe_relative_file(root=root, relative_path=relative_path)
    if source is None:
        return _result(relative_path=relative_path, dry_run=dry_run, warnings=warnings)
    if not source.exists() or not source.is_file():
        return _result(relative_path=relative_path, dry_run=dry_run, warnings=["sidecar file does not exist"])
    if not _is_sidecar(source):
        return _result(relative_path=relative_path, dry_run=dry_run, warnings=["target is not a recognized sidecar"])
    if _has_media_sibling(source):
        return _result(
            relative_path=relative_path,
            dry_run=dry_run,
            warnings=["folder already has a media file; quarantine skipped"],
        )

    try:
        size = source.stat().st_size
    except OSError as exc:
        return _result(relative_path=relative_path, dry_run=dry_run, warnings=[f"cannot stat sidecar: {exc}"])

    destination = _quarantine_destination(root=root, relative_path=relative_path)
    destination_relative = destination.relative_to(root).as_posix()
    if dry_run:
        return StorageOrphanQuarantineResult(
            action="quarantine_orphan_sidecar",
            relative_path=relative_path,
            applied=False,
            dry_run=True,
            destination_relative_path=destination_relative,
            size_bytes=size,
            warnings=[],
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    await event_bus.publish(
        "storage.orphan.quarantined",
        {
            "relative_path": relative_path,
            "destination_relative_path": destination_relative,
            "size_bytes": size,
        },
    )
    return StorageOrphanQuarantineResult(
        action="quarantine_orphan_sidecar",
        relative_path=relative_path,
        applied=True,
        dry_run=False,
        destination_relative_path=destination_relative,
        size_bytes=size,
        warnings=[],
    )


def list_quarantined_sidecars(
    *,
    download_dir: str | Path,
    limit: int = 100,
) -> StorageQuarantineListRead:
    """List sidecars currently held in the hidden quarantine folder."""
    root = Path(download_dir).expanduser().resolve()
    quarantine_root = root / QUARANTINE_DIR_NAME
    warnings: list[str] = []
    if not quarantine_root.exists():
        return StorageQuarantineListRead(count=0, total_bytes=0, total_label="0 MB", items=[], warnings=[])

    items: list[StorageQuarantineItemRead] = []
    total_bytes = 0
    for path in sorted(quarantine_root.rglob("*")):
        if len(items) >= limit:
            warnings.append(f"quarantine list stopped after {limit} files")
            break
        if not path.is_file():
            continue
        if not _is_sidecar(path):
            continue
        relative_path = path.relative_to(root).as_posix()
        original_relative_path, stamp = _original_relative_path(path=path, root=root)
        try:
            size = path.stat().st_size
        except OSError as exc:
            warnings.append(f"cannot stat {relative_path}: {exc}")
            continue
        total_bytes += size
        destination = root / original_relative_path if original_relative_path else None
        items.append(
            StorageQuarantineItemRead(
                relative_path=relative_path,
                original_relative_path=original_relative_path or "",
                kind=_sidecar_kind(path),
                size_bytes=size,
                label=_format_bytes(size),
                quarantined_at=_parse_quarantine_stamp(stamp),
                restore_blocked_reason="restore target already exists"
                if destination is not None and destination.exists()
                else None,
            )
        )

    items.sort(key=lambda item: (item.quarantined_at or datetime.min.replace(tzinfo=UTC), item.relative_path), reverse=True)
    return StorageQuarantineListRead(
        count=len(items),
        total_bytes=total_bytes,
        total_label=_format_bytes(total_bytes),
        items=items,
        warnings=warnings,
    )


async def restore_quarantined_sidecar(
    *,
    download_dir: str | Path,
    quarantine_relative_path: str,
    dry_run: bool = True,
) -> StorageQuarantineRestoreResult:
    """Restore one quarantined sidecar back to its original archive path."""
    root = Path(download_dir).expanduser().resolve()
    source, destination, warnings = _safe_quarantine_restore_paths(root=root, quarantine_relative_path=quarantine_relative_path)
    if source is None or destination is None:
        return _restore_result(
            quarantine_relative_path=quarantine_relative_path,
            dry_run=dry_run,
            warnings=warnings,
        )
    if not source.exists() or not source.is_file():
        return _restore_result(
            quarantine_relative_path=quarantine_relative_path,
            dry_run=dry_run,
            warnings=["quarantined sidecar file does not exist"],
        )
    if not _is_sidecar(source):
        return _restore_result(
            quarantine_relative_path=quarantine_relative_path,
            dry_run=dry_run,
            warnings=["target is not a recognized sidecar"],
        )
    if destination.exists():
        return _restore_result(
            quarantine_relative_path=quarantine_relative_path,
            dry_run=dry_run,
            destination_relative_path=destination.relative_to(root).as_posix(),
            warnings=["restore target already exists"],
        )

    try:
        size = source.stat().st_size
    except OSError as exc:
        return _restore_result(
            quarantine_relative_path=quarantine_relative_path,
            dry_run=dry_run,
            warnings=[f"cannot stat sidecar: {exc}"],
        )

    destination_relative = destination.relative_to(root).as_posix()
    if dry_run:
        return StorageQuarantineRestoreResult(
            action="restore_quarantined_sidecar",
            quarantine_relative_path=quarantine_relative_path,
            destination_relative_path=destination_relative,
            applied=False,
            dry_run=True,
            size_bytes=size,
            warnings=[],
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    _remove_empty_quarantine_parents(source.parent, stop=root / QUARANTINE_DIR_NAME)
    await event_bus.publish(
        "storage.orphan.restored",
        {
            "quarantine_relative_path": quarantine_relative_path,
            "destination_relative_path": destination_relative,
            "size_bytes": size,
        },
    )
    return StorageQuarantineRestoreResult(
        action="restore_quarantined_sidecar",
        quarantine_relative_path=quarantine_relative_path,
        destination_relative_path=destination_relative,
        applied=True,
        dry_run=False,
        size_bytes=size,
        warnings=[],
    )


async def purge_quarantined_sidecars(
    *,
    download_dir: str | Path,
    min_age_days: int = 30,
    dry_run: bool = True,
    confirm_text: str = "",
    now: datetime | None = None,
) -> StorageQuarantinePurgeResult:
    """Preview or permanently delete old sidecars from the hidden quarantine folder."""
    root = Path(download_dir).expanduser().resolve()
    current_time = now or datetime.now(UTC)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=UTC)
    cutoff_at = current_time - timedelta(days=min_age_days)
    candidates: list[StorageQuarantineItemRead] = []
    warnings: list[str] = []
    retained_count = 0
    planned_bytes = 0

    quarantine_root = root / QUARANTINE_DIR_NAME
    if quarantine_root.exists():
        for path in sorted(quarantine_root.rglob("*")):
            if not path.is_file() or not _is_sidecar(path):
                continue
            item, item_warnings = _quarantine_item_from_path(path=path, root=root)
            warnings.extend(item_warnings)
            if item is None:
                retained_count += 1
                continue
            if item.quarantined_at is None:
                retained_count += 1
                if len(warnings) < 8:
                    warnings.append(f"{item.relative_path} has no parseable quarantine timestamp")
                continue
            if item.quarantined_at <= cutoff_at:
                candidates.append(item)
                planned_bytes += item.size_bytes
            else:
                retained_count += 1

    if dry_run:
        return _purge_result(
            dry_run=True,
            min_age_days=min_age_days,
            cutoff_at=cutoff_at,
            candidate_count=len(candidates),
            retained_count=retained_count,
            planned_bytes=planned_bytes,
            items=candidates,
            warnings=warnings,
        )

    if confirm_text != QUARANTINE_PURGE_CONFIRMATION:
        return _purge_result(
            dry_run=False,
            min_age_days=min_age_days,
            cutoff_at=cutoff_at,
            candidate_count=len(candidates),
            retained_count=retained_count,
            planned_bytes=planned_bytes,
            items=candidates,
            warnings=[f'type "{QUARANTINE_PURGE_CONFIRMATION}" to purge old quarantine files', *warnings],
        )

    deleted_files = 0
    deleted_bytes = 0
    for item in candidates:
        path = (root / item.relative_path).resolve()
        try:
            path.relative_to(quarantine_root)
        except ValueError:
            warnings.append(f"{item.relative_path} is outside quarantine; skipped")
            continue
        try:
            path.unlink()
        except OSError as exc:
            warnings.append(f"cannot delete {item.relative_path}: {exc}")
            continue
        deleted_files += 1
        deleted_bytes += item.size_bytes
        _remove_empty_quarantine_parents(path.parent, stop=quarantine_root)

    if deleted_files:
        await event_bus.publish(
            "storage.orphan.purged",
            {
                "min_age_days": min_age_days,
                "cutoff_at": cutoff_at.isoformat(),
                "candidate_count": len(candidates),
                "deleted_files": deleted_files,
                "deleted_bytes": deleted_bytes,
            },
        )

    return _purge_result(
        dry_run=False,
        min_age_days=min_age_days,
        cutoff_at=cutoff_at,
        candidate_count=len(candidates),
        retained_count=retained_count,
        planned_bytes=planned_bytes,
        deleted_files=deleted_files,
        deleted_bytes=deleted_bytes,
        items=candidates,
        warnings=warnings,
    )


def _result(
    *,
    relative_path: str,
    dry_run: bool,
    warnings: list[str],
) -> StorageOrphanQuarantineResult:
    return StorageOrphanQuarantineResult(
        action="quarantine_orphan_sidecar",
        relative_path=relative_path,
        applied=False,
        dry_run=dry_run,
        warnings=warnings,
    )


def _restore_result(
    *,
    quarantine_relative_path: str,
    dry_run: bool,
    warnings: list[str],
    destination_relative_path: str | None = None,
) -> StorageQuarantineRestoreResult:
    return StorageQuarantineRestoreResult(
        action="restore_quarantined_sidecar",
        quarantine_relative_path=quarantine_relative_path,
        destination_relative_path=destination_relative_path,
        applied=False,
        dry_run=dry_run,
        warnings=warnings,
    )


def _purge_result(
    *,
    dry_run: bool,
    min_age_days: int,
    cutoff_at: datetime,
    candidate_count: int,
    retained_count: int,
    planned_bytes: int,
    deleted_files: int = 0,
    deleted_bytes: int = 0,
    items: list[StorageQuarantineItemRead],
    warnings: list[str],
) -> StorageQuarantinePurgeResult:
    return StorageQuarantinePurgeResult(
        action="purge_quarantined_sidecars",
        applied=not dry_run and deleted_files > 0,
        dry_run=dry_run,
        min_age_days=min_age_days,
        cutoff_at=cutoff_at,
        required_confirmation=QUARANTINE_PURGE_CONFIRMATION,
        candidate_count=candidate_count,
        retained_count=retained_count,
        planned_bytes=planned_bytes,
        planned_label=_format_bytes(planned_bytes),
        deleted_files=deleted_files,
        deleted_bytes=deleted_bytes,
        deleted_label=_format_bytes(deleted_bytes),
        items=items,
        warnings=warnings,
    )


def _safe_relative_file(*, root: Path, relative_path: str) -> tuple[Path | None, list[str]]:
    raw_path = Path(relative_path)
    if raw_path.is_absolute():
        return None, ["absolute paths are not accepted"]
    candidate = (root / raw_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None, ["target is outside download root"]
    if QUARANTINE_DIR_NAME in candidate.relative_to(root).parts:
        return None, ["quarantine folder paths are not accepted"]
    return candidate, []


def _safe_quarantine_restore_paths(
    *,
    root: Path,
    quarantine_relative_path: str,
) -> tuple[Path | None, Path | None, list[str]]:
    raw_path = Path(quarantine_relative_path)
    if raw_path.is_absolute():
        return None, None, ["absolute paths are not accepted"]
    source = (root / raw_path).resolve()
    try:
        parts = source.relative_to(root).parts
    except ValueError:
        return None, None, ["target is outside download root"]
    if len(parts) < 3 or parts[0] != QUARANTINE_DIR_NAME:
        return None, None, ["target is not inside the quarantine folder"]
    original_parts = parts[2:]
    if QUARANTINE_DIR_NAME in original_parts:
        return None, None, ["nested quarantine paths are not accepted"]
    destination = (root / Path(*original_parts)).resolve()
    try:
        destination.relative_to(root)
    except ValueError:
        return None, None, ["restore target is outside download root"]
    return source, destination, []


def _is_sidecar(path: Path) -> bool:
    return (
        path.name in {INFO_JSON_NAME, NFO_NAME}
        or path.suffix.lower() in SUBTITLE_EXTENSIONS
        or path.suffix.lower() in THUMBNAIL_EXTENSIONS
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


def _has_media_sibling(path: Path) -> bool:
    return any(child.is_file() and child.suffix.lower() in MEDIA_EXTENSIONS for child in path.parent.iterdir())


def _quarantine_destination(*, root: Path, relative_path: str) -> Path:
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S-%f")
    return root / QUARANTINE_DIR_NAME / stamp / relative_path


def _original_relative_path(*, path: Path, root: Path) -> tuple[str | None, str | None]:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return None, None
    if len(parts) < 3 or parts[0] != QUARANTINE_DIR_NAME:
        return None, None
    return Path(*parts[2:]).as_posix(), parts[1]


def _parse_quarantine_stamp(stamp: str | None) -> datetime | None:
    if not stamp:
        return None
    try:
        return datetime.strptime(stamp, "%Y%m%d-%H%M%S-%f").replace(tzinfo=UTC)
    except ValueError:
        return None


def _remove_empty_quarantine_parents(path: Path, *, stop: Path) -> None:
    while path != stop and stop in path.parents:
        try:
            path.rmdir()
        except OSError:
            return
        path = path.parent


def _quarantine_item_from_path(*, path: Path, root: Path) -> tuple[StorageQuarantineItemRead | None, list[str]]:
    warnings: list[str] = []
    try:
        relative_path = path.relative_to(root).as_posix()
    except ValueError:
        return None, ["quarantine item is outside download root"]
    original_relative_path, stamp = _original_relative_path(path=path, root=root)
    try:
        size = path.stat().st_size
    except OSError as exc:
        return None, [f"cannot stat {relative_path}: {exc}"]
    destination = root / original_relative_path if original_relative_path else None
    return (
        StorageQuarantineItemRead(
            relative_path=relative_path,
            original_relative_path=original_relative_path or "",
            kind=_sidecar_kind(path),
            size_bytes=size,
            label=_format_bytes(size),
            quarantined_at=_parse_quarantine_stamp(stamp),
            restore_blocked_reason="restore target already exists"
            if destination is not None and destination.exists()
            else None,
        ),
        warnings,
    )


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
