"""Periodic media worker scheduler."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from app.config import settings
from app.database import AsyncSessionLocal
from app.schemas.jobs import DownloadWorkerRunRequest, DownloadWorkerRunResult
from app.schemas.settings import SchedulerRuntimeStatus
from app.services.download_worker import run_download_worker_once
from app.services.event_bus import event_bus


class DownloadWorkerSchedulerState:
    """In-memory scheduler telemetry for this backend process."""

    def __init__(self) -> None:
        self.running = False
        self.last_started_at: datetime | None = None
        self.last_completed_at: datetime | None = None
        self.last_error: str | None = None
        self.last_result_status: str | None = None
        self.next_tick_at: datetime | None = None

    def mark_started(self) -> None:
        self.running = True
        self.last_started_at = datetime.now(UTC)
        self.next_tick_at = None

    def mark_completed(self, result: DownloadWorkerRunResult) -> None:
        self.running = False
        self.last_completed_at = datetime.now(UTC)
        self.last_error = None
        self.last_result_status = "failed" if result.failed else "completed"

    def mark_failed(self, exc: Exception) -> None:
        self.running = False
        self.last_completed_at = datetime.now(UTC)
        self.last_error = str(exc)
        self.last_result_status = "failed"

    def set_next_tick(self, delay_seconds: int | None) -> None:
        self.next_tick_at = (
            datetime.now(UTC) + timedelta(seconds=delay_seconds)
            if delay_seconds is not None
            else None
        )


class DownloadWorkerScheduler:
    """Small in-process loop that reuses the safe worker claim path."""

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None

    def start(self) -> None:
        """Start the scheduler when configured for this process."""
        if not settings.download_worker_scheduler_enabled or self._task is not None:
            return
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._run(), name="download-worker-scheduler")

    async def stop(self) -> None:
        """Stop the loop and wait for the current tick boundary."""
        if self._task is None or self._stop_event is None:
            return
        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None
            self._stop_event = None

    async def _run(self) -> None:
        assert self._stop_event is not None
        try:
            while not self._stop_event.is_set():
                try:
                    await run_download_worker_scheduler_tick()
                except Exception as exc:  # pragma: no cover - defensive runtime guard
                    await event_bus.publish("download.scheduler.failed", {"error": str(exc)})
                delay_seconds = max(5, settings.download_worker_scheduler_interval_seconds)
                scheduler_state.set_next_tick(delay_seconds)
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=delay_seconds,
                    )
                except TimeoutError:
                    continue
        finally:
            scheduler_state.running = False
            scheduler_state.set_next_tick(None)


async def run_download_worker_scheduler_tick() -> DownloadWorkerRunResult | None:
    """Run one scheduled media worker pass when scheduling and transfer are enabled."""
    if not settings.download_worker_scheduler_enabled or not settings.download_worker_enabled:
        return None
    scheduler_state.mark_started()
    try:
        async with AsyncSessionLocal() as session:
            result = await run_download_worker_once(
                db=session,
                payload=DownloadWorkerRunRequest(
                    channel_id=None,
                    limit=settings.download_worker_scheduler_limit,
                    dry_run=False,
                ),
            )
            await session.commit()
    except Exception as exc:
        scheduler_state.mark_failed(exc)
        raise
    scheduler_state.mark_completed(result)
    return result


def get_download_worker_scheduler_status() -> SchedulerRuntimeStatus:
    """Return operator-facing scheduler status for this process."""
    if not settings.download_worker_scheduler_enabled:
        state = "off"
    elif not settings.download_worker_enabled:
        state = "locked"
    elif scheduler_state.running:
        state = "running"
    elif scheduler_state.last_error:
        state = "failed"
    elif scheduler_state.next_tick_at is not None:
        state = "waiting"
    else:
        state = "armed"
    return SchedulerRuntimeStatus(
        state=state,
        enabled=settings.download_worker_scheduler_enabled,
        worker_enabled=settings.download_worker_enabled,
        running=scheduler_state.running,
        interval_seconds=settings.download_worker_scheduler_interval_seconds,
        limit=settings.download_worker_scheduler_limit,
        last_started_at=scheduler_state.last_started_at,
        last_completed_at=scheduler_state.last_completed_at,
        last_error=scheduler_state.last_error,
        last_result_status=scheduler_state.last_result_status,
        next_tick_at=scheduler_state.next_tick_at,
    )


scheduler_state = DownloadWorkerSchedulerState()
download_worker_scheduler = DownloadWorkerScheduler()
