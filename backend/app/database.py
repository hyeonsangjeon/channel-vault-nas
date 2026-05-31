"""Async SQLAlchemy setup."""

import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path
from threading import Thread

from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from alembic import command
from app.config import settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SQLITE_ASYNC_PREFIX = "sqlite+aiosqlite:///"


def _resolve_database_url(url: str) -> str:
    """Anchor default relative SQLite URLs to the backend directory."""
    if not url.startswith(SQLITE_ASYNC_PREFIX) or url.startswith("sqlite+aiosqlite:////"):
        return url

    raw_path = url.removeprefix(SQLITE_ASYNC_PREFIX)
    if raw_path.startswith("./"):
        raw_path = raw_path[2:]
    db_path = Path(raw_path)
    if db_path.is_absolute():
        return url

    absolute_path = BACKEND_ROOT / db_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    return f"{SQLITE_ASYNC_PREFIX}{absolute_path}"


database_url = _resolve_database_url(settings.database_url)


class Base(DeclarativeBase):
    """Declarative base for ORM models."""


engine = create_async_engine(
    database_url,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Early-stage DB bootstrap until migrations become mandatory."""
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def run_migrations() -> None:
    """Run Alembic migrations from the backend package root."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        _run_migrations()
        return

    error: list[BaseException] = []

    def migrate_in_thread() -> None:
        try:
            _run_migrations()
        except BaseException as exc:  # pragma: no cover - re-raised in caller thread
            error.append(exc)

    thread = Thread(target=migrate_in_thread, daemon=True)
    thread.start()
    thread.join()
    if error:
        raise error[0]


def _run_migrations() -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("prepend_sys_path", str(BACKEND_ROOT))
    config.set_main_option("sqlalchemy.url", database_url)
    config.set_main_option("path_separator", "os")
    command.upgrade(config, "head")
