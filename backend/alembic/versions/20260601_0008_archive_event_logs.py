"""Add persistent archive event logs.

Revision ID: 20260601_0008
Revises: 20260531_0007
Create Date: 2026-06-01 16:05:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260601_0008"
down_revision: str | None = "20260531_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("archive_event_logs"):
        return
    op.create_table(
        "archive_event_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_archive_event_logs_type", "archive_event_logs", ["type"])
    op.create_index("ix_archive_event_logs_occurred_at", "archive_event_logs", ["occurred_at"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("archive_event_logs"):
        return
    op.drop_index("ix_archive_event_logs_occurred_at", table_name="archive_event_logs")
    op.drop_index("ix_archive_event_logs_type", table_name="archive_event_logs")
    op.drop_table("archive_event_logs")
