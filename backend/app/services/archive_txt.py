"""youtube-dl archive.txt preview support."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.archive import Channel, MediaFile, Video
from app.schemas.archive import ArchiveTxtPreviewItem, ArchiveTxtPreviewResult

YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
WATCH_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})")


async def preview_archive_txt(
    db: AsyncSession,
    *,
    content: str,
    channel_id: int | None = None,
) -> ArchiveTxtPreviewResult:
    """Parse archive.txt lines and compare them with local DB/media coverage."""
    raw_lines = content.splitlines()
    parsed_ids: list[str] = []
    parsed_by_line: list[tuple[int, str, str | None]] = []
    for index, raw in enumerate(raw_lines, start=1):
        video_id = _extract_video_id(raw)
        parsed_by_line.append((index, raw, video_id))
        if video_id:
            parsed_ids.append(video_id)

    video_map = await _video_state_map(db, parsed_ids, channel_id=channel_id)
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
        status = "archived" if state["media_count"] > 0 else "known_missing"
        counts[status] += 1
        items.append(
            ArchiveTxtPreviewItem(
                line_number=line_number,
                raw=raw,
                video_external_id=video_id,
                state=status,
                title=state["title"],
                channel_title=state["channel_title"],
                reason="media file already indexed" if status == "archived" else "metadata exists, but no media file is indexed",
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


async def _video_state_map(
    db: AsyncSession,
    video_ids: list[str],
    *,
    channel_id: int | None,
) -> dict[str, dict[str, object]]:
    if not video_ids:
        return {}
    statement = (
        select(Video, Channel, MediaFile.id)
        .join(Channel, Video.channel_id == Channel.id)
        .outerjoin(MediaFile, MediaFile.video_id == Video.id)
        .where(Video.external_id.in_(set(video_ids)))
    )
    if channel_id is not None:
        statement = statement.where(Video.channel_id == channel_id)
    rows = await db.execute(statement)
    result: dict[str, dict[str, object]] = {}
    for video, channel, media_file_id in rows.all():
        entry = result.setdefault(
            video.external_id,
            {
                "title": video.title,
                "channel_title": channel.title,
                "media_count": 0,
            },
        )
        if media_file_id is not None:
            entry["media_count"] = int(entry["media_count"]) + 1
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
