"""Add download queue preflight fields.

Revision ID: 20260530_0002
Revises: 20260530_0001
Create Date: 2026-05-30 00:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260530_0002"
down_revision: str | None = "20260530_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    _add_column_if_missing(
        "download_jobs",
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
    )
    _add_column_if_missing(
        "download_jobs",
        sa.Column("preflight_status", sa.String(length=32), nullable=False, server_default="unchecked"),
    )
    _add_column_if_missing("download_jobs", sa.Column("estimated_bytes", sa.Integer(), nullable=True))
    _add_column_if_missing(
        "download_jobs",
        sa.Column("preflight_checked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    for column_name in ("preflight_checked_at", "estimated_bytes", "preflight_status", "priority"):
        _drop_column_if_exists("download_jobs", column_name)


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
