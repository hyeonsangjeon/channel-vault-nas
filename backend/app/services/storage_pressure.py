"""Persistent storage pressure snapshots for NAS growth trends."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import StorageChannelPressureSnapshot, StoragePressureSnapshot
from app.schemas.storage import (
    StorageChannelPressureComparisonRead,
    StorageChannelPressureSnapshotRead,
    StorageChannelPressureTrendRead,
    StoragePressureSnapshotRead,
    StoragePressureTrendRead,
    StorageScanRead,
)
from app.services.event_bus import event_bus


async def capture_storage_pressure_snapshot(
    *,
    db: AsyncSession,
    scan: StorageScanRead,
) -> StoragePressureSnapshotRead:
    """Persist the current storage scan as a trend point."""
    row = StoragePressureSnapshot(
        root=scan.volume.root,
        archive_bytes=scan.volume.archive_bytes,
        used_bytes=scan.volume.used_bytes,
        free_bytes=scan.volume.free_bytes,
        total_bytes=scan.volume.total_bytes,
        pressure_percent=scan.volume.pressure_percent,
        file_count=scan.volume.file_count,
        dir_count=scan.volume.dir_count,
        channel_count=len(scan.channels),
        orphan_sidecar_count=len(scan.orphan_sidecars),
        unindexed_media_count=scan.drift.unindexed_media_count,
        indexed_missing_count=scan.drift.indexed_missing_count,
        scanned_at=scan.scanned_at,
        created_at=datetime.now(UTC),
    )
    db.add(row)
    await db.flush()
    created_at = row.created_at
    db.add_all(
        [
            StorageChannelPressureSnapshot(
                snapshot_id=row.id,
                root=scan.volume.root,
                channel_relative_path=channel.relative_path,
                title=channel.title,
                bytes=channel.bytes,
                file_count=channel.file_count,
                media_count=channel.media_count,
                sidecar_count=channel.sidecar_count,
                orphan_sidecar_count=channel.orphan_sidecar_count,
                video_folder_count=channel.video_folder_count,
                pressure_score=channel.pressure_score,
                scanned_at=scan.scanned_at,
                created_at=created_at,
            )
            for channel in scan.channels
        ]
    )
    await event_bus.publish(
        "storage.pressure.snapshot",
        {
            "snapshot_id": row.id,
            "archive_bytes": row.archive_bytes,
            "pressure_percent": row.pressure_percent,
            "file_count": row.file_count,
            "orphan_sidecar_count": row.orphan_sidecar_count,
            "unindexed_media_count": row.unindexed_media_count,
            "indexed_missing_count": row.indexed_missing_count,
        },
    )
    return _snapshot_read(row)


async def build_storage_pressure_trend(
    *,
    db: AsyncSession,
    limit: int = 24,
) -> StoragePressureTrendRead:
    """Return recent storage snapshots and derived growth/runway telemetry."""
    rows = (
        (
            await db.execute(
                select(StoragePressureSnapshot)
                .order_by(desc(StoragePressureSnapshot.scanned_at), desc(StoragePressureSnapshot.id))
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    snapshots = [_snapshot_read(row) for row in reversed(rows)]
    latest = snapshots[-1] if snapshots else None
    previous = snapshots[-2] if len(snapshots) >= 2 else None
    delta_archive_bytes = (latest.archive_bytes - previous.archive_bytes) if latest and previous else 0
    delta_pressure_percent = round((latest.pressure_percent - previous.pressure_percent), 2) if latest and previous else 0.0
    daily_growth_bytes = _daily_growth_bytes(snapshots)
    runway_days = _runway_days(latest=latest, daily_growth_bytes=daily_growth_bytes)
    warning = _trend_warning(latest=latest, daily_growth_bytes=daily_growth_bytes, runway_days=runway_days)
    return StoragePressureTrendRead(
        snapshots=snapshots,
        latest=latest,
        previous=previous,
        delta_archive_bytes=delta_archive_bytes,
        delta_archive_label=_signed_bytes(delta_archive_bytes),
        delta_pressure_percent=delta_pressure_percent,
        daily_growth_bytes=daily_growth_bytes,
        daily_growth_label=_format_bytes(int(daily_growth_bytes)),
        runway_days=runway_days,
        runway_label=_runway_label(runway_days),
        warning=warning,
    )


async def build_storage_channel_pressure_trend(
    *,
    db: AsyncSession,
    relative_path: str,
    limit: int = 24,
) -> StorageChannelPressureTrendRead:
    """Return recent per-channel storage footprint snapshots."""
    rows = (
        (
            await db.execute(
                select(StorageChannelPressureSnapshot)
                .where(StorageChannelPressureSnapshot.channel_relative_path == relative_path)
                .order_by(desc(StorageChannelPressureSnapshot.scanned_at), desc(StorageChannelPressureSnapshot.id))
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    snapshots = [_channel_snapshot_read(row) for row in reversed(rows)]
    latest = snapshots[-1] if snapshots else None
    previous = snapshots[-2] if len(snapshots) >= 2 else None
    delta_bytes = (latest.bytes - previous.bytes) if latest and previous else 0
    peak_bytes = max((snapshot.bytes for snapshot in snapshots), default=0)
    comparisons = [_channel_pressure_comparison(snapshots=snapshots, window_days=days) for days in (7, 30)]
    warning = next((comparison.warning for comparison in comparisons if comparison.warning), None)
    return StorageChannelPressureTrendRead(
        relative_path=relative_path,
        snapshots=snapshots,
        latest=latest,
        previous=previous,
        delta_bytes=delta_bytes,
        delta_label=_signed_bytes(delta_bytes),
        peak_bytes=peak_bytes,
        peak_label=_format_bytes(peak_bytes),
        comparisons=comparisons,
        warning=warning,
    )


def _snapshot_read(row: StoragePressureSnapshot) -> StoragePressureSnapshotRead:
    return StoragePressureSnapshotRead(
        id=row.id,
        root=row.root,
        archive_bytes=row.archive_bytes,
        archive_label=_format_bytes(row.archive_bytes),
        used_bytes=row.used_bytes,
        used_label=_format_bytes(row.used_bytes),
        free_bytes=row.free_bytes,
        free_label=_format_bytes(row.free_bytes),
        total_bytes=row.total_bytes,
        total_label=_format_bytes(row.total_bytes),
        pressure_percent=row.pressure_percent,
        file_count=row.file_count,
        dir_count=row.dir_count,
        channel_count=row.channel_count,
        orphan_sidecar_count=row.orphan_sidecar_count,
        unindexed_media_count=row.unindexed_media_count,
        indexed_missing_count=row.indexed_missing_count,
        scanned_at=row.scanned_at,
        created_at=row.created_at,
    )


def _channel_snapshot_read(row: StorageChannelPressureSnapshot) -> StorageChannelPressureSnapshotRead:
    return StorageChannelPressureSnapshotRead(
        id=row.id,
        snapshot_id=row.snapshot_id,
        root=row.root,
        channel_relative_path=row.channel_relative_path,
        title=row.title,
        bytes=row.bytes,
        label=_format_bytes(row.bytes),
        file_count=row.file_count,
        media_count=row.media_count,
        sidecar_count=row.sidecar_count,
        orphan_sidecar_count=row.orphan_sidecar_count,
        video_folder_count=row.video_folder_count,
        pressure_score=row.pressure_score,
        scanned_at=row.scanned_at,
        created_at=row.created_at,
    )


def _daily_growth_bytes(snapshots: list[StoragePressureSnapshotRead]) -> float:
    if len(snapshots) < 2:
        return 0.0
    first = snapshots[0]
    latest = snapshots[-1]
    elapsed_seconds = (_as_utc(latest.scanned_at) - _as_utc(first.scanned_at)).total_seconds()
    if elapsed_seconds <= 0:
        return 0.0
    growth = latest.archive_bytes - first.archive_bytes
    if growth <= 0:
        return 0.0
    return round(growth / (elapsed_seconds / 86_400), 2)


def _channel_pressure_comparison(
    *,
    snapshots: list[StorageChannelPressureSnapshotRead],
    window_days: int,
) -> StorageChannelPressureComparisonRead:
    latest = snapshots[-1] if snapshots else None
    if latest is None:
        return StorageChannelPressureComparisonRead(
            window_days=window_days,
            label=f"{window_days}d",
            snapshot_count=0,
        )

    latest_at = _as_utc(latest.scanned_at)
    cutoff = latest_at - timedelta(days=window_days)
    window_snapshots = [snapshot for snapshot in snapshots if _as_utc(snapshot.scanned_at) >= cutoff]
    baseline = window_snapshots[0] if len(window_snapshots) >= 2 else (snapshots[0] if len(snapshots) >= 2 else None)
    if baseline is None or baseline.id == latest.id:
        return StorageChannelPressureComparisonRead(
            window_days=window_days,
            label=f"{window_days}d",
            snapshot_count=len(window_snapshots),
            baseline=baseline,
        )

    delta_bytes = latest.bytes - baseline.bytes
    elapsed_seconds = max((latest_at - _as_utc(baseline.scanned_at)).total_seconds(), 0)
    daily_growth_bytes = round(delta_bytes / (elapsed_seconds / 86_400), 2) if delta_bytes > 0 and elapsed_seconds > 0 else 0.0
    growth_percent = _growth_percent(baseline.bytes, latest.bytes)
    return StorageChannelPressureComparisonRead(
        window_days=window_days,
        label=f"{window_days}d",
        snapshot_count=len(window_snapshots),
        baseline=baseline,
        delta_bytes=delta_bytes,
        delta_label=_signed_bytes(delta_bytes),
        daily_growth_bytes=daily_growth_bytes,
        daily_growth_label=_format_bytes(int(daily_growth_bytes)),
        growth_percent=growth_percent,
        warning=_channel_pressure_warning(
            baseline_bytes=baseline.bytes,
            delta_bytes=delta_bytes,
            growth_percent=growth_percent,
        ),
    )


def _growth_percent(previous_bytes: int, latest_bytes: int) -> float:
    if previous_bytes <= 0:
        return 100.0 if latest_bytes > 0 else 0.0
    return round(((latest_bytes - previous_bytes) / previous_bytes) * 100, 1)


def _channel_pressure_warning(
    *,
    baseline_bytes: int,
    delta_bytes: int,
    growth_percent: float,
) -> str | None:
    if delta_bytes <= 0:
        return None
    if baseline_bytes <= 0:
        return "new_growth"
    if growth_percent >= 50:
        return "rapid_growth"
    return "growing"


def _runway_days(*, latest: StoragePressureSnapshotRead | None, daily_growth_bytes: float) -> float | None:
    if latest is None or daily_growth_bytes <= 0:
        return None
    if latest.free_bytes <= 0:
        return 0.0
    return round(latest.free_bytes / daily_growth_bytes, 1)


def _runway_label(runway_days: float | None) -> str:
    if runway_days is None:
        return "stable"
    if runway_days >= 365:
        return f"{round(runway_days / 365, 1)} years"
    if runway_days >= 30:
        return f"{round(runway_days / 30, 1)} months"
    return f"{runway_days} days"


def _trend_warning(
    *,
    latest: StoragePressureSnapshotRead | None,
    daily_growth_bytes: float,
    runway_days: float | None,
) -> str | None:
    if latest is None:
        return "no snapshots yet"
    if latest.pressure_percent >= 90:
        return "volume pressure is critical"
    if runway_days is not None and runway_days <= 30:
        return "archive runway under 30 days"
    if daily_growth_bytes > 0:
        return "archive is growing"
    return None


def _signed_bytes(value: int) -> str:
    if value == 0:
        return "0 MB"
    sign = "+" if value > 0 else "-"
    return f"{sign}{_format_bytes(abs(value))}"


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _format_bytes(value: int) -> str:
    if value >= 1024**4:
        return f"{value / 1024**4:.1f} TB"
    if value >= 1024**3:
        return f"{value / 1024**3:.1f} GB"
    if value >= 1024**2:
        return f"{round(value / 1024**2)} MB"
    if value >= 1024:
        return f"{round(value / 1024)} KB"
    if value > 0:
        return f"{value} B"
    return "0 MB"
