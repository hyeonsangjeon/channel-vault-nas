"""FastAPI application entrypoint."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, run_migrations
from app.routers import (
    channels,
    dashboard,
    events,
    health,
    imports,
    jobs,
    library,
    operations,
    storage,
    videos,
)
from app.routers import settings as settings_router
from app.services.download_scheduler import download_worker_scheduler
from app.services.event_bus import event_bus
from app.services.metadata_scheduler import metadata_sync_scheduler
from app.services.storage_guard import backup_sqlite_database


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize local runtime directories and metadata DB."""
    Path(settings.metadata_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.download_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.download_dir, ".incomplete").mkdir(parents=True, exist_ok=True)
    if settings.db_backup_on_startup:
        backup_sqlite_database(
            database_url=settings.database_url,
            metadata_dir=settings.metadata_dir,
            keep=settings.db_backup_keep,
        )
    if settings.db_migrate_on_startup:
        run_migrations()
    await init_db()
    metadata_sync_scheduler.start()
    download_worker_scheduler.start()
    try:
        yield
    finally:
        await metadata_sync_scheduler.stop()
        await download_worker_scheduler.stop()
        await event_bus.flush_persistence(timeout=2.0)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(channels.router)
app.include_router(imports.router)
app.include_router(library.router)
app.include_router(operations.router)
app.include_router(storage.router)
app.include_router(jobs.router)
app.include_router(videos.router)
app.include_router(events.router)
app.include_router(settings_router.router)
