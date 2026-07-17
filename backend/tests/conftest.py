"""Shared test-suite lifecycle cleanup."""

import asyncio
from collections.abc import Generator

import pytest

from app.database import engine


@pytest.fixture(scope="session", autouse=True)
def dispose_database_engine() -> Generator[None, None, None]:
    """Close pooled aiosqlite workers so the test process exits cleanly."""
    yield
    asyncio.run(engine.dispose())
