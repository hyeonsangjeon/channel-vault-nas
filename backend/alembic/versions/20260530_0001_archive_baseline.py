"""Archive metadata baseline.

Revision ID: 20260530_0001
Revises:
Create Date: 2026-05-30 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260530_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not inspector.has_table("channels"):
        op.create_table(
            "channels",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("source_type", sa.String(length=24), nullable=False),
            sa.Column("source_url", sa.Text(), nullable=False),
            sa.Column("external_id", sa.String(length=128), nullable=True),
            sa.Column("handle", sa.String(length=160), nullable=True),
            sa.Column("title", sa.String(length=300), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("thumbnail_url", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sync_interval_minutes", sa.Integer(), nullable=False),
            sa.Column("source_video_count", sa.Integer(), nullable=False),
            sa.Column("source_counts_updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("archived_count", sa.Integer(), nullable=False),
            sa.Column("missing_count", sa.Integer(), nullable=False),
            sa.Column("removed_saved_count", sa.Integer(), nullable=False),
            sa.Column("first_video_published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("latest_video_published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("avg_upload_interval_days", sa.Float(), nullable=True),
            sa.Column("typical_upload_dow", sa.Integer(), nullable=True),
            sa.Column("typical_upload_hour", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("external_id"),
        )

    if not inspector.has_table("videos"):
        op.create_table(
            "videos",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("channel_id", sa.Integer(), nullable=False),
            sa.Column("external_id", sa.String(length=128), nullable=False),
            sa.Column("title", sa.String(length=500), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("upload_date", sa.Date(), nullable=True),
            sa.Column("duration_seconds", sa.Integer(), nullable=True),
            sa.Column("thumbnail_url", sa.Text(), nullable=True),
            sa.Column("view_count", sa.Integer(), nullable=True),
            sa.Column("source_state", sa.String(length=32), nullable=False),
            sa.Column("last_seen_in_source_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("removed_detected_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("tags", sa.JSON(), nullable=True),
            sa.Column("categories", sa.JSON(), nullable=True),
            sa.Column("chapters", sa.JSON(), nullable=True),
            sa.Column("is_short", sa.Boolean(), nullable=False),
            sa.Column("is_live", sa.Boolean(), nullable=False),
            sa.Column("was_livestream", sa.Boolean(), nullable=False),
            sa.Column("info_json_path", sa.Text(), nullable=True),
            sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("ix_videos_external_id", "videos", ["external_id"])

    if not inspector.has_table("media_files"):
        op.create_table(
            "media_files",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("video_id", sa.Integer(), nullable=False),
            sa.Column("relative_path", sa.Text(), nullable=False),
            sa.Column("filename", sa.String(length=500), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("container", sa.String(length=40), nullable=True),
            sa.Column("video_codec", sa.String(length=80), nullable=True),
            sa.Column("audio_codec", sa.String(length=80), nullable=True),
            sa.Column("fps", sa.Float(), nullable=True),
            sa.Column("width", sa.Integer(), nullable=True),
            sa.Column("height", sa.Integer(), nullable=True),
            sa.Column("duration_seconds", sa.Integer(), nullable=True),
            sa.Column("info_json_path", sa.Text(), nullable=True),
            sa.Column("nfo_path", sa.Text(), nullable=True),
            sa.Column("thumbnail_path", sa.Text(), nullable=True),
            sa.Column("checksum", sa.String(length=128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not inspector.has_table("channel_policies"):
        op.create_table(
            "channel_policies",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("channel_id", sa.Integer(), nullable=False),
            sa.Column("auto_download", sa.Boolean(), nullable=False),
            sa.Column("max_quality", sa.String(length=40), nullable=False),
            sa.Column("audio_only", sa.Boolean(), nullable=False),
            sa.Column("subtitles_enabled", sa.Boolean(), nullable=False),
            sa.Column("subtitle_languages", sa.JSON(), nullable=True),
            sa.Column("retention_policy", sa.String(length=80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("channel_id"),
        )

    if not inspector.has_table("sync_jobs"):
        op.create_table(
            "sync_jobs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("channel_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("videos_seen", sa.Integer(), nullable=False),
            sa.Column("videos_created", sa.Integer(), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("ix_sync_jobs_channel_id", "sync_jobs", ["channel_id"])
    _create_index("ix_sync_jobs_status", "sync_jobs", ["status"])

    if not inspector.has_table("download_jobs"):
        op.create_table(
            "download_jobs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("video_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("progress", sa.Float(), nullable=False),
            sa.Column("quality", sa.String(length=40), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("ix_download_jobs_status", "download_jobs", ["status"])
    _create_index("ix_download_jobs_video_id", "download_jobs", ["video_id"])


def downgrade() -> None:
    _drop_index("ix_download_jobs_video_id", "download_jobs")
    _drop_index("ix_download_jobs_status", "download_jobs")
    _drop_table("download_jobs")
    _drop_index("ix_sync_jobs_status", "sync_jobs")
    _drop_index("ix_sync_jobs_channel_id", "sync_jobs")
    _drop_table("sync_jobs")
    _drop_table("channel_policies")
    _drop_table("media_files")
    _drop_index("ix_videos_external_id", "videos")
    _drop_table("videos")
    _drop_table("channels")


def _create_index(name: str, table_name: str, columns: list[str]) -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(table_name):
        return
    existing = {index["name"] for index in inspector.get_indexes(table_name)}
    if name not in existing:
        op.create_index(name, table_name, columns)


def _drop_index(name: str, table_name: str) -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return
    existing = {index["name"] for index in inspector.get_indexes(table_name)}
    if name in existing:
        op.drop_index(name, table_name=table_name)


def _drop_table(table_name: str) -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table(table_name):
        op.drop_table(table_name)
