"""Translate friendly quality labels into yt-dlp format selectors."""

from __future__ import annotations

QUALITY_FORMATS = {
    "720p": "bv*[height<=720]+ba/b[height<=720]/b",
    "1080p": "bv*[height<=1080]+ba/b[height<=1080]/b",
    "best": "bv*+ba/b",
    "audio": "ba/b",
}


def ytdlp_format_selector(quality: str) -> str:
    """Return a yt-dlp -f selector for app-facing quality labels."""
    normalized = quality.strip().lower()
    return QUALITY_FORMATS.get(normalized, quality)
