"""Add per-channel worker pause policy.

Revision ID: 20260531_0004
Revises: 20260530_0003
Create Date: 2026-05-31 00:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260531_0004"
down_revision: str | None = "20260530_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    _add_column_if_missing(
        "channel_policies",
        sa.Column("worker_paused", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    _add_column_if_missing("channel_policies", sa.Column("worker_pause_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    for column_name in ("worker_pause_reason", "worker_paused"):
        _drop_column_if_exists("channel_policies", column_name)


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    inspector = inspect(op.get_bind())
    existing = {item["name"] for item in inspector.get_columns(table_name)}
    if column.name not in existing:
        op.add_column(table_name, column)


def _drop_column_if_exists(table_name: str, column_name: str) -> None:
    inspector = inspect(op.get_bind())
    existing = {item["name"] for item in inspector.get_columns(table_name)}
    if column_name in existing:
        op.drop_column(table_name, column_name)
