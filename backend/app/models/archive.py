"""Archive domain ORM models."""

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

    videos: Mapped[list["Video"]] = relationship(back_populates="channel")


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
    media_files: Mapped[list["MediaFile"]] = relationship(back_populates="video")


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
