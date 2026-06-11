"""Async yt-dlp probing for channel registration."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, date, datetime
from typing import Any

from app.config import settings
from app.schemas.source import (
    ChannelProbeRequest,
    ChannelProbeResult,
    FolderPreview,
    NormalizedSource,
    SourceVideoPreview,
)
from app.services.archive_paths import channel_folder_name, default_sidecars, video_folder_name
from app.services.source_normalizer import normalize_source_input
from app.services.storage_forecast import build_storage_forecast


class ChannelProbeError(RuntimeError):
    """Raised when a channel probe cannot complete."""


async def probe_channel_source(payload: ChannelProbeRequest) -> ChannelProbeResult:
    """Run a fast flat playlist probe and shape it for registration preview."""
    normalized = normalize_source_input(payload.value)
    raw = await _run_ytdlp_probe(normalized)
    await _enrich_first_entry(raw)
    return build_probe_result(
        normalized=normalized,
        raw=raw,
        max_quality=payload.max_quality,
        audio_only=payload.audio_only,
    )


def build_probe_result(
    *,
    normalized: NormalizedSource,
    raw: dict[str, Any],
    max_quality: str,
    audio_only: bool,
) -> ChannelProbeResult:
    """Convert yt-dlp JSON into the registration preview contract."""
    external_id = _string_or_none(raw.get("channel_id") or raw.get("id"))
    handle = _string_or_none(raw.get("uploader_id"))
    title = _string_or_none(raw.get("channel") or raw.get("uploader") or raw.get("title")) or "Untitled channel"
    description = _string_or_none(raw.get("description"))
    entries = _video_previews(raw.get("entries") or [])
    video_count = _int_or_none(raw.get("playlist_count")) or len(entries)
    first_video, latest_video = _publication_bounds(entries)
    folder_preview = _folder_preview(
        handle=handle or (normalized.identifier if normalized.identifier_type == "handle" else None),
        channel_id=external_id if external_id and external_id.startswith("UC") else None,
        title=title,
        first_video=entries[0] if entries else None,
    )

    return ChannelProbeResult(
        normalized=normalized,
        title=_clean_playlist_title(title),
        external_id=external_id,
        handle=handle,
        source_url=normalized.canonical_url,
        channel_url=_string_or_none(raw.get("channel_url")),
        description=description,
        thumbnail_url=_best_thumbnail(raw.get("thumbnails"), banner=False),
        banner_url=_best_thumbnail(raw.get("thumbnails"), banner=True),
        follower_count=_int_or_none(raw.get("channel_follower_count")),
        video_count=video_count,
        videos=entries,
        first_video_published_at=first_video,
        latest_video_published_at=latest_video,
        storage_forecast=build_storage_forecast(
            video_count=video_count,
            max_quality=max_quality,
            audio_only=audio_only,
        ),
        folder_preview=folder_preview,
    )


async def _run_ytdlp_probe(normalized: NormalizedSource) -> dict[str, Any]:
    cmd = [
        settings.ytdlp_binary,
        "--skip-download",
        "--flat-playlist",
        "--dump-single-json",
        "--ignore-no-formats-error",
        "--playlist-end",
        str(settings.channel_probe_video_limit),
    ]
    if settings.proxy:
        cmd.extend(["--proxy", settings.proxy])
    cmd.append(normalized.probe_url)

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise ChannelProbeError("yt-dlp binary was not found.") from exc

    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=settings.channel_probe_timeout_seconds,
        )
    except TimeoutError as exc:
        process.kill()
        await process.communicate()
        raise ChannelProbeError("Channel probe timed out.") from exc

    if process.returncode != 0:
        detail = stderr.decode("utf-8", errors="replace").strip() or "yt-dlp probe failed."
        raise ChannelProbeError(detail[-800:])  # keep API errors useful without flooding clients

    try:
        return json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ChannelProbeError("yt-dlp returned invalid JSON.") from exc


async def _enrich_first_entry(raw: dict[str, Any]) -> None:
    entries = raw.get("entries")
    if not isinstance(entries, list) or not entries:
        return
    first = entries[0]
    if not isinstance(first, dict) or first.get("upload_date"):
        return
    video_id = _string_or_none(first.get("id"))
    if not video_id:
        return

    cmd = [
        settings.ytdlp_binary,
        "--skip-download",
        "--dump-json",
        "--ignore-no-formats-error",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    if settings.proxy:
        cmd[1:1] = ["--proxy", settings.proxy]

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _stderr = await asyncio.wait_for(process.communicate(), timeout=30)
    except (FileNotFoundError, TimeoutError):
        return

    if process.returncode != 0:
        return
    try:
        detail = json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError:
        return

    for key in ("title", "duration", "timestamp", "upload_date", "thumbnails"):
        if detail.get(key) is not None:
            first[key] = detail[key]


def _video_previews(entries: list[dict[str, Any]]) -> list[SourceVideoPreview]:
    previews: list[SourceVideoPreview] = []
    for entry in entries:
        video_id = _string_or_none(entry.get("id"))
        if not video_id:
            continue
        timestamp = _int_or_none(entry.get("timestamp"))
        published_at = datetime.fromtimestamp(timestamp, tz=UTC) if timestamp else None
        upload_date = _string_or_none(entry.get("upload_date"))
        previews.append(
            SourceVideoPreview(
                external_id=video_id,
                title=_string_or_none(entry.get("title")) or video_id,
                url=_string_or_none(entry.get("url")) or f"https://www.youtube.com/watch?v={video_id}",
                duration_seconds=_int_or_none(entry.get("duration")),
                thumbnail_url=_best_thumbnail(entry.get("thumbnails"), banner=False),
                published_at=published_at,
                upload_date=upload_date,
            )
        )
    return previews


def _folder_preview(
    *,
    handle: str | None,
    channel_id: str | None,
    title: str,
    first_video: SourceVideoPreview | None,
) -> FolderPreview:
    channel_dir = channel_folder_name(handle=handle, channel_id=channel_id, title=title)
    example_video_dir = None
    if first_video is not None:
        upload_date = _date_from_yyyymmdd(first_video.upload_date)
        year = "undated"
        if upload_date is not None:
            year = str(upload_date.year)
        elif first_video.published_at is not None:
            year = str(first_video.published_at.year)
        example_video_dir = video_folder_name(
            title=first_video.title,
            video_id=first_video.external_id,
            published_at=first_video.published_at,
            upload_date=upload_date,
        )
    return FolderPreview(
        root="downfolder/channels",
        channel_dir=f"channels/{channel_dir}",
        example_video_dir=f"channels/{channel_dir}/{year}/{example_video_dir}" if example_video_dir else None,
        sidecars=default_sidecars(),
    )


def _publication_bounds(entries: list[SourceVideoPreview]) -> tuple[datetime | None, datetime | None]:
    dates = [entry.published_at for entry in entries if entry.published_at is not None]
    if not dates:
        return None, None
    return min(dates), max(dates)


def _best_thumbnail(thumbnails: Any, *, banner: bool) -> str | None:
    if not isinstance(thumbnails, list):
        return None
    candidates = [item for item in thumbnails if isinstance(item, dict) and item.get("url")]
    if banner:
        banner_candidates = [item for item in candidates if "banner" in str(item.get("id", "")).lower()]
        candidates = banner_candidates or [item for item in candidates if int(item.get("width") or 0) > int(item.get("height") or 0) * 2]
    else:
        avatar_candidates = [item for item in candidates if "avatar" in str(item.get("id", "")).lower()]
        candidates = avatar_candidates or candidates
    if not candidates:
        return None
    return str(max(candidates, key=lambda item: int(item.get("width") or 0) * int(item.get("height") or 0)).get("url"))


def _clean_playlist_title(value: str) -> str:
    return value.removesuffix(" - Videos").strip() or value


def _date_from_yyyymmdd(value: str | None) -> date | None:
    if not value or len(value) != 8:
        return None
    try:
        return date(year=int(value[:4]), month=int(value[4:6]), day=int(value[6:]))
    except ValueError:
        return None


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
