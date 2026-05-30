"""Channel archive-priority endpoints."""

from fastapi import APIRouter

from app.schemas.archive import (
    ArchiveFileLayout,
    ChannelCadence,
    ChannelCoverage,
    MissingVideo,
    RemovedVideo,
)
from app.services.mock_archive import (
    build_archive_file_layout,
    build_channel_cadence,
    build_channel_coverage,
    build_missing_videos,
    build_removed_videos,
)

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("/{channel_id}/coverage", response_model=ChannelCoverage)
async def get_channel_coverage(channel_id: str) -> ChannelCoverage:
    """Return source/archived/missing/removed completeness for a channel."""
    return build_channel_coverage(channel_id)


@router.get("/{channel_id}/missing", response_model=list[MissingVideo])
async def get_missing_videos(channel_id: str) -> list[MissingVideo]:
    """Return source videos that are not mirrored locally yet."""
    return build_missing_videos(channel_id)


@router.get("/{channel_id}/removed", response_model=list[RemovedVideo])
async def get_removed_saved_videos(channel_id: str) -> list[RemovedVideo]:
    """Return videos removed from source but preserved locally."""
    return build_removed_videos(channel_id)


@router.get("/{channel_id}/cadence", response_model=ChannelCadence)
async def get_channel_cadence(channel_id: str) -> ChannelCadence:
    """Return upload rhythm and next expected upload for a channel."""
    return build_channel_cadence(channel_id)


@router.get("/_file-layout/default", response_model=ArchiveFileLayout)
async def get_default_file_layout() -> ArchiveFileLayout:
    """Return the default archive filesystem contract."""
    return build_archive_file_layout()
