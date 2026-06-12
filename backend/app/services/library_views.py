"""Saved library view persistence services."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import LibraryView
from app.schemas.library import (
    LibraryViewBundle,
    LibraryViewExportItem,
    LibraryViewImportRequest,
    LibraryViewImportResult,
    LibraryViewRead,
    LibraryViewWrite,
)


async def list_library_views(*, db: AsyncSession, limit: int = 20) -> list[LibraryViewRead]:
    """Return newest saved library views."""
    effective_limit = max(1, min(limit, 50))
    result = await db.execute(
        select(LibraryView).order_by(LibraryView.updated_at.desc(), LibraryView.created_at.desc()).limit(effective_limit)
    )
    return [_to_library_view(row) for row in result.scalars().all()]


async def save_library_view(*, db: AsyncSession, payload: LibraryViewWrite) -> LibraryViewRead:
    """Create or update a saved library view by name."""
    view, _created = await _upsert_library_view(db=db, payload=payload)
    return _to_library_view(view)


async def export_library_views(*, db: AsyncSession, limit: int = 50) -> LibraryViewBundle:
    """Return a portable saved-view bundle without install-local IDs."""
    views = await list_library_views(db=db, limit=limit)
    exported = [
        LibraryViewExportItem(
            name=view.name,
            query=view.query,
            integrity=view.integrity,
            sidecar=view.sidecar,
            codec=view.codec,
        )
        for view in views
    ]
    return LibraryViewBundle(generated_at=datetime.now(UTC), count=len(exported), views=exported)


async def import_library_views(*, db: AsyncSession, payload: LibraryViewImportRequest) -> LibraryViewImportResult:
    """Import a portable saved-view bundle by upserting each unique name."""
    created_count = 0
    updated_count = 0
    skipped_count = 0
    imported_names: set[str] = set()

    for view_payload in payload.views:
        name = view_payload.name.strip()
        if not name or name in imported_names:
            skipped_count += 1
            continue
        imported_names.add(name)
        _view, created = await _upsert_library_view(db=db, payload=view_payload)
        if created:
            created_count += 1
        else:
            updated_count += 1

    imported = await list_library_views(db=db, limit=50)
    return LibraryViewImportResult(
        imported_count=created_count + updated_count,
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        views=imported,
    )


async def delete_library_view(*, db: AsyncSession, view_id: int) -> bool:
    """Delete one saved library view."""
    view = await db.get(LibraryView, view_id)
    if view is None:
        return False
    await db.delete(view)
    await db.flush()
    return True


async def _upsert_library_view(*, db: AsyncSession, payload: LibraryViewWrite) -> tuple[LibraryView, bool]:
    name = payload.name.strip()
    now = datetime.now(UTC)
    view = await db.scalar(select(LibraryView).where(LibraryView.name == name).limit(1))
    created = view is None
    if view is None:
        view = LibraryView(name=name, created_at=now, updated_at=now)
        db.add(view)

    view.query = payload.query.strip()
    view.integrity_filter = payload.integrity.strip() or "all"
    view.sidecar_filter = payload.sidecar.strip() or "all"
    view.codec_filter = payload.codec.strip()
    view.updated_at = now
    await db.flush()
    return view, created


def _to_library_view(view: LibraryView) -> LibraryViewRead:
    return LibraryViewRead(
        id=view.id,
        name=view.name,
        query=view.query,
        integrity=view.integrity_filter,
        sidecar=view.sidecar_filter,
        codec=view.codec_filter,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )
