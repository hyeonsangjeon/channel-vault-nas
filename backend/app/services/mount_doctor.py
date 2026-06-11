"""Diagnose NAS volume mounts and persistence-sensitive runtime paths."""

from __future__ import annotations

import shutil
from datetime import UTC, datetime
from pathlib import Path

from app.config import BACKEND_ROOT
from app.schemas.operations import (
    MountDoctorIssue,
    MountDoctorPath,
    MountDoctorRead,
    MountDoctorStatus,
)

SQLITE_ASYNC_PREFIX = "sqlite+aiosqlite:///"
SQLITE_SYNC_PREFIX = "sqlite:///"


def build_mount_doctor(
    *,
    database_url: str,
    metadata_dir: str | Path,
    download_dir: str | Path,
    runtime_env_file: str | Path,
) -> MountDoctorRead:
    """Return a local operator diagnosis for DB/data/runtime path safety."""
    generated_at = datetime.now(UTC)
    running_in_container = _running_in_container()
    database_kind, database_path, database_error = _database_path(database_url)
    metadata_path = _resolve_path(metadata_dir)
    download_path = _resolve_path(download_dir)
    runtime_path = _resolve_path(runtime_env_file)

    path_reads = [
        _path_read(
            id="database",
            label="SQLite database",
            configured=database_url,
            path=database_path,
            expected="file",
            error=database_error,
        ),
        _path_read(id="metadata", label="Metadata directory", configured=str(metadata_dir), path=metadata_path, expected="directory"),
        _path_read(id="download", label="Archive data directory", configured=str(download_dir), path=download_path, expected="directory"),
        _path_read(id="runtime", label="Runtime env file", configured=str(runtime_env_file), path=runtime_path, expected="file"),
    ]
    by_id = {path.id: path for path in path_reads}
    issues: list[MountDoctorIssue] = []

    for path in path_reads:
        if path.error:
            issues.append(
                MountDoctorIssue(
                    id=f"{path.id}_path_error",
                    severity="critical",
                    title=f"{path.label} cannot be inspected",
                    detail=path.error,
                    path_id=path.id,
                )
            )
            continue
        if not path.parent_exists:
            issues.append(
                MountDoctorIssue(
                    id=f"{path.id}_parent_missing",
                    severity="critical",
                    title=f"{path.label} parent is missing",
                    detail=f"Create or mount the parent directory for {path.resolved}.",
                    path_id=path.id,
                )
            )
        elif not path.parent_writable:
            issues.append(
                MountDoctorIssue(
                    id=f"{path.id}_parent_read_only",
                    severity="critical",
                    title=f"{path.label} parent is not writable",
                    detail=f"The app cannot write beside {path.resolved}. Check NAS permissions.",
                    path_id=path.id,
                )
            )
        if path.id in {"metadata", "download"} and not path.exists:
            issues.append(
                MountDoctorIssue(
                    id=f"{path.id}_missing",
                    severity="critical",
                    title=f"{path.label} is missing",
                    detail=f"Mount or create {path.resolved} before storing archive state.",
                    path_id=path.id,
                )
            )
        if path.id in {"metadata", "download"} and path.exists and not path.writable:
            issues.append(
                MountDoctorIssue(
                    id=f"{path.id}_read_only",
                    severity="critical",
                    title=f"{path.label} is not writable",
                    detail=f"The app could not create a small write-test file in {path.resolved}.",
                    path_id=path.id,
                )
            )

    separation_issues = _separation_issues(
        database=by_id["database"],
        metadata=by_id["metadata"],
        download=by_id["download"],
        runtime=by_id["runtime"],
    )
    issues.extend(separation_issues)

    if running_in_container:
        for path_id in ("metadata", "download", "runtime"):
            path = by_id[path_id]
            if path.exists and not path.is_mount:
                issues.append(
                    MountDoctorIssue(
                        id=f"{path_id}_not_mountpoint",
                        severity="warning",
                        title=f"{path.label} does not look like a mounted volume",
                        detail=(
                            "Inside Docker this path is not reported as a mount point. "
                            "Verify docker-compose volume bindings before trusting persistence."
                        ),
                        path_id=path.id,
                    )
                )

    if by_id["download"].free_bytes is not None and by_id["download"].free_bytes < 1_000_000_000:
        issues.append(
            MountDoctorIssue(
                id="download_low_free_space",
                severity="warning",
                title="Archive data directory is low on free space",
                detail=f"Only {by_id['download'].free_label} is free where media will be written.",
                path_id="download",
            )
        )

    score = max(0, 100 - sum(_issue_penalty(issue.severity) for issue in issues))
    status = _status(issues)
    summary = _summary(status=status, score=score, issues=issues)
    return MountDoctorRead(
        generated_at=generated_at,
        status=status,
        score=score,
        running_in_container=running_in_container,
        database_kind=database_kind,
        paths=path_reads,
        issues=issues,
        summary=summary,
    )


def _database_path(database_url: str) -> tuple[str, Path, str | None]:
    if database_url.startswith(SQLITE_ASYNC_PREFIX):
        raw_path = database_url.removeprefix(SQLITE_ASYNC_PREFIX)
        return "sqlite", _resolve_sqlite_path(raw_path), None
    if database_url.startswith(SQLITE_SYNC_PREFIX):
        raw_path = database_url.removeprefix(SQLITE_SYNC_PREFIX)
        return "sqlite", _resolve_sqlite_path(raw_path), None
    return "external", _resolve_path("./metadata/app.db"), "Only SQLite database URLs can be inspected for local mount safety."


