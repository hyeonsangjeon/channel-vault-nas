"""Add persistent scheduler tick telemetry.

Revision ID: 20260531_0005
Revises: 20260531_0004
Create Date: 2026-05-31 01:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260531_0005"
down_revision: str | None = "20260531_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("download_scheduler_ticks"):
        return
    op.create_table(
        "download_scheduler_ticks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trigger", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("scheduler_enabled", sa.Boolean(), nullable=False),
        sa.Column("worker_enabled", sa.Boolean(), nullable=False),
        sa.Column("interval_seconds", sa.Integer(), nullable=False),
        sa.Column("limit", sa.Integer(), nullable=False),
        sa.Column("started_count", sa.Integer(), nullable=False),
        sa.Column("completed_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("skipped_reason", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("next_tick_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_download_scheduler_ticks_status", "download_scheduler_ticks", ["status"])
    op.create_index("ix_download_scheduler_ticks_created_at", "download_scheduler_ticks", ["created_at"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("download_scheduler_ticks"):
        op.drop_index("ix_download_scheduler_ticks_created_at", table_name="download_scheduler_ticks")
        op.drop_index("ix_download_scheduler_ticks_status", table_name="download_scheduler_ticks")
        op.drop_table("download_scheduler_ticks")
