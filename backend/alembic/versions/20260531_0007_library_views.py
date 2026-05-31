"""Add saved library views.

Revision ID: 20260531_0007
Revises: 20260531_0006
Create Date: 2026-05-31 14:58:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260531_0007"
down_revision: str | None = "20260531_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if inspector.has_table("library_views"):
        return
    op.create_table(
        "library_views",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("query", sa.Text(), nullable=False, server_default=""),
        sa.Column("integrity_filter", sa.String(length=40), nullable=False, server_default="all"),
        sa.Column("sidecar_filter", sa.String(length=40), nullable=False, server_default="all"),
        sa.Column("codec_filter", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_library_views_name", "library_views", ["name"], unique=True)
    op.create_index("ix_library_views_created_at", "library_views", ["created_at"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("library_views"):
        return
    op.drop_index("ix_library_views_created_at", table_name="library_views")
    op.drop_index("ix_library_views_name", table_name="library_views")
    op.drop_table("library_views")
