"""Add per-channel storage pressure snapshots.

Revision ID: 20260602_0010
Revises: 20260601_0009
Create Date: 2026-06-02 00:24:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260602_0010"
down_revision: str | None = "20260601_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("storage_channel_pressure_snapshots"):
        return
    op.create_table(
        "storage_channel_pressure_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("snapshot_id", sa.Integer(), nullable=False),
        sa.Column("root", sa.Text(), nullable=False),
        sa.Column("channel_relative_path", sa.Text(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("media_count", sa.Integer(), nullable=False),
        sa.Column("sidecar_count", sa.Integer(), nullable=False),
        sa.Column("orphan_sidecar_count", sa.Integer(), nullable=False),
        sa.Column("video_folder_count", sa.Integer(), nullable=False),
        sa.Column("pressure_score", sa.Integer(), nullable=False),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["snapshot_id"], ["storage_pressure_snapshots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_storage_channel_pressure_snapshots_snapshot_id",
        "storage_channel_pressure_snapshots",
        ["snapshot_id"],
    )
    op.create_index(
        "ix_storage_channel_pressure_snapshots_channel_relative_path",
        "storage_channel_pressure_snapshots",
        ["channel_relative_path"],
    )
    op.create_index(
        "ix_storage_channel_pressure_snapshots_scanned_at",
        "storage_channel_pressure_snapshots",
        ["scanned_at"],
    )
    op.create_index(
        "ix_storage_channel_pressure_snapshots_created_at",
        "storage_channel_pressure_snapshots",
        ["created_at"],
    )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("storage_channel_pressure_snapshots"):
        return
    op.drop_index("ix_storage_channel_pressure_snapshots_created_at", table_name="storage_channel_pressure_snapshots")
    op.drop_index("ix_storage_channel_pressure_snapshots_scanned_at", table_name="storage_channel_pressure_snapshots")
    op.drop_index(
        "ix_storage_channel_pressure_snapshots_channel_relative_path",
        table_name="storage_channel_pressure_snapshots",
    )
    op.drop_index("ix_storage_channel_pressure_snapshots_snapshot_id", table_name="storage_channel_pressure_snapshots")
    op.drop_table("storage_channel_pressure_snapshots")
