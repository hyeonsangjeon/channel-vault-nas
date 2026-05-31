"""Runtime settings snapshots for operator UI."""

from __future__ import annotations

from shutil import which

from app.config import settings
from app.schemas.settings import BinaryHealth, RuntimeSettingsRead
from app.services.download_scheduler import get_download_worker_scheduler_status


def get_runtime_settings() -> RuntimeSettingsRead:
    """Return non-secret runtime flags and local tool availability."""
    return RuntimeSettingsRead(
        download_worker_enabled=settings.download_worker_enabled,
        download_worker_scheduler_enabled=settings.download_worker_scheduler_enabled,
        download_worker_scheduler_interval_seconds=settings.download_worker_scheduler_interval_seconds,
        download_worker_scheduler_limit=settings.download_worker_scheduler_limit,
        download_dir=settings.download_dir,
        metadata_dir=settings.metadata_dir,
        scheduler_status=get_download_worker_scheduler_status(),
        binaries=[
            _binary_health(name="yt-dlp", command=settings.ytdlp_binary),
            _binary_health(name="ffprobe", command=settings.ffprobe_binary),
        ],
    )


def _binary_health(*, name: str, command: str) -> BinaryHealth:
    resolved = which(command)
    return BinaryHealth(
        name=name,
        command=command,
        available=resolved is not None,
        resolved_path=resolved,
    )
