"""Add download worker run audit table.

Revision ID: 20260530_0003
Revises: 20260530_0002
Create Date: 2026-05-30 01:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260530_0003"
down_revision: str | None = "20260530_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("download_worker_runs"):
        return
    op.create_table(
        "download_worker_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("channel_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("dry_run", sa.Boolean(), nullable=False),
        sa.Column("started_count", sa.Integer(), nullable=False),
        sa.Column("completed_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("skipped_reason", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_download_worker_runs_channel_id", "download_worker_runs", ["channel_id"])
    op.create_index("ix_download_worker_runs_status", "download_worker_runs", ["status"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("download_worker_runs"):
        op.drop_table("download_worker_runs")
