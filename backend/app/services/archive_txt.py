"""youtube-dl archive.txt preview support."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, DownloadJob, MediaFile, Video
from app.schemas.archive import (
    ArchiveTxtPreviewItem,
    ArchiveTxtPreviewResult,
    ArchiveTxtStageResult,
)
from app.services.archive_coverage import archived_video_ids_on_disk, resolve_archive_root
from app.services.archive_metrics import build_channel_coverage_from_db
from app.services.event_bus import event_bus
from app.services.library_index import media_path_on_disk

YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
WATCH_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})")
ACTIVE_DOWNLOAD_STATUSES = ("candidate", "queued", "running")
ARCHIVE_TXT_PLACEHOLDER_PREFIX = "archive.txt import "
ARCHIVE_TXT_PLACEHOLDER_DESCRIPTION = "Placeholder staged from archive.txt; run metadata sync to enrich this row."


async def preview_archive_txt(
    db: AsyncSession,
    *,
    content: str,
    channel_id: int | None = None,
    download_dir: str | Path | None = None,
) -> ArchiveTxtPreviewResult:
    """Parse archive.txt lines and compare them with local DB/media coverage.

    Classification is disk-aware: with a configured ``download_dir`` a video is
    only ``archived`` when an indexed media file actually exists on disk under
    the archive root. A stale ``MediaFile`` DB row whose file is gone is reported
    as ``known_missing`` (and therefore stageable), matching Library/Coverage.
    With no archive root configured the index is trusted, preserving prior
    behavior.
    """
    raw_lines = content.splitlines()
    parsed_ids: list[str] = []
    parsed_by_line: list[tuple[int, str, str | None]] = []
    for index, raw in enumerate(raw_lines, start=1):
        video_id = _extract_video_id(raw)
        parsed_by_line.append((index, raw, video_id))
        if video_id:
            parsed_ids.append(video_id)

    root = resolve_archive_root(download_dir)
    video_map = await _video_state_map(db, parsed_ids, channel_id=channel_id, root=root)
    seen: set[str] = set()
    items: list[ArchiveTxtPreviewItem] = []
    counts = {
        "archived": 0,
        "known_missing": 0,
        "unknown": 0,
        "duplicate": 0,
        "invalid": 0,
    }

    for line_number, raw, video_id in parsed_by_line:
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not video_id:
            counts["invalid"] += 1
            items.append(
                ArchiveTxtPreviewItem(
                    line_number=line_number,
                    raw=raw,
                    video_external_id=None,
                    state="invalid",
                    reason="line does not contain a YouTube video id",
                )
            )
            continue
        if video_id in seen:
            counts["duplicate"] += 1
            items.append(
                ArchiveTxtPreviewItem(
                    line_number=line_number,
                    raw=raw,
                    video_external_id=video_id,
                    state="duplicate",
                    reason="video id already appeared earlier in this archive.txt",
                )
            )
            continue
        seen.add(video_id)
        state = video_map.get(video_id)
        if state is None:
            counts["unknown"] += 1
            items.append(
                ArchiveTxtPreviewItem(
                    line_number=line_number,
                    raw=raw,
                    video_external_id=video_id,
                    state="unknown",
                    reason="not found in the Channel Vault metadata index yet",
                )
            )
            continue
        status = "archived" if state["archived"] else "known_missing"
        counts[status] += 1
        items.append(
            ArchiveTxtPreviewItem(
                line_number=line_number,
                raw=raw,
                video_external_id=video_id,
                state=status,
                title=state["title"],
                channel_title=state["channel_title"],
                reason="media file exists on disk under the archive root"
                if status == "archived"
                else "metadata exists, but no media file is present on disk",
            )
        )

    return ArchiveTxtPreviewResult(
        total_lines=len(raw_lines),
        parsed_count=len(seen),
        archived_count=counts["archived"],
        known_missing_count=counts["known_missing"],
        unknown_count=counts["unknown"],
        duplicate_count=counts["duplicate"],
        invalid_count=counts["invalid"],
        items=items[:200],
    )


async def stage_archive_txt(
    db: AsyncSession,
    *,
    content: str,
    channel_id: int,
    quality: str,
    limit: int = 50,
    create_candidates: bool = True,
    download_dir: str | Path | None = None,
) -> ArchiveTxtStageResult | None:
    """Create placeholder videos and candidate rows from archive.txt preview rows.

    Staging is disk-aware: stale ``MediaFile`` rows whose files are gone count as
    ``known_missing`` and are staged as candidates, and the refreshed channel
    counts trust files on disk so coverage agrees with Library/Coverage.
    """
    channel = await db.get(Channel, channel_id)
    if channel is None:
        return None

    root = resolve_archive_root(download_dir)
    initial_preview = await preview_archive_txt(db, content=content, channel_id=channel_id, download_dir=download_dir)
    unknown_ids = _unique_actionable_ids(initial_preview, state="unknown")[:limit]
    known_missing_ids = _unique_actionable_ids(initial_preview, state="known_missing")
    now = datetime.now(UTC)
    created_videos: list[Video] = []

    for video_external_id in unknown_ids:
        video = Video(
            channel_id=channel.id,
            external_id=video_external_id,
            title=f"{ARCHIVE_TXT_PLACEHOLDER_PREFIX}{video_external_id}",
            description=ARCHIVE_TXT_PLACEHOLDER_DESCRIPTION,
            published_at=None,
            upload_date=None,
            duration_seconds=None,
            thumbnail_url=None,
            view_count=None,
            source_state="available",
            last_seen_in_source_at=now,
            tags=[],
            categories=[],
            chapters=None,
            is_short=False,
            is_live=False,
            was_livestream=False,
            info_json_path=None,
            discovered_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(video)
        created_videos.append(video)

    if created_videos:
        await db.flush()

    candidate_ids = [*known_missing_ids, *(video.external_id for video in created_videos)]
    jobs: list[DownloadJob] = []
    if create_candidates and candidate_ids:
        jobs = await _create_candidates_for_external_ids(
            db=db,
            channel_id=channel.id,
            external_ids=candidate_ids[:limit],
            quality=quality,
            now=now,
            root=root,
        )

    await _refresh_channel_counts(db, channel, download_dir=download_dir)
    if created_videos or jobs:
        await event_bus.publish(
            "archive_txt.staged",
            {
                "channel_id": channel.id,
                "channel_title": channel.title,
                "videos_created": len(created_videos),
                "candidates_created": len(jobs),
                "quality": quality,
            },
        )
    if jobs:
        await event_bus.publish(
            "download.candidates",
            {
                "channel_id": channel.id,
                "channel_title": channel.title,
                "count": len(jobs),
                "quality": quality,
            },
        )

    updated_preview = await preview_archive_txt(db, content=content, channel_id=channel_id, download_dir=download_dir)
    skipped_count = initial_preview.archived_count + initial_preview.duplicate_count + initial_preview.invalid_count
    warnings: list[str] = []
    if not unknown_ids and not known_missing_ids:
        warnings.append("archive.txt contains no stageable rows for this channel")
    if len(_unique_actionable_ids(initial_preview, state="unknown")) > len(unknown_ids):
        warnings.append("stage limit reached before all unknown rows were converted")
    return ArchiveTxtStageResult(
        channel_id=channel.id,
        videos_created=len(created_videos),
        candidates_created=len(jobs),
        skipped_count=skipped_count,
        video_ids=[video.id for video in created_videos],
        job_ids=[job.id for job in jobs],
        preview=updated_preview,
        warnings=warnings,
    )


async def _video_state_map(
    db: AsyncSession,
    video_ids: list[str],
    *,
    channel_id: int | None,
    root: Path | None,
) -> dict[str, dict[str, object]]:
    if not video_ids:
        return {}
    statement = (
        select(Video.external_id, Video.title, Channel.title, MediaFile.relative_path)
        .join(Channel, Video.channel_id == Channel.id)
        .outerjoin(MediaFile, MediaFile.video_id == Video.id)
        .where(Video.external_id.in_(set(video_ids)))
    )
    if channel_id is not None:
        statement = statement.where(Video.channel_id == channel_id)
    rows = await db.execute(statement)
    result: dict[str, dict[str, object]] = {}
    for external_id, video_title, channel_title, relative_path in rows.all():
        entry = result.setdefault(
            external_id,
            {
                "title": video_title,
                "channel_title": channel_title,
                "archived": False,
            },
        )
        if not entry["archived"] and media_path_on_disk(root=root, relative_path=relative_path):
            entry["archived"] = True
    return result


def _extract_video_id(raw: str) -> str | None:
    line = raw.strip()
    if not line or line.startswith("#"):
        return None
    url_match = WATCH_RE.search(line)
    if url_match:
        return url_match.group(1)
    for token in reversed(line.split()):
        cleaned = token.strip("\"'`,")
        if YOUTUBE_ID_RE.match(cleaned):
            return cleaned
    return None


def _unique_actionable_ids(preview: ArchiveTxtPreviewResult, *, state: str) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for item in preview.items:
        if item.state != state or item.video_external_id is None:
            continue
        if item.video_external_id in seen:
            continue
        seen.add(item.video_external_id)
        ids.append(item.video_external_id)
    return ids


async def _create_candidates_for_external_ids(
    *,
    db: AsyncSession,
    channel_id: int,
    external_ids: list[str],
    quality: str,
    now: datetime,
    root: Path | None,
) -> list[DownloadJob]:
    archived_ids = await archived_video_ids_on_disk(db=db, root=root, channel_id=channel_id)
    job_exists = (
        select(DownloadJob.id)
        .where(
            DownloadJob.video_id == Video.id,
            DownloadJob.status.in_(ACTIVE_DOWNLOAD_STATUSES),
        )
        .exists()
    )
    rows = (
        await db.execute(
            select(Video)
            .where(Video.channel_id == channel_id)
            .where(Video.external_id.in_(set(external_ids)))
            .where(~job_exists)
            .order_by(Video.discovered_at.desc())
        )
    ).scalars()
    jobs: list[DownloadJob] = []
    for video in rows:
        if video.id in archived_ids:
            continue
        job = DownloadJob(
            video_id=video.id,
            status="candidate",
            progress=0,
            quality=quality,
            priority=55,
            preflight_status="unchecked",
            estimated_bytes=_estimate_job_bytes(quality),
            created_at=now,
            updated_at=now,
        )
        db.add(job)
        jobs.append(job)
    if jobs:
        await db.flush()
    return jobs


async def _refresh_channel_counts(
    db: AsyncSession,
    channel: Channel,
    *,
    download_dir: str | Path | None = None,
) -> None:
    coverage = await build_channel_coverage_from_db(db, channel.id, download_dir=download_dir)
    if coverage is None:
        return
    channel.source_video_count = coverage.source
    channel.archived_count = coverage.archived
    channel.missing_count = coverage.missing
    channel.removed_saved_count = coverage.removed_saved
    channel.source_counts_updated_at = datetime.now(UTC)
    channel.updated_at = datetime.now(UTC)


def _estimate_job_bytes(quality: str) -> int:
    if quality == "best":
        return 1_200_000_000
    if quality == "720p":
        return 420_000_000
    if quality == "audio":
        return 80_000_000
    return 750_000_000
