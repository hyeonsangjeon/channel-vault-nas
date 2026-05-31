"""Add metadata sync scheduler telemetry.

Revision ID: 20260531_0006
Revises: 20260531_0005
Create Date: 2026-05-31 02:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260531_0006"
down_revision: str | None = "20260531_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("sync_jobs"):
        columns = {column["name"] for column in inspector.get_columns("sync_jobs")}
        if "trigger" not in columns:
            op.add_column(
                "sync_jobs",
                sa.Column("trigger", sa.String(length=32), nullable=False, server_default="manual"),
            )
            op.create_index("ix_sync_jobs_trigger", "sync_jobs", ["trigger"])
        if "candidates_created" not in columns:
            op.add_column(
                "sync_jobs",
                sa.Column("candidates_created", sa.Integer(), nullable=False, server_default="0"),
            )

    if inspector.has_table("metadata_sync_ticks"):
        return
    op.create_table(
        "metadata_sync_ticks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trigger", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("scheduler_enabled", sa.Boolean(), nullable=False),
        sa.Column("interval_seconds", sa.Integer(), nullable=False),
        sa.Column("limit", sa.Integer(), nullable=False),
        sa.Column("due_channel_count", sa.Integer(), nullable=False),
        sa.Column("synced_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("videos_seen_count", sa.Integer(), nullable=False),
        sa.Column("videos_created_count", sa.Integer(), nullable=False),
        sa.Column("candidates_created_count", sa.Integer(), nullable=False),
        sa.Column("skipped_reason", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("next_tick_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_metadata_sync_ticks_status", "metadata_sync_ticks", ["status"])
    op.create_index("ix_metadata_sync_ticks_created_at", "metadata_sync_ticks", ["created_at"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("metadata_sync_ticks"):
        op.drop_index("ix_metadata_sync_ticks_created_at", table_name="metadata_sync_ticks")
        op.drop_index("ix_metadata_sync_ticks_status", table_name="metadata_sync_ticks")
        op.drop_table("metadata_sync_ticks")
