"""Track metadata sync enrichment counts.

Revision ID: 20260603_0011
Revises: 20260602_0010
Create Date: 2026-06-03 00:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260603_0011"
down_revision: str | None = "20260602_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("sync_jobs"):
        columns = {column["name"] for column in inspector.get_columns("sync_jobs")}
        if "videos_enriched" not in columns:
            op.add_column(
                "sync_jobs",
                sa.Column("videos_enriched", sa.Integer(), nullable=False, server_default="0"),
            )

    if inspector.has_table("metadata_sync_ticks"):
        columns = {column["name"] for column in inspector.get_columns("metadata_sync_ticks")}
        if "videos_enriched_count" not in columns:
            op.add_column(
                "metadata_sync_ticks",
                sa.Column("videos_enriched_count", sa.Integer(), nullable=False, server_default="0"),
            )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("metadata_sync_ticks"):
        columns = {column["name"] for column in inspector.get_columns("metadata_sync_ticks")}
        if "videos_enriched_count" in columns:
            op.drop_column("metadata_sync_ticks", "videos_enriched_count")
    if inspector.has_table("sync_jobs"):
        columns = {column["name"] for column in inspector.get_columns("sync_jobs")}
        if "videos_enriched" in columns:
            op.drop_column("sync_jobs", "videos_enriched")
