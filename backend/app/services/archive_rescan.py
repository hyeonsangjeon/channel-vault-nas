"""Rebuild-oriented archive sidecar discovery."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, MediaFile, Video
from app.schemas.library import RescanApplyResult, RescanCandidate, RescanPlan
from app.services.event_bus import event_bus
from app.services.media_probe import MediaProbe, probe_media_file

INFO_JSON_NAME = "video.info.json"
NFO_NAME = "video.nfo"
MEDIA_EXTENSIONS = {".mp4", ".mkv", ".webm", ".mov", ".m4v", ".m4a", ".mp3", ".opus"}
THUMBNAIL_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".ass", ".ssa", ".json3", ".srv1", ".srv2", ".srv3", ".ttml"}


def build_rescan_plan(download_dir: str | Path) -> RescanPlan:
    """Find sidecar-backed videos that can be indexed into a fresh DB."""
    root = Path(download_dir)
    warnings: list[str] = []
    if not root.exists():
        return RescanPlan(root=str(root), candidates=[], candidate_count=0, warnings=["download root does not exist"])

    candidates: list[RescanCandidate] = []
    for info_json in sorted(root.rglob(INFO_JSON_NAME)):
        candidate = _candidate_from_info_json(root=root, info_json=info_json, warnings=warnings)
        if candidate is not None:
            candidates.append(candidate)

    return RescanPlan(
        root=str(root),
        candidates=candidates,
        candidate_count=len(candidates),
        warnings=warnings,
    )


async def apply_rescan_plan(db: AsyncSession, download_dir: str | Path) -> RescanApplyResult:
    """Index sidecar-backed archive folders into SQLite without moving files."""
    plan = build_rescan_plan(download_dir)
    root = Path(download_dir)
    result, _channel_ids = await _apply_rescan_candidates(
        db=db,
        root=root,
        candidates=plan.candidates,
        warnings=plan.warnings,
    )
    await _refresh_channel_counts(db)
    await _publish_apply_result(result, targeted=False)
    return result


async def apply_rescan_target(
    db: AsyncSession,
    download_dir: str | Path,
    target_path: str | Path,
) -> RescanApplyResult:
    """Index one sidecar-backed video folder into SQLite without a whole-root scan."""
    root = Path(download_dir).resolve()
    warnings: list[str] = []
    if not root.exists():
        result = _empty_apply_result(root=root, warnings=["download root does not exist"])
        await _publish_apply_result(result, targeted=True)
        return result

    target = Path(target_path)
    if not target.is_absolute():
        target = root / target
    target = target.resolve()
    try:
        target.relative_to(root)
    except ValueError:
        result = _empty_apply_result(root=root, warnings=[f"target is outside download root: {target}"])
        await _publish_apply_result(result, targeted=True)
        return result

    info_json = target if target.name == INFO_JSON_NAME else target / INFO_JSON_NAME
    if not info_json.exists():
        result = _empty_apply_result(
            root=root,
            warnings=[f"target sidecar does not exist: {_relative(info_json, root)}"],
        )
        await _publish_apply_result(result, targeted=True)
        return result

    candidate = _candidate_from_info_json(root=root, info_json=info_json, warnings=warnings)
    candidates = [candidate] if candidate is not None else []
    result, channel_ids = await _apply_rescan_candidates(
        db=db,
        root=root,
        candidates=candidates,
        warnings=warnings,
    )
    await _refresh_channel_counts(db, channel_ids=channel_ids)
    await _publish_apply_result(result, targeted=True)
    return result


async def _apply_rescan_candidates(
    *,
    db: AsyncSession,
    root: Path,
    candidates: list[RescanCandidate],
    warnings: list[str],
) -> tuple[RescanApplyResult, set[int]]:
    channels_created = 0
    videos_created = 0
    media_files_indexed = 0
    thumbnails_indexed = 0
    subtitles_indexed = 0
    channel_ids: set[int] = set()

    for candidate in candidates:
        channel, created_channel = await _upsert_channel_from_candidate(db, candidate)
        channels_created += int(created_channel)
        channel_ids.add(channel.id)
        video, created_video = await _upsert_video_from_candidate(db, channel, candidate)
        videos_created += int(created_video)

        for media_path in candidate.media_files:
            if await _ensure_media_file(db=db, root=root, video=video, relative_path=media_path):
                media_files_indexed += 1

        if candidate.thumbnails or candidate.nfo or candidate.subtitles:
            media = await _primary_media_file(db, video.id)
            if media is not None:
                if candidate.thumbnails and media.thumbnail_path != candidate.thumbnails[0]:
                    media.thumbnail_path = candidate.thumbnails[0]
                    thumbnails_indexed += 1
                if candidate.nfo and media.nfo_path != candidate.nfo:
                    media.nfo_path = candidate.nfo
                if candidate.subtitles:
                    subtitles_indexed += len(candidate.subtitles)

    return (
        RescanApplyResult(
            root=str(root),
            candidates_seen=len(candidates),
            channels_created=channels_created,
            videos_created=videos_created,
            media_files_indexed=media_files_indexed,
            thumbnails_indexed=thumbnails_indexed,
            subtitles_indexed=subtitles_indexed,
            warnings=warnings,
        ),
        channel_ids,
    )


def _empty_apply_result(*, root: Path, warnings: list[str]) -> RescanApplyResult:
    return RescanApplyResult(
        root=str(root),
        candidates_seen=0,
        channels_created=0,
        videos_created=0,
        media_files_indexed=0,
        thumbnails_indexed=0,
        subtitles_indexed=0,
        warnings=warnings,
    )


async def _publish_apply_result(result: RescanApplyResult, *, targeted: bool) -> None:
    await event_bus.publish(
        "library.rescan.applied",
        {
            "candidates_seen": result.candidates_seen,
            "channels_created": result.channels_created,
            "videos_created": result.videos_created,
            "media_files_indexed": result.media_files_indexed,
            "targeted": targeted,
        },
    )


def _candidate_from_info_json(root: Path, info_json: Path, warnings: list[str]) -> RescanCandidate | None:
    video_dir = info_json.parent
    try:
        payload = json.loads(info_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        warnings.append(f"invalid JSON sidecar: {_relative(info_json, root)}")
        return None
    except OSError as exc:
        warnings.append(f"cannot read sidecar {_relative(info_json, root)}: {exc}")
        return None

    media_files: list[str] = []
    thumbnails: list[str] = []
    subtitles: list[str] = []
    for child in sorted(video_dir.iterdir()):
        if child == info_json or not child.is_file():
            continue
        suffix = child.suffix.lower()
        relative = _relative(child, root)
        if suffix in MEDIA_EXTENSIONS:
            media_files.append(relative)
        elif suffix in SUBTITLE_EXTENSIONS:
            subtitles.append(relative)
        elif suffix in THUMBNAIL_EXTENSIONS and child.stem in {"thumbnail", "poster", "cover"}:
            thumbnails.append(relative)

    nfo_path = video_dir / NFO_NAME
    return RescanCandidate(
        relative_dir=_relative(video_dir, root),
        video_id=_string_or_none(payload.get("id")),
        title=_string_or_none(payload.get("title")),
        channel_id=_string_or_none(payload.get("channel_id")),
        channel=_string_or_none(payload.get("channel") or payload.get("uploader")),
        upload_date=_string_or_none(payload.get("upload_date")),
        info_json=_relative(info_json, root),
        media_files=media_files,
        thumbnails=thumbnails,
        subtitles=subtitles,
        nfo=_relative(nfo_path, root) if nfo_path.exists() else None,
    )


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


async def _upsert_channel_from_candidate(db: AsyncSession, candidate: RescanCandidate) -> tuple[Channel, bool]:
    channel = None
    if candidate.channel_id:
        channel = await db.scalar(select(Channel).where(Channel.external_id == candidate.channel_id).limit(1))
    if channel is None and candidate.channel:
        channel = await db.scalar(select(Channel).where(Channel.title == candidate.channel).limit(1))
    if channel is not None:
        channel.title = candidate.channel or channel.title
        channel.external_id = candidate.channel_id or channel.external_id
        channel.source_counts_updated_at = datetime.now(UTC)
        return channel, False

    now = datetime.now(UTC)
    source_url = (
        f"https://www.youtube.com/channel/{candidate.channel_id}"
        if candidate.channel_id
        else f"rescan://{candidate.channel or 'unknown-channel'}"
    )
    channel = Channel(
        source_type="channel",
        source_url=source_url,
        external_id=candidate.channel_id,
        handle=None,
        title=candidate.channel or "Recovered Channel",
        description=None,
        thumbnail_url=None,
        status="active",
        last_synced_at=now,
        source_counts_updated_at=now,
        source_video_count=0,
        archived_count=0,
        missing_count=0,
        removed_saved_count=0,
    )
    db.add(channel)
    await db.flush()
    return channel, True


async def _upsert_video_from_candidate(
    db: AsyncSession,
    channel: Channel,
    candidate: RescanCandidate,
) -> tuple[Video, bool]:
    external_id = candidate.video_id or candidate.relative_dir.rsplit("/", 1)[-1]
    video = await db.scalar(
        select(Video).where(Video.channel_id == channel.id).where(Video.external_id == external_id).limit(1)
    )
    upload_date = _date_from_yyyymmdd(candidate.upload_date)
    published_at = _published_from_upload_date(upload_date)
    if video is not None:
        video.title = candidate.title or video.title
        video.upload_date = upload_date or video.upload_date
        video.published_at = published_at or video.published_at
        video.info_json_path = candidate.info_json
        return video, False

    video = Video(
        channel_id=channel.id,
        external_id=external_id,
        title=candidate.title or external_id,
        description=None,
        published_at=published_at,
        upload_date=upload_date,
        duration_seconds=None,
        thumbnail_url=None,
        view_count=None,
        source_state="available",
        last_seen_in_source_at=datetime.now(UTC),
        tags=None,
        categories=None,
        chapters=None,
        is_short=False,
        is_live=False,
        was_livestream=False,
        info_json_path=candidate.info_json,
    )
    db.add(video)
    await db.flush()
    return video, True


async def _ensure_media_file(*, db: AsyncSession, root: Path, video: Video, relative_path: str) -> bool:
    existing = await db.scalar(
        select(MediaFile).where(MediaFile.video_id == video.id).where(MediaFile.relative_path == relative_path).limit(1)
    )
    absolute_path = root / relative_path
    if existing is not None:
        existing.filename = absolute_path.name
        existing.size_bytes = absolute_path.stat().st_size if absolute_path.exists() else existing.size_bytes
        existing.container = absolute_path.suffix.lstrip(".") or existing.container
        existing.info_json_path = video.info_json_path
        await _probe_into_media(media=existing, video=video, absolute_path=absolute_path)
        return False

    media = MediaFile(
        video_id=video.id,
        relative_path=relative_path,
        filename=absolute_path.name,
        size_bytes=absolute_path.stat().st_size if absolute_path.exists() else None,
        container=absolute_path.suffix.lstrip(".") or None,
        video_codec=None,
        audio_codec=None,
        fps=None,
        width=None,
        height=None,
        duration_seconds=None,
        info_json_path=video.info_json_path,
        nfo_path=None,
        thumbnail_path=None,
        checksum=None,
    )
    await _probe_into_media(media=media, video=video, absolute_path=absolute_path)
    db.add(media)
    return True


async def _probe_into_media(*, media: MediaFile, video: Video, absolute_path: Path) -> None:
    probe = await probe_media_file(absolute_path)
    if probe is None:
        return
    _apply_media_probe(media=media, video=video, probe=probe)


def _apply_media_probe(*, media: MediaFile, video: Video, probe: MediaProbe) -> None:
    media.container = media.container or probe.container
    media.video_codec = probe.video_codec or media.video_codec
    media.audio_codec = probe.audio_codec or media.audio_codec
    media.fps = probe.fps or media.fps
    media.width = probe.width or media.width
    media.height = probe.height or media.height
    media.duration_seconds = probe.duration_seconds or media.duration_seconds
    if probe.duration_seconds and not video.duration_seconds:
        video.duration_seconds = probe.duration_seconds


async def _primary_media_file(db: AsyncSession, video_id: int) -> MediaFile | None:
    return await db.scalar(select(MediaFile).where(MediaFile.video_id == video_id).order_by(MediaFile.created_at.desc()).limit(1))


async def _refresh_channel_counts(db: AsyncSession, *, channel_ids: set[int] | None = None) -> None:
    query = select(Channel)
    if channel_ids is not None:
        if not channel_ids:
            return
        query = query.where(Channel.id.in_(channel_ids))
    result = await db.execute(query)
    for channel in result.scalars().all():
        source_count = await db.scalar(select(func.count(Video.id)).where(Video.channel_id == channel.id))
        archived_count = await db.scalar(
            select(func.count(func.distinct(MediaFile.video_id)))
            .join(Video, MediaFile.video_id == Video.id)
            .where(Video.channel_id == channel.id)
        )
        channel.source_video_count = max(channel.source_video_count, int(source_count or 0))
        channel.archived_count = int(archived_count or 0)
        channel.missing_count = max(channel.source_video_count - channel.archived_count, 0)
        channel.source_counts_updated_at = datetime.now(UTC)


def _date_from_yyyymmdd(value: str | None) -> date | None:
    if not value or len(value) != 8:
        return None
    try:
        return date(year=int(value[:4]), month=int(value[4:6]), day=int(value[6:]))
    except ValueError:
        return None


def _published_from_upload_date(value: date | None) -> datetime | None:
    if value is None:
        return None
    return datetime(value.year, value.month, value.day, tzinfo=UTC)