def _resolve_sqlite_path(raw_path: str) -> Path:
    if raw_path.startswith("/"):
        return Path(raw_path).expanduser().resolve()
    if raw_path.startswith("./"):
        raw_path = raw_path[2:]
    return (BACKEND_ROOT / raw_path).expanduser().resolve()


def _resolve_path(value: str | Path) -> Path:
    return Path(value).expanduser().resolve()


def _path_read(
    *,
    id: str,
    label: str,
    configured: str,
    path: Path,
    expected: str,
    error: str | None = None,
) -> MountDoctorPath:
    parent = path.parent if expected == "file" else path
    exists = path.exists()
    parent_exists = parent.exists()
    parent_writable = _writable(parent) if parent_exists else False
    writable = _writable(path) if exists else parent_writable
    free_bytes: int | None = None
    total_bytes: int | None = None
    pressure_percent: float | None = None
    try:
        usage_root = path if path.exists() and path.is_dir() else parent
        if usage_root.exists():
            usage = shutil.disk_usage(usage_root)
            free_bytes = usage.free
            total_bytes = usage.total
            pressure_percent = round((usage.used / usage.total) * 100, 1) if usage.total else 0.0
    except OSError as exc:
        error = error or str(exc)
    return MountDoctorPath(
        id=id,
        label=label,
        configured=configured,
        resolved=str(path),
        exists=exists,
        writable=writable,
        is_directory=path.is_dir(),
        is_file=path.is_file(),
        is_mount=_is_mount(path),
        parent_exists=parent_exists,
        parent_writable=parent_writable,
        free_bytes=free_bytes,
        free_label=_format_bytes(free_bytes or 0) if free_bytes is not None else "",
        total_bytes=total_bytes,
        total_label=_format_bytes(total_bytes or 0) if total_bytes is not None else "",
        pressure_percent=pressure_percent,
        error=error,
    )


def _writable(path: Path) -> bool:
    if not path.exists():
        return False
    target = path if path.is_dir() else path.parent
    probe = target / ".cvn-write-test"
    try:
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def _is_mount(path: Path) -> bool:
    try:
        target = path if path.exists() and path.is_dir() else path.parent
        return target.exists() and target.is_mount()
    except OSError:
        return False


def _separation_issues(
    *,
    database: MountDoctorPath,
    metadata: MountDoctorPath,
    download: MountDoctorPath,
    runtime: MountDoctorPath,
) -> list[MountDoctorIssue]:
    issues: list[MountDoctorIssue] = []
    database_parent = str(Path(database.resolved).parent)
    metadata_path = metadata.resolved
    download_path = download.resolved
    runtime_parent = str(Path(runtime.resolved).parent)

    if _same_or_nested(download_path, database_parent) or _same_or_nested(database_parent, download_path):
        issues.append(
            MountDoctorIssue(
                id="database_download_not_separated",
                severity="warning",
                title="Database and archive data are not separated",
                detail="Keep SQLite metadata and large media folders in separate host-mounted directories.",
                path_id="database",
            )
        )
    if _same_or_nested(download_path, metadata_path) or _same_or_nested(metadata_path, download_path):
        issues.append(
            MountDoctorIssue(
                id="metadata_download_not_separated",
                severity="warning",
                title="Metadata and archive data folders overlap",
                detail="Use different host folders for CVN_METADATA_HOST_DIR and CVN_DOWNLOAD_HOST_DIR.",
                path_id="metadata",
            )
        )
    if _same_or_nested(runtime_parent, download_path):
        issues.append(
            MountDoctorIssue(
                id="runtime_inside_archive_data",
                severity="warning",
                title="Runtime env file is inside the media archive",
                detail="Keep runtime overrides with app metadata, not inside downloaded media folders.",
                path_id="runtime",
            )
        )
    return issues


def _same_or_nested(left: str, right: str) -> bool:
    left_path = Path(left)
    right_path = Path(right)
    if left_path == right_path:
        return True
    try:
        left_path.relative_to(right_path)
        return True
    except ValueError:
        return False


def _running_in_container() -> bool:
    if Path("/.dockerenv").exists():
        return True
    try:
        return "docker" in Path("/proc/1/cgroup").read_text(encoding="utf-8", errors="ignore").lower()
    except OSError:
        return False


def _status(issues: list[MountDoctorIssue]) -> MountDoctorStatus:
    severities = {issue.severity for issue in issues}
    if "critical" in severities:
        return "critical"
    if "warning" in severities:
        return "warning"
    return "healthy"


def _summary(*, status: MountDoctorStatus, score: int, issues: list[MountDoctorIssue]) -> str:
    if status == "healthy":
        return "DB, runtime, and archive paths are writable and separated."
    critical_count = sum(1 for issue in issues if issue.severity == "critical")
    warning_count = sum(1 for issue in issues if issue.severity == "warning")
    return f"Mount doctor score {score}: {critical_count} critical and {warning_count} warning issues."


def _issue_penalty(severity: str) -> int:
    if severity == "critical":
        return 28
    if severity == "warning":
        return 11
    if severity == "info":
        return 3
    return 0


def _format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
