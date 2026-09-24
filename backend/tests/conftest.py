"""Shared test-suite lifecycle cleanup."""

import asyncio
import os
import tempfile
from collections.abc import Generator

import pytest

_test_root: tempfile.TemporaryDirectory[str] | None = None


def pytest_configure() -> None:
    global _test_root
    _test_root = tempfile.TemporaryDirectory(prefix="cvn-tests-")
    root = _test_root.name
    os.environ.update(
        CVN_DATABASE_URL=f"sqlite+aiosqlite:///{root}/app.db",
        CVN_METADATA_DIR=f"{root}/metadata",
        CVN_DOWNLOAD_DIR=f"{root}/archive",
        CVN_RUNTIME_ENV_FILE=f"{root}/runtime.env",
        CVN_AUTH_TOKEN="",
        CVN_DB_BACKUP_ON_STARTUP="false",
        CVN_DOWNLOAD_WORKER_ENABLED="false",
        CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED="false",
        CVN_METADATA_SYNC_SCHEDULER_ENABLED="false",
    )


def pytest_unconfigure() -> None:
    if _test_root is not None:
        _test_root.cleanup()


@pytest.fixture(scope="session", autouse=True)
def dispose_database_engine() -> Generator[None, None, None]:
    """Close pooled aiosqlite workers so the test process exits cleanly."""
    from app.database import engine

    yield
    asyncio.run(engine.dispose())
