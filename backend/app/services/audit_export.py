"""Downloadable audit log export helpers."""

from __future__ import annotations

import csv
import json
from io import StringIO
from typing import Literal

from fastapi import Response

AuditExportFormat = Literal["ndjson", "csv"]


def audit_export_response(
    *,
    rows: list[dict[str, object]],
    filename_prefix: str,
    export_format: AuditExportFormat,
) -> Response:
    """Render audit rows as NDJSON or CSV with attachment headers."""
    if export_format == "csv":
        body = _render_csv(rows)
        media_type = "text/csv; charset=utf-8"
    else:
        body = _render_ndjson(rows)
        media_type = "application/x-ndjson; charset=utf-8"
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename_prefix}.{export_format}"'},
    )


def _render_ndjson(rows: list[dict[str, object]]) -> str:
    return "".join(f"{json.dumps(row, ensure_ascii=False)}\n" for row in rows)


def _render_csv(rows: list[dict[str, object]]) -> str:
    if not rows:
        return ""
    columns = sorted({key for row in rows for key in row})
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: _csv_value(row.get(key)) for key in columns})
    return buffer.getvalue()


def _csv_value(value: object) -> object:
    if isinstance(value, dict | list):
        return json.dumps(value, ensure_ascii=False)
    return value
