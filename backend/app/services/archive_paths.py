"""NAS archive path preview helpers."""

from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

WINDOWS_RESERVED_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    "com1",
    "com2",
    "com3",
    "com4",
    "com5",
    "com6",
    "com7",
    "com8",
    "com9",
    "lpt1",
    "lpt2",
    "lpt3",
    "lpt4",
    "lpt5",
    "lpt6",
    "lpt7",
    "lpt8",
    "lpt9",
}
UNSAFE_PATH_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
WHITESPACE = re.compile(r"\s+")


def sanitize_path_part(value: str, fallback: str = "untitled", limit: int = 120) -> str:
    """Return a single safe path segment that is portable across NAS filesystems."""
    cleaned = UNSAFE_PATH_CHARS.sub(" ", value)
    cleaned = WHITESPACE.sub(" ", cleaned).strip(" .")
    if not cleaned:
        cleaned = fallback
    if cleaned.lower() in WINDOWS_RESERVED_NAMES:
        cleaned = f"{cleaned}_"
    return cleaned[:limit].rstrip(" .") or fallback


def channel_folder_name(handle: str | None, channel_id: str | None, title: str) -> str:
    """Build the stable channel folder label."""
    label = handle or sanitize_path_part(title, fallback="channel", limit=80)
    if channel_id:
        return f"{sanitize_path_part(label, fallback='channel', limit=80)} [{channel_id}]"
    return sanitize_path_part(label, fallback="channel", limit=100)


def video_folder_name(
    title: str,
    video_id: str,
    published_at: datetime | None = None,
    upload_date: date | None = None,
) -> str:
    """Build the stable video folder anchor."""
    date_part = "undated"
    if upload_date is not None:
        date_part = upload_date.isoformat()
    elif published_at is not None:
        date_part = published_at.date().isoformat()

    safe_title = sanitize_path_part(title, fallback="video", limit=90)
    return f"{date_part} - {safe_title} [{video_id}]"


def video_archive_dir(
    download_dir: str | Path,
    *,
    channel_handle: str | None,
    channel_id: str | None,
    channel_title: str,
    video_title: str,
    video_id: str,
    published_at: datetime | None = None,
    upload_date: date | None = None,
) -> Path:
    """Build the final NAS video folder path for a source video."""
    published = upload_date or (published_at.date() if published_at else None)
    year = str(published.year) if published else "undated"
    return (
        Path(download_dir)
        / "channels"
        / channel_folder_name(channel_handle, channel_id, channel_title)
        / year
        / video_folder_name(video_title, video_id, published_at=published_at, upload_date=upload_date)
    )


def default_sidecars() -> list[str]:
    """Return the sidecar contract shown during registration."""
    return ["video.info.json", "thumbnail.jpg", "video.{lang}.srt", "video.nfo"]
