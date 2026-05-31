"""Normalize supported channel and playlist source inputs."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.schemas.source import NormalizedSource

CHANNEL_ID_PATTERN = re.compile(r"^UC[A-Za-z0-9_-]{22}$")
CHANNEL_ID_SEARCH = re.compile(r"\b(UC[A-Za-z0-9_-]{22})\b")
HANDLE_PATTERN = re.compile(r"^@[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$")
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com"}


class UnsupportedSourceError(ValueError):
    """Raised when the submitted source cannot be registered."""


def normalize_source_input(value: str) -> NormalizedSource:
    """Normalize the channel registration forms we accept in the MVP."""
    original = value.strip()
    if not original:
        raise UnsupportedSourceError("Source value is empty.")

    searched_channel_id = CHANNEL_ID_SEARCH.search(original)
    if searched_channel_id and not original.startswith(("http://", "https://")):
        return _from_channel_id(original=original, channel_id=searched_channel_id.group(1))

    if original.startswith("@"):
        return _from_handle(original=original, handle=original, tracking_query_removed=False)

    parsed = urlparse(original)
    if parsed.scheme not in {"http", "https"}:
        raise UnsupportedSourceError("Source must be a YouTube channel URL, handle, or channel ID.")

    host = parsed.netloc.lower()
    if host not in YOUTUBE_HOSTS:
        raise UnsupportedSourceError("Only YouTube channel sources are supported in the MVP.")

    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        raise UnsupportedSourceError("YouTube URL does not include a channel identifier.")

    first = parts[0]
    tracking_removed = bool(parsed.query or parsed.fragment)
    if first.startswith("@"):
        return _from_handle(original=original, handle=first, tracking_query_removed=tracking_removed)

    if first == "channel" and len(parts) >= 2 and CHANNEL_ID_PATTERN.fullmatch(parts[1]):
        return _from_channel_id(
            original=original,
            channel_id=parts[1],
            tracking_query_removed=tracking_removed,
        )

    raise UnsupportedSourceError("Supported channel inputs are @handle URLs and UC... channel IDs.")


def _from_handle(original: str, handle: str, tracking_query_removed: bool) -> NormalizedSource:
    normalized_handle = f"@{handle.removeprefix('@')}"
    if not HANDLE_PATTERN.fullmatch(normalized_handle):
        raise UnsupportedSourceError("Invalid YouTube handle format.")

    canonical_url = f"https://www.youtube.com/{normalized_handle}"
    return NormalizedSource(
        original=original,
        source_type="channel",
        identifier_type="handle",
        identifier=normalized_handle,
        canonical_url=canonical_url,
        probe_url=canonical_url,
        tracking_query_removed=tracking_query_removed,
    )


def _from_channel_id(original: str, channel_id: str, tracking_query_removed: bool = False) -> NormalizedSource:
    if not CHANNEL_ID_PATTERN.fullmatch(channel_id):
        raise UnsupportedSourceError("Invalid YouTube channel ID format.")

    canonical_url = f"https://www.youtube.com/channel/{channel_id}"
    return NormalizedSource(
        original=original,
        source_type="channel",
        identifier_type="channel_id",
        identifier=channel_id,
        canonical_url=canonical_url,
        probe_url=canonical_url,
        tracking_query_removed=tracking_query_removed,
    )
