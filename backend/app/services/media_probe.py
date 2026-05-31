"""Best-effort media metadata probing through ffprobe."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import settings


@dataclass(slots=True)
class MediaProbe:
    """Normalized technical media facts from ffprobe."""

    container: str | None
    video_codec: str | None
    audio_codec: str | None
    fps: float | None
    width: int | None
    height: int | None
    duration_seconds: int | None


async def probe_media_file(path: str | Path) -> MediaProbe | None:
    """Return ffprobe metadata, or None when probing is unavailable/invalid."""
    media_path = Path(path)
    if not media_path.exists() or not media_path.is_file():
        return None
    command = [
        settings.ffprobe_binary,
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        media_path.as_posix(),
    ]
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (FileNotFoundError, OSError):
        return None
    try:
        stdout, _stderr = await asyncio.wait_for(process.communicate(), timeout=settings.media_probe_timeout_seconds)
    except TimeoutError:
        process.kill()
        await process.wait()
        return None
    if process.returncode != 0:
        return None
    try:
        payload = json.loads(stdout.decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        return None
    return parse_ffprobe_payload(payload)


def parse_ffprobe_payload(payload: dict[str, Any]) -> MediaProbe:
    """Normalize the subset of ffprobe JSON the app stores."""
    streams = payload.get("streams") if isinstance(payload.get("streams"), list) else []
    video_stream = _first_stream(streams, "video")
    audio_stream = _first_stream(streams, "audio")
    format_payload = payload.get("format") if isinstance(payload.get("format"), dict) else {}
    container = _container_name(format_payload.get("format_name"))
    duration = _duration_seconds(format_payload.get("duration"))
    if duration is None and video_stream is not None:
        duration = _duration_seconds(video_stream.get("duration"))

    return MediaProbe(
        container=container,
        video_codec=_string_or_none(video_stream.get("codec_name")) if video_stream else None,
        audio_codec=_string_or_none(audio_stream.get("codec_name")) if audio_stream else None,
        fps=_fps(video_stream) if video_stream else None,
        width=_int_or_none(video_stream.get("width")) if video_stream else None,
        height=_int_or_none(video_stream.get("height")) if video_stream else None,
        duration_seconds=duration,
    )


def _first_stream(streams: list[Any], codec_type: str) -> dict[str, Any] | None:
    for stream in streams:
        if isinstance(stream, dict) and stream.get("codec_type") == codec_type:
            return stream
    return None


def _container_name(value: Any) -> str | None:
    text = _string_or_none(value)
    if text is None:
        return None
    names = {name.strip().lower() for name in text.split(",") if name.strip()}
    if "mp4" in names:
        return "mp4"
    if "webm" in names:
        return "webm"
    if "matroska" in names:
        return "mkv"
    return text.split(",", 1)[0] or None


def _duration_seconds(value: Any) -> int | None:
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        return None
    return max(0, round(seconds))


def _fps(stream: dict[str, Any]) -> float | None:
    for key in ("avg_frame_rate", "r_frame_rate"):
        value = stream.get(key)
        if not value or value == "0/0":
            continue
        if isinstance(value, str) and "/" in value:
            numerator, denominator = value.split("/", 1)
            try:
                parsed = float(numerator) / float(denominator)
            except (ValueError, ZeroDivisionError):
                continue
            return round(parsed, 3) if parsed > 0 else None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            continue
        return round(parsed, 3) if parsed > 0 else None
    return None


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text or None
