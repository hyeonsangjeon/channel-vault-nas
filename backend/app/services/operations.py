"""Build an operator-facing readiness summary from DB, queue, and NAS state."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import (
    ArchiveEventLog,
    Channel,
    ChannelPolicy,
    DownloadJob,
    MediaFile,
    StorageChannelPressureSnapshot,
    StoragePressureSnapshot,
    Video,
)
from app.schemas.operations import OperationMetric, OperationMission, OperationsReadiness
from app.services.archive_coverage import archived_video_ids_on_disk, resolve_archive_root
from app.services.storage_scanner import build_storage_scan


async def build_operations_readiness(
    db: AsyncSession,
    *,
    download_dir: str | Path,
    worker_enabled: bool,
    download_scheduler_enabled: bool,
    metadata_scheduler_enabled: bool,
    auth_enabled: bool,
    app_host: str,
) -> OperationsReadiness:
    """Return the next best operational moves for the current archive state."""
    generated_at = datetime.now(UTC)
    indexed_paths = await _indexed_media_paths(db)
    scan = build_storage_scan(download_dir, indexed_media_paths=indexed_paths)

    root = resolve_archive_root(download_dir)
    channel_count = await _count(db, select(func.count(Channel.id)))
    source_count = await _count(db, select(func.count(Video.id)))
    archived_count = len(await archived_video_ids_on_disk(db=db, root=root))
    missing_count = max(source_count - archived_count, 0)
    failed_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "failed"))
    candidate_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "candidate"))
    queued_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "queued"))
    running_downloads = await _count(db, select(func.count(DownloadJob.id)).where(DownloadJob.status == "running"))
    paused_channels = await _count(db, select(func.count(ChannelPolicy.id)).where(ChannelPolicy.worker_paused.is_(True)))
    latest_snapshot = await db.scalar(
        select(StoragePressureSnapshot).order_by(desc(StoragePressureSnapshot.scanned_at), desc(StoragePressureSnapshot.id)).limit(1)
    )
    channel_snapshot_rows = (
        (
            await db.execute(
                select(StorageChannelPressureSnapshot)
                .order_by(desc(StorageChannelPressureSnapshot.scanned_at), desc(StorageChannelPressureSnapshot.id))
                .limit(500)
            )
        )
        .scalars()
        .all()
    )
    channel_identity_rows = (await db.execute(select(Channel.id, Channel.title, Channel.handle, Channel.external_id))).all()
    growth_target = _channel_growth_target(channel_snapshot_rows, channel_identity_rows)
    latest_restart_event = await db.scalar(
        select(ArchiveEventLog)
        .where(ArchiveEventLog.type.like("runtime.restart.%"))
        .order_by(desc(ArchiveEventLog.occurred_at), desc(ArchiveEventLog.id))
        .limit(1)
    )
    failed_job_target = (
        await db.execute(
            select(DownloadJob.id, Video.channel_id)
            .join(Video, DownloadJob.video_id == Video.id)
            .where(DownloadJob.status == "failed")
            .order_by(desc(DownloadJob.updated_at), desc(DownloadJob.id))
            .limit(1)
        )
    ).first()
    paused_channel_target = await db.scalar(
        select(ChannelPolicy.channel_id).where(ChannelPolicy.worker_paused.is_(True)).order_by(ChannelPolicy.channel_id).limit(1)
    )
    missing_channel_target = await db.scalar(
        select(Channel.id).where(Channel.missing_count > 0).order_by(desc(Channel.missing_count), Channel.id).limit(1)
    )

    drift_count = scan.drift.unindexed_media_count + scan.drift.indexed_missing_count
    drift_target = next(iter([*scan.drift.unindexed_media, *scan.drift.indexed_missing]), None)
    orphan_count = len(scan.orphan_sidecars)
    pressure_percent = scan.volume.pressure_percent
    coverage_percent = round((archived_count / source_count) * 100, 1) if source_count else 0.0
    queue_ready_count = candidate_downloads + queued_downloads
    network_bound = _host_exposes_network(app_host)
    security_tone = "good" if auth_enabled else "critical" if network_bound else "warning"

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

    if not auth_enabled:
        missions.append(
            OperationMission(
                id="enable_access_token",
                severity="critical" if network_bound else "warning",
                status="blocked" if network_bound else "watch",
                action_kind="security",
                count=1 if network_bound else 0,
                primary_value=app_host or "localhost",
                secondary_value="CVN_AUTH_TOKEN",
            )
        )
        score -= 18 if network_bound else 8

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
                target_kind=drift_target.kind if drift_target else "",
                target_path=drift_target.relative_path if drift_target else "",
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
                target_kind="download_job" if failed_job_target else "",
                target_id=str(failed_job_target[0]) if failed_job_target else "",
                target_channel_id=failed_job_target[1] if failed_job_target else None,
            )
        )
        score -= min(22, 10 + failed_downloads * 5)

    if latest_restart_event and latest_restart_event.type in {"runtime.restart.failed", "runtime.restart.manual_required"}:
        restart_data = latest_restart_event.data or {}
        missions.append(
            OperationMission(
                id="resolve_runtime_restart",
                severity="critical" if latest_restart_event.type == "runtime.restart.failed" else "warning",
                status="action" if latest_restart_event.type == "runtime.restart.failed" else "blocked",
                action_kind="runtime",
                count=1,
                primary_value=str(restart_data.get("adapter") or "restart"),
                secondary_value=str(restart_data.get("message") or restart_data.get("reason") or latest_restart_event.type),
                target_kind=latest_restart_event.type,
                target_id=str(latest_restart_event.id),
            )
        )
        score -= 12 if latest_restart_event.type == "runtime.restart.failed" else 7

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
                target_kind="channel" if missing_channel_target else "",
                target_channel_id=missing_channel_target,
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
                target_kind="channel_policy" if paused_channel_target else "",
                target_channel_id=paused_channel_target,
            )
        )
        score -= min(10, paused_channels * 3)

    if growth_target:
        missions.append(
            OperationMission(
                id="review_channel_growth",
                severity="warning",
                status="watch",
                action_kind="storage",
                count=int(growth_target["window_days"]),
                primary_value=str(growth_target["delta_label"]),
                secondary_value=f"{growth_target['growth_percent']}%",
                target_kind="channel_storage_growth",
                target_channel_id=growth_target["channel_id"],
                target_path=str(growth_target["relative_path"]),
            )
        )
        score -= 7

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

    warnings = list(scan.warnings)
    if not auth_enabled:
        warnings.append("auth_token_disabled")
    if warnings:
        score -= min(8, len(warnings) * 2)

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
            OperationMetric(key="security", value="guarded" if auth_enabled else "open", raw_value=1 if auth_enabled else 0, tone=security_tone),
            OperationMetric(key="queue", value=str(queue_ready_count), raw_value=queue_ready_count, tone="info" if queue_ready_count else "good"),
            OperationMetric(key="storage_pressure", value=f"{pressure_percent}%", raw_value=pressure_percent, tone=_pressure_tone(pressure_percent)),
            OperationMetric(key="drift", value=str(drift_count), raw_value=drift_count, tone="warning" if drift_count else "good"),
            OperationMetric(key="orphans", value=str(orphan_count), raw_value=orphan_count, tone="warning" if orphan_count else "good"),
            OperationMetric(key="running", value=str(running_downloads), raw_value=running_downloads, tone="info" if running_downloads else "good"),
        ],
        missions=missions,
        warnings=warnings,
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


def _host_exposes_network(host: str) -> bool:
    normalized = host.strip().lower()
    if not normalized:
        return False
    if normalized in {"0.0.0.0", "::", "[::]", "*"}:
        return True
    if normalized == "localhost" or normalized.startswith("127.") or normalized == "::1":
        return False
    return True


def _channel_growth_target(
    rows: list[StorageChannelPressureSnapshot],
    channel_identity_rows,
) -> dict[str, object] | None:
    grouped: dict[str, list[StorageChannelPressureSnapshot]] = {}
    for row in rows:
        grouped.setdefault(row.channel_relative_path, []).append(row)

    best: dict[str, object] | None = None
    for relative_path, group in grouped.items():
        snapshots = sorted(group, key=lambda item: (_as_utc(item.scanned_at), item.id))
        if len(snapshots) < 2:
            continue
        for window_days in (7, 30):
            comparison = _channel_growth_comparison(snapshots=snapshots, window_days=window_days)
            if comparison is None or comparison["warning"] not in {"new_growth", "rapid_growth"}:
                continue
            latest = snapshots[-1]
            candidate = {
                **comparison,
                "relative_path": relative_path,
                "channel_id": _match_channel_id(
                    channel_identity_rows,
                    relative_path=relative_path,
                    title=latest.title,
                ),
            }
            if best is None or float(candidate["growth_percent"]) > float(best["growth_percent"]):
                best = candidate
    return best


def _channel_growth_comparison(
    *,
    snapshots: list[StorageChannelPressureSnapshot],
    window_days: int,
) -> dict[str, object] | None:
    latest = snapshots[-1]
    latest_at = _as_utc(latest.scanned_at)
    cutoff = latest_at - timedelta(days=window_days)
    window_snapshots = [snapshot for snapshot in snapshots if _as_utc(snapshot.scanned_at) >= cutoff]
    baseline = window_snapshots[0] if len(window_snapshots) >= 2 else snapshots[0]
    if baseline.id == latest.id:
        return None
    delta_bytes = latest.bytes - baseline.bytes
    if delta_bytes <= 0:
        return None
    growth_percent = _growth_percent(baseline.bytes, latest.bytes)
    warning = "new_growth" if baseline.bytes <= 0 else "rapid_growth" if growth_percent >= 50 else "growing"
    return {
        "window_days": window_days,
        "delta_bytes": delta_bytes,
        "delta_label": _signed_bytes(delta_bytes),
        "growth_percent": growth_percent,
        "warning": warning,
    }


def _match_channel_id(
    channel_identity_rows,
    *,
    relative_path: str,
    title: str,
) -> int | None:
    haystack = f"{relative_path} {title}".lower()
    title_needle = title.lower()
    for channel_id, channel_title, handle, external_id in channel_identity_rows:
        if channel_title and channel_title.lower() == title_needle:
            return channel_id
        if handle and handle.lower() in haystack:
            return channel_id
        if external_id and external_id.lower() in haystack:
            return channel_id
    return None


def _growth_percent(previous_bytes: int, latest_bytes: int) -> float:
    if previous_bytes <= 0:
        return 100.0 if latest_bytes > 0 else 0.0
    return round(((latest_bytes - previous_bytes) / previous_bytes) * 100, 1)


def _signed_bytes(value: int) -> str:
    if value == 0:
        return "0 B"
    sign = "+" if value > 0 else "-"
    return f"{sign}{_format_bytes(abs(value))}"


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
