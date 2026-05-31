"""Parse yt-dlp progress lines into worker-friendly updates."""

from __future__ import annotations

import re
from dataclasses import dataclass

SIZE_UNITS = {
    "B": 1,
    "KiB": 1024,
    "MiB": 1024**2,
    "GiB": 1024**3,
    "TiB": 1024**4,
}
SIZE_RE = re.compile(r"~?(?P<value>\d+(?:\.\d+)?)(?P<unit>B|KiB|MiB|GiB|TiB)")
PROGRESS_RE = re.compile(
    r"^\[download\]\s+"
    r"(?P<percent>\d+(?:\.\d+)?)%\s+of\s+"
    r"(?P<total>~?(?:\d+(?:\.\d+)?)(?:B|KiB|MiB|GiB|TiB)|Unknown B)"
    r"(?:\s+at\s+(?P<speed>[\w.]+/s))?"
    r"(?:\s+ETA\s+(?P<eta>[\d:]+))?"
)
DESTINATION_RE = re.compile(r"^\[download\]\s+Destination:\s+(?P<path>.+)$")
FINISHED_RE = re.compile(r"^\[download\]\s+100%\s+of\s+(?P<total>~?(?:\d+(?:\.\d+)?)(?:B|KiB|MiB|GiB|TiB)|Unknown B)")


@dataclass(frozen=True)
class YtDlpProgress:
    """Structured progress extracted from one yt-dlp output line."""

    status: str
    percent: float | None = None
    total_bytes: int | None = None
    speed: str | None = None
    eta: str | None = None
    path: str | None = None
    raw: str = ""


def parse_ytdlp_progress_line(line: str) -> YtDlpProgress | None:
    """Parse the common yt-dlp download progress, destination, and completion lines."""
    raw = line.strip()
    if not raw:
        return None

    destination = DESTINATION_RE.match(raw)
    if destination:
        return YtDlpProgress(status="destination", path=destination.group("path"), raw=raw)

    progress = PROGRESS_RE.match(raw)
    if progress:
        percent = float(progress.group("percent"))
        status = "finished" if percent >= 100 else "downloading"
        return YtDlpProgress(
            status=status,
            percent=percent,
            total_bytes=parse_size_label(progress.group("total")),
            speed=progress.group("speed"),
            eta=progress.group("eta"),
            raw=raw,
        )

    finished = FINISHED_RE.match(raw)
    if finished:
        return YtDlpProgress(
            status="finished",
            percent=100.0,
            total_bytes=parse_size_label(finished.group("total")),
            raw=raw,
        )

    return None


def parse_size_label(value: str) -> int | None:
    """Convert yt-dlp binary size labels such as 12.5MiB into bytes."""
    if value == "Unknown B":
        return None
    match = SIZE_RE.fullmatch(value)
    if not match:
        return None
    amount = float(match.group("value"))
    return int(amount * SIZE_UNITS[match.group("unit")])
