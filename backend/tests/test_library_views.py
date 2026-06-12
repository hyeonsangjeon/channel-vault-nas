"""Saved library view sharing API tests."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import AsyncSessionLocal, init_db, run_migrations
from app.main import app
from app.models.archive import LibraryView


@pytest.mark.asyncio
async def test_saved_library_views_export_and_import() -> None:
    run_migrations()
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(LibraryView))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first = await client.post(
            "/api/library/views",
            json={
                "name": "Missing subtitles",
                "query": "lecture",
                "integrity": "partial_sidecars",
                "sidecar": "subtitles",
                "codec": "h264 1080p",
            },
        )
        second = await client.post(
            "/api/library/views",
            json={
                "name": "Media only",
                "query": "",
                "integrity": "media_only",
                "sidecar": "all",
                "codec": "mp4",
            },
        )
        exported = await client.get("/api/library/views/export")

        imported = await client.post(
            "/api/library/views/import",
            json={
                "views": [
                    {
                        "name": "Missing subtitles",
                        "query": "lecture updated",
                        "integrity": "partial_sidecars",
                        "sidecar": "subtitles",
                        "codec": "h264",
                    },
                    {
                        "name": "Failed 1080p",
                        "query": "failed",
                        "integrity": "missing_media",
                        "sidecar": "all",
                        "codec": "1080p",
                    },
                    {
                        "name": "Failed 1080p",
                        "query": "duplicate should be skipped",
                        "integrity": "complete",
                        "sidecar": "thumbnail",
                        "codec": "",
                    },
                ]
            },
        )
        views_after_import = await client.get("/api/library/views")

    assert first.status_code == 200
    assert second.status_code == 200
    assert exported.status_code == 200
    exported_payload = exported.json()
    assert exported_payload["kind"] == "channel_vault_library_views"
    assert exported_payload["version"] == 1
    assert exported_payload["count"] == 2
    assert "id" not in exported_payload["views"][0]
    assert {view["name"] for view in exported_payload["views"]} == {"Missing subtitles", "Media only"}

    assert imported.status_code == 200
    imported_payload = imported.json()
    assert imported_payload["imported_count"] == 2
    assert imported_payload["created_count"] == 1
    assert imported_payload["updated_count"] == 1
    assert imported_payload["skipped_count"] == 1

    assert views_after_import.status_code == 200
    views_by_name = {view["name"]: view for view in views_after_import.json()}
    assert set(views_by_name) == {"Missing subtitles", "Media only", "Failed 1080p"}
    assert views_by_name["Missing subtitles"]["query"] == "lecture updated"
    assert views_by_name["Failed 1080p"]["codec"] == "1080p"
