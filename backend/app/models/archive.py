"""Archive domain ORM models."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Channel(Base):
    """Registered channel or playlist source."""

    __tablename__ = "channels"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_type: Mapped[str] = mapped_column(String(24), default="channel")
    source_url: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    handle: Mapped[str | None] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="active")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, default=360)

    source_video_count: Mapped[int] = mapped_column(Integer, default=0)
    source_counts_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_count: Mapped[int] = mapped_column(Integer, default=0)
    missing_count: Mapped[int] = mapped_column(Integer, default=0)
    removed_saved_count: Mapped[int] = mapped_column(Integer, default=0)

    first_video_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latest_video_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    avg_upload_interval_days: Mapped[float | None] = mapped_column(Float)
    typical_upload_dow: Mapped[int | None] = mapped_column(Integer)
    typical_upload_hour: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    policy: Mapped[ChannelPolicy | None] = relationship(back_populates="channel", uselist=False)
    videos: Mapped[list[Video]] = relationship(back_populates="channel")
    sync_jobs: Mapped[list[SyncJob]] = relationship(back_populates="channel")
    worker_runs: Mapped[list[DownloadWorkerRun]] = relationship(back_populates="channel")


class ChannelPolicy(Base):
    """Per-channel archive policy captured separately from registration."""

    __tablename__ = "channel_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"), unique=True)
    auto_download: Mapped[bool] = mapped_column(Boolean, default=False)
    max_quality: Mapped[str] = mapped_column(String(40), default="1080p")
    audio_only: Mapped[bool] = mapped_column(Boolean, default=False)
    subtitles_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    subtitle_languages: Mapped[list[str] | None] = mapped_column(JSON)
    retention_policy: Mapped[str] = mapped_column(String(80), default="keep")
    worker_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    worker_pause_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    channel: Mapped[Channel] = relationship(back_populates="policy")


class Video(Base):
    """Video metadata tracked from a channel source."""

    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    upload_date: Mapped[date | None] = mapped_column(Date)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    view_count: Mapped[int | None] = mapped_column(Integer)

    source_state: Mapped[str] = mapped_column(String(32), default="available")
    last_seen_in_source_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tags: Mapped[list[str] | None] = mapped_column(JSON)
    categories: Mapped[list[str] | None] = mapped_column(JSON)
    chapters: Mapped[list[dict] | None] = mapped_column(JSON)
    is_short: Mapped[bool] = mapped_column(Boolean, default=False)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    was_livestream: Mapped[bool] = mapped_column(Boolean, default=False)
    info_json_path: Mapped[str | None] = mapped_column(Text)

    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    channel: Mapped[Channel] = relationship(back_populates="videos")
    media_files: Mapped[list[MediaFile]] = relationship(back_populates="video")
    download_jobs: Mapped[list[DownloadJob]] = relationship(back_populates="video")


class SyncJob(Base):
    """A channel metadata refresh run."""

    __tablename__ = "sync_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"), index=True)
    trigger: Mapped[str] = mapped_column(String(32), default="manual", index=True)
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    videos_seen: Mapped[int] = mapped_column(Integer, default=0)
    videos_created: Mapped[int] = mapped_column(Integer, default=0)
    candidates_created: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    channel: Mapped[Channel] = relationship(back_populates="sync_jobs")


class DownloadJob(Base):
    """Download queue entry; initially a candidate before a media worker exists."""

    __tablename__ = "download_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="candidate", index=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    quality: Mapped[str] = mapped_column(String(40), default="1080p")
    priority: Mapped[int] = mapped_column(Integer, default=50)
    preflight_status: Mapped[str] = mapped_column(String(32), default="unchecked")
    estimated_bytes: Mapped[int | None] = mapped_column(Integer)
    preflight_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    video: Mapped[Video] = relationship(back_populates="download_jobs")


class DownloadWorkerRun(Base):
    """Audit row for one manual worker pass."""

    __tablename__ = "download_worker_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[int | None] = mapped_column(ForeignKey("channels.id", ondelete="SET NULL"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True)
    started_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_reason: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    channel: Mapped[Channel | None] = relationship(back_populates="worker_runs")


class MetadataSyncTick(Base):
    """Persistent telemetry for one metadata scheduler pass."""

    __tablename__ = "metadata_sync_ticks"

    id: Mapped[int] = mapped_column(primary_key=True)
    trigger: Mapped[str] = mapped_column(String(32), default="scheduler")
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    scheduler_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=900)
    limit: Mapped[int] = mapped_column(Integer, default=2)
    due_channel_count: Mapped[int] = mapped_column(Integer, default=0)
    synced_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    videos_seen_count: Mapped[int] = mapped_column(Integer, default=0)
    videos_created_count: Mapped[int] = mapped_column(Integer, default=0)
    candidates_created_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_reason: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    next_tick_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class DownloadSchedulerTick(Base):
    """Persistent telemetry for one scheduled worker tick."""

    __tablename__ = "download_scheduler_ticks"

    id: Mapped[int] = mapped_column(primary_key=True)
    trigger: Mapped[str] = mapped_column(String(32), default="scheduler")
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    scheduler_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    worker_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=300)
    limit: Mapped[int] = mapped_column(Integer, default=1)
    started_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_reason: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    next_tick_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class MediaFile(Base):
    """Stored media or sidecar file created by the archive pipeline."""

    __tablename__ = "media_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"))
    relative_path: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    container: Mapped[str | None] = mapped_column(String(40))
    video_codec: Mapped[str | None] = mapped_column(String(80))
    audio_codec: Mapped[str | None] = mapped_column(String(80))
    fps: Mapped[float | None] = mapped_column(Float)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    info_json_path: Mapped[str | None] = mapped_column(Text)
    nfo_path: Mapped[str | None] = mapped_column(Text)
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    checksum: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    video: Mapped[Video] = relationship(back_populates="media_files")
