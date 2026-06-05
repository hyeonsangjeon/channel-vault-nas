"""Track worker run job ids.

Revision ID: 20260603_0012
Revises: 20260603_0011
Create Date: 2026-06-03 01:18:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "20260603_0012"
down_revision: str | None = "20260603_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("download_worker_runs"):
        return
    columns = {column["name"] for column in inspector.get_columns("download_worker_runs")}
    for column_name in (
        "planned_job_ids",
        "started_job_ids",
        "completed_job_ids",
        "failed_job_ids",
    ):
        if column_name not in columns:
            op.add_column("download_worker_runs", sa.Column(column_name, sa.JSON(), nullable=True))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("download_worker_runs"):
        return
    columns = {column["name"] for column in inspector.get_columns("download_worker_runs")}
    for column_name in (
        "failed_job_ids",
        "completed_job_ids",
        "started_job_ids",
        "planned_job_ids",
    ):
        if column_name in columns:
            op.drop_column("download_worker_runs", column_name)
