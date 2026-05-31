"""Application configuration."""

import secrets
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Settings loaded from environment variables or a local .env file."""

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_ROOT / ".env"), str(BACKEND_ROOT / ".env.runtime"), ".env", ".env.runtime"),
        env_prefix="CVN_",
        extra="ignore",
    )

    app_name: str = "Channel Vault NAS"
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    admin_id: str = "admin"
    admin_password: str = "admin"
    secret_key: str = ""

    database_url: str = "sqlite+aiosqlite:///./metadata/app.db"
    download_dir: str = "./downfolder"
    metadata_dir: str = "./metadata"
    runtime_env_file: str = ".env.runtime"
    db_backup_on_startup: bool = True
    db_backup_keep: int = 5
    db_migrate_on_startup: bool = True
    proxy: str = ""
    ytdlp_binary: str = "yt-dlp"
    ffprobe_binary: str = "ffprobe"
    media_probe_timeout_seconds: int = 20
    channel_probe_timeout_seconds: int = 90
    channel_probe_video_limit: int = 500
    download_worker_enabled: bool = False
    download_worker_plan_limit: int = 3
    download_worker_timeout_seconds: int = 14400
    download_worker_scheduler_enabled: bool = False
    download_worker_scheduler_interval_seconds: int = 300
    download_worker_scheduler_limit: int = 1
    metadata_sync_scheduler_enabled: bool = False
    metadata_sync_scheduler_interval_seconds: int = 900
    metadata_sync_scheduler_limit: int = 2
    metadata_sync_auto_candidates_limit: int = 50
    restart_adapter: str = "auto"
    restart_adapter_execute: bool = False
    restart_hook_command: str = ""
    restart_service_name: str = ""
    restart_command_timeout_seconds: int = 8
    storage_scan_max_files: int = 10_000
    storage_scan_max_orphans: int = 24
    storage_scan_max_folders: int = 80

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    @model_validator(mode="after")
    def ensure_secret_key(self) -> "Settings":
        """Generate a local dev secret when none is provided."""
        if not self.secret_key:
            self.secret_key = secrets.token_urlsafe(32)
        return self


settings = Settings()
