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
    proxy: str = ""

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    @model_validator(mode="after")
    def ensure_secret_key(self) -> "Settings":
        """Generate a local dev secret when none is provided."""
        if not self.secret_key:
            self.secret_key = secrets.token_urlsafe(32)
        return self


settings = Settings()
