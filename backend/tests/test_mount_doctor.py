"""Tests for NAS mount and persistence diagnostics."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.services.mount_doctor import build_mount_doctor


def test_mount_doctor_accepts_separated_writable_paths(tmp_path: Path) -> None:
    metadata_dir = tmp_path / "metadata"
    download_dir = tmp_path / "archive"
    runtime_dir = tmp_path / "runtime"
    metadata_dir.mkdir()
    download_dir.mkdir()
    runtime_dir.mkdir()

    doctor = build_mount_doctor(
        database_url=f"sqlite+aiosqlite:///{metadata_dir / 'app.db'}",
        metadata_dir=metadata_dir,
        download_dir=download_dir,
        runtime_env_file=runtime_dir / ".env.runtime",
    )

    assert doctor.status == "healthy"
    assert doctor.score == 100
    assert doctor.issues == []
    assert {path.id for path in doctor.paths} == {"database", "metadata", "download", "runtime"}
    assert next(path for path in doctor.paths if path.id == "download").writable is True


def test_mount_doctor_flags_overlapping_media_and_metadata(tmp_path: Path) -> None:
    metadata_dir = tmp_path / "metadata"
    download_dir = metadata_dir / "downfolder"
    runtime_dir = tmp_path / "runtime"
    download_dir.mkdir(parents=True)
    runtime_dir.mkdir()

    doctor = build_mount_doctor(
        database_url=f"sqlite+aiosqlite:///{metadata_dir / 'app.db'}",
        metadata_dir=metadata_dir,
        download_dir=download_dir,
        runtime_env_file=runtime_dir / ".env.runtime",
    )

    issue_ids = {issue.id for issue in doctor.issues}
    assert doctor.status == "warning"
    assert "database_download_not_separated" in issue_ids
    assert "metadata_download_not_separated" in issue_ids


def test_mount_doctor_flags_missing_download_directory(tmp_path: Path) -> None:
    metadata_dir = tmp_path / "metadata"
    runtime_dir = tmp_path / "runtime"
    metadata_dir.mkdir()
    runtime_dir.mkdir()

    doctor = build_mount_doctor(
        database_url=f"sqlite+aiosqlite:///{metadata_dir / 'app.db'}",
        metadata_dir=metadata_dir,
        download_dir=tmp_path / "missing-archive",
        runtime_env_file=runtime_dir / ".env.runtime",
    )

    issue_ids = {issue.id for issue in doctor.issues}
    assert doctor.status == "critical"
    assert "download_missing" in issue_ids


@pytest.mark.asyncio
async def test_mount_doctor_endpoint_uses_runtime_settings(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    metadata_dir = tmp_path / "metadata"
    download_dir = tmp_path / "archive"
    runtime_dir = tmp_path / "runtime"
    metadata_dir.mkdir()
    download_dir.mkdir()
    runtime_dir.mkdir()
    monkeypatch.setattr(settings, "auth_token", "")
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{metadata_dir / 'app.db'}")
    monkeypatch.setattr(settings, "metadata_dir", str(metadata_dir))
    monkeypatch.setattr(settings, "download_dir", str(download_dir))
    monkeypatch.setattr(settings, "runtime_env_file", str(runtime_dir / ".env.runtime"))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ops/mount-doctor")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["score"] == 100
    assert next(path for path in data["paths"] if path["id"] == "download")["resolved"] == str(download_dir)
