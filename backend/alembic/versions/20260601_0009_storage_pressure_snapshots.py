"""Add storage pressure snapshots.

Revision ID: 20260601_0009
Revises: 20260601_0008
Create Date: 2026-06-01 23:28:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260601_0009"
down_revision: str | None = "20260601_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("storage_pressure_snapshots"):
        return
    op.create_table(
        "storage_pressure_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("root", sa.Text(), nullable=False),
        sa.Column("archive_bytes", sa.Integer(), nullable=False),
        sa.Column("used_bytes", sa.Integer(), nullable=False),
        sa.Column("free_bytes", sa.Integer(), nullable=False),
        sa.Column("total_bytes", sa.Integer(), nullable=False),
        sa.Column("pressure_percent", sa.Float(), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("dir_count", sa.Integer(), nullable=False),
        sa.Column("channel_count", sa.Integer(), nullable=False),
        sa.Column("orphan_sidecar_count", sa.Integer(), nullable=False),
        sa.Column("unindexed_media_count", sa.Integer(), nullable=False),
        sa.Column("indexed_missing_count", sa.Integer(), nullable=False),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_storage_pressure_snapshots_scanned_at", "storage_pressure_snapshots", ["scanned_at"])
    op.create_index("ix_storage_pressure_snapshots_created_at", "storage_pressure_snapshots", ["created_at"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("storage_pressure_snapshots"):
        return
    op.drop_index("ix_storage_pressure_snapshots_created_at", table_name="storage_pressure_snapshots")
    op.drop_index("ix_storage_pressure_snapshots_scanned_at", table_name="storage_pressure_snapshots")
    op.drop_table("storage_pressure_snapshots")
