"""SQLite backup guard used before schema maintenance."""

from __future__ import annotations

import shutil
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote


def sqlite_path_from_url(database_url: str, cwd: Path | None = None) -> Path | None:
    """Resolve local SQLite URLs into filesystem paths."""
    for prefix in ("sqlite+aiosqlite:///", "sqlite:///"):
        if database_url.startswith(prefix):
            raw_path = unquote(database_url.removeprefix(prefix))
            if raw_path == ":memory:":
                return None
            path = Path(raw_path)
            if path.is_absolute():
                return path
            return (cwd or Path.cwd()) / path
    return None


def backup_sqlite_database(
    database_url: str,
    metadata_dir: str | Path,
    *,
    keep: int = 5,
    now: datetime | None = None,
) -> Path | None:
    """Create a timestamped backup for an existing SQLite database file."""
    database_path = sqlite_path_from_url(database_url)
    if database_path is None or not database_path.exists():
        return None

    backup_dir = Path(metadata_dir) / "db-backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = (now or datetime.now(UTC)).strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"{database_path.stem}.backup-{timestamp}{database_path.suffix}"
    shutil.copy2(database_path, backup_path)
    _prune_old_backups(backup_dir=backup_dir, database_path=database_path, keep=keep)
    return backup_path


def _prune_old_backups(backup_dir: Path, database_path: Path, keep: int) -> None:
    if keep <= 0:
        return
    backups = sorted(
        backup_dir.glob(f"{database_path.stem}.backup-*{database_path.suffix}"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for old_backup in backups[keep:]:
        old_backup.unlink(missing_ok=True)
