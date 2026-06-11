"""Storage drift recovery actions for NAS operators."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import MediaFile, Video
from app.schemas.storage import StorageDriftActionResult
from app.services.archive_rescan import (
    INFO_JSON_NAME,
    MEDIA_EXTENSIONS,
    NFO_NAME,
    SUBTITLE_EXTENSIONS,
    THUMBNAIL_EXTENSIONS,
    apply_rescan_target,
    refresh_channel_counts,
)
from app.services.event_bus import event_bus


async def recover_unindexed_media(
    *,
    db: AsyncSession,
    download_dir: str | Path,
    relative_path: str,
    dry_run: bool = False,
) -> StorageDriftActionResult:
    """Index the folder containing one unindexed media file, if sidecars are present."""
    root = Path(download_dir).expanduser().resolve()
    media_path, warnings = _safe_relative_file(root=root, relative_path=relative_path)
    if media_path is None:
        return StorageDriftActionResult(
            action="recover_unindexed_media",
            relative_path=relative_path,
            applied=False,
            dry_run=dry_run,
            warnings=warnings,
        )

    target_dir = media_path.parent
    info_json = target_dir / "video.info.json"
    if not info_json.exists():
        return StorageDriftActionResult(
            action="recover_unindexed_media",
            relative_path=relative_path,
            applied=False,
            dry_run=dry_run,
            warnings=[f"target sidecar does not exist: {info_json.relative_to(root).as_posix()}"],
        )
    breakdown = _target_sidecar_breakdown(target_dir)
    if dry_run:
        return StorageDriftActionResult(
            action="recover_unindexed_media",
            relative_path=relative_path,
            applied=False,
            dry_run=True,
            **breakdown,
            warnings=[],
        )

    result = await apply_rescan_target(db, root, target_dir)
    applied = result.media_files_indexed > 0 or result.videos_created > 0 or result.channels_created > 0
    await event_bus.publish(
        "storage.drift.recovered",
        {
            "relative_path": relative_path,
            "media_files_indexed": result.media_files_indexed,
            "videos_created": result.videos_created,
            "warnings": result.warnings,
        },
    )
    return StorageDriftActionResult(
        action="recover_unindexed_media",
        relative_path=relative_path,
        applied=applied,
        dry_run=False,
        **breakdown,
        rescan=result,
        warnings=result.warnings,
    )


async def prune_missing_media_index(
    *,
    db: AsyncSession,
    download_dir: str | Path,
    relative_path: str,
    dry_run: bool = False,
) -> StorageDriftActionResult:
    """Remove stale MediaFile rows only when the indexed file is missing on disk."""
    root = Path(download_dir).expanduser().resolve()
    media_path, warnings = _safe_relative_file(root=root, relative_path=relative_path)
    if media_path is None:
        return StorageDriftActionResult(
            action="prune_missing_media_index",
            relative_path=relative_path,
            applied=False,
            dry_run=dry_run,
            warnings=warnings,
        )
    if media_path.exists():
        return StorageDriftActionResult(
            action="prune_missing_media_index",
            relative_path=relative_path,
            applied=False,
            dry_run=dry_run,
            warnings=["file exists on disk; stale index cleanup was skipped"],
        )

    rows = (
        await db.execute(
            select(MediaFile.id, Video.channel_id)
            .join(Video, MediaFile.video_id == Video.id)
            .where(MediaFile.relative_path == relative_path)
        )
    ).all()
    if not rows:
        return StorageDriftActionResult(
            action="prune_missing_media_index",
            relative_path=relative_path,
            applied=False,
            dry_run=dry_run,
            warnings=["no matching MediaFile row was found"],
        )
    if dry_run:
        return StorageDriftActionResult(
            action="prune_missing_media_index",
            relative_path=relative_path,
            applied=False,
            dry_run=True,
            deleted_media_files=len(rows),
            warnings=[],
        )

    media_ids = [row.id for row in rows]
    channel_ids = {row.channel_id for row in rows}
    await db.execute(delete(MediaFile).where(MediaFile.id.in_(media_ids)))
    await refresh_channel_counts(db, channel_ids=channel_ids)
    await event_bus.publish(
        "storage.drift.pruned",
        {
            "relative_path": relative_path,
            "deleted_media_files": len(media_ids),
            "channel_ids": sorted(channel_ids),
        },
    )
    return StorageDriftActionResult(
        action="prune_missing_media_index",
        relative_path=relative_path,
        applied=True,
        dry_run=False,
        deleted_media_files=len(media_ids),
        warnings=[],
    )


def _safe_relative_file(*, root: Path, relative_path: str) -> tuple[Path | None, list[str]]:
    raw_path = Path(relative_path)
    if raw_path.is_absolute():
        return None, ["absolute paths are not accepted"]
    candidate = (root / raw_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None, ["target is outside download root"]
    return candidate, []


def _target_sidecar_breakdown(target_dir: Path) -> dict[str, int]:
    counts = {
        "planned_media_files": 0,
        "planned_info_json": 0,
        "planned_subtitles": 0,
        "planned_thumbnails": 0,
        "planned_nfo": 0,
    }
    for child in target_dir.iterdir():
        if not child.is_file():
            continue
        suffix = child.suffix.lower()
        if suffix in MEDIA_EXTENSIONS:
            counts["planned_media_files"] += 1
        elif child.name == INFO_JSON_NAME:
            counts["planned_info_json"] += 1
        elif child.name == NFO_NAME:
            counts["planned_nfo"] += 1
        elif suffix in SUBTITLE_EXTENSIONS:
            counts["planned_subtitles"] += 1
        elif suffix in THUMBNAIL_EXTENSIONS and child.stem in {"thumbnail", "poster", "cover"}:
            counts["planned_thumbnails"] += 1
    return counts
