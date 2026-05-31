"""Application configuration."""

import secrets

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from environment variables or a local .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
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
