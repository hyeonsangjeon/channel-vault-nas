"""Build an operator-facing readiness summary from DB, queue, and NAS state."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import (
    Channel,
    ChannelPolicy,
    DownloadJob,
    MediaFile,
    StoragePressureSnapshot,
    Video,
)
from app.schemas.operations import OperationMetric, OperationMission, OperationsReadiness
from app.services.storage_scanner import build_storage_scan


async def build_operations_readiness(
    db: AsyncSession,
    *,
    download_dir: str | Path,
    worker_enabled: bool,
    download_scheduler_enabled: bool,
    metadata_scheduler_enabled: bool,
) -> OperationsReadiness:
    """Return the next best operational moves for the current archive state."""
    generated_at = datetime.now(UTC)
    indexed_paths = await _indexed_media_paths(db)
    scan = build_storage_scan(download_dir, indexed_media_paths=indexed_paths)

    channel_count = await _count(db, select(func.count(Channel.id)))
    source_count = await _count(db, select(func.count(Video.id)))
    archived_count = await _count(db, select(func.count(func.distinct(MediaFile.video_id))))
    missing_count = max(source_count - archived_count, 0)
    failed_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "failed"))
    candidate_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "candidate"))
    queued_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "queued"))
    running_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "running"))
    paused_channels = await _count(db, select(func.count(ChannelPolicy.id)).where(ChannelPolicy.worker_paused.is_(True)))
    latest_snapshot = await db.scalar(
        select(StoragePressureSnapshot).order_by(desc(StoragePressureSnapshot.scanned_at), desc(StoragePressureSnapshot.id)).limit(1)
    )

    drift_count = scan.drift.unindexed_media_count + scan.drift.indexed_missing_count
    orphan_count = len(scan.orphan_sidecars)
    pressure_percent = scan.volume.pressure_percent
    coverage_percent = round((archived_count / source_count) * 100, 1) if source_count else 0.0
    queue_ready_count = candidate_downloads + queued_downloads

    missions: list[OperationMission] = []
    score = 100

    if channel_count == 0:
        missions.append(
            OperationMission(
                id="register_first_channel",
                severity="critical",
                status="blocked",
                action_kind="register",
                count=0,
            )
        )
        score -= 34

    if drift_count:
        missions.append(
            OperationMission(
                id="recover_storage_drift",
                severity="warning",
                status="action",
                action_kind="storage",
                count=drift_count,
                primary_value=str(scan.drift.unindexed_media_count),
                secondary_value=str(scan.drift.indexed_missing_count),
            )
        )
        score -= min(22, 8 + drift_count * 4)

    if orphan_count:
        missions.append(
            OperationMission(
                id="quarantine_sidecars",
                severity="warning",
                status="action",
                action_kind="storage",
                count=orphan_count,
                primary_value=_format_bytes(sum(sidecar.size_bytes for sidecar in scan.orphan_sidecars)),
            )
        )
        score -= min(18, 6 + orphan_count * 2)

    if latest_snapshot is None:
        missions.append(
            OperationMission(
                id="capture_pressure_snapshot",
                severity="info",
                status="watch",
                action_kind="snapshot",
            )
        )
        score -= 8
    else:
        snapshot_age_hours = max(0.0, (generated_at - _as_utc(latest_snapshot.scanned_at)).total_seconds() / 3600)
        if snapshot_age_hours >= 24:
            missions.append(
                OperationMission(
                    id="refresh_pressure_snapshot",
                    severity="info",
                    status="watch",
                    action_kind="snapshot",
                    primary_value=f"{snapshot_age_hours:.0f}h",
                )
            )
            score -= 4

    if failed_downloads:
        missions.append(
            OperationMission(
                id="clear_failed_downloads",
                severity="critical",
                status="action",
                action_kind="downloads",
                count=failed_downloads,
            )
        )
        score -= min(22, 10 + failed_downloads * 5)

    if queue_ready_count and not worker_enabled:
        missions.append(
            OperationMission(
                id="arm_worker",
                severity="warning",
                status="blocked",
                action_kind="runtime",
                count=queue_ready_count,
                primary_value=str(queued_downloads),
                secondary_value=str(candidate_downloads),
            )
        )
        score -= 10

    if missing_count and queue_ready_count == 0 and channel_count:
        missions.append(
            OperationMission(
                id="queue_missing_videos",
                severity="info",
                status="action",
                action_kind="downloads",
                count=missing_count,
                primary_value=f"{coverage_percent}%",
            )
        )
        score -= 6

    if paused_channels:
        missions.append(
            OperationMission(
                id="resume_paused_channels",
                severity="info",
                status="watch",
                action_kind="runtime",
                count=paused_channels,
            )
        )
        score -= min(10, paused_channels * 3)

    if pressure_percent >= 90:
        missions.append(
            OperationMission(
                id="relieve_storage_pressure",
                severity="critical",
                status="action",
                action_kind="storage",
                primary_value=f"{pressure_percent}%",
            )
        )
        score -= 18
    elif pressure_percent >= 80:
        missions.append(
            OperationMission(
                id="watch_storage_pressure",
                severity="warning",
                status="watch",
                action_kind="storage",
                primary_value=f"{pressure_percent}%",
            )
        )
        score -= 8

    if not download_scheduler_enabled and worker_enabled:
        missions.append(
            OperationMission(
                id="enable_download_scheduler",
                severity="info",
                status="watch",
                action_kind="runtime",
            )
        )
        score -= 3

    if not metadata_scheduler_enabled and channel_count:
        missions.append(
            OperationMission(
                id="enable_metadata_scheduler",
                severity="info",
                status="watch",
                action_kind="runtime",
            )
        )
        score -= 3

    if scan.warnings:
        score -= min(8, len(scan.warnings) * 2)

    score = max(0, min(100, score))
    missions = missions[:6]
    if not missions:
        missions.append(
            OperationMission(
                id="all_clear",
                severity="good",
                status="done",
                action_kind="refresh",
                resolved=True,
                primary_value=f"{coverage_percent}%",
            )
        )

    return OperationsReadiness(
        generated_at=generated_at,
        score=score,
        stage=_stage(score=score, channel_count=channel_count),
        metrics=[
            OperationMetric(key="channels", value=str(channel_count), raw_value=channel_count, tone="good" if channel_count else "warning"),
            OperationMetric(key="coverage", value=f"{coverage_percent}%", raw_value=coverage_percent, tone="good" if missing_count == 0 and source_count else "info"),
            OperationMetric(key="queue", value=str(queue_ready_count), raw_value=queue_ready_count, tone="info" if queue_ready_count else "good"),
            OperationMetric(key="storage_pressure", value=f"{pressure_percent}%", raw_value=pressure_percent, tone=_pressure_tone(pressure_percent)),
            OperationMetric(key="drift", value=str(drift_count), raw_value=drift_count, tone="warning" if drift_count else "good"),
            OperationMetric(key="orphans", value=str(orphan_count), raw_value=orphan_count, tone="warning" if orphan_count else "good"),
            OperationMetric(key="running", value=str(running_downloads), raw_value=running_downloads, tone="info" if running_downloads else "good"),
        ],
        missions=missions,
        warnings=scan.warnings,
    )


async def _indexed_media_paths(db: AsyncSession) -> set[str]:
    rows = await db.execute(select(MediaFile.relative_path))
    return {path for path in rows.scalars().all() if path}


async def _count(db: AsyncSession, statement) -> int:
    value = await db.scalar(statement)
    return int(value or 0)


def _stage(*, score: int, channel_count: int) -> str:
    if channel_count == 0:
        return "setup"
    if score < 72:
        return "attention"
    if score < 92:
        return "ready"
    return "excellent"


def _pressure_tone(pressure_percent: float) -> str:
    if pressure_percent >= 90:
        return "critical"
    if pressure_percent >= 80:
        return "warning"
    return "good"


def _format_bytes(value: int) -> str:
    units = ("B", "KB", "MB", "GB", "TB")
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{int(value)} B"


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
