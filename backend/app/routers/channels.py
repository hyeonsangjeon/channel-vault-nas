"""Channel archive-priority endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.archive import (
    ArchiveFileLayout,
    ChannelCadence,
    ChannelCoverage,
    MissingVideo,
    RemovedVideo,
)
from app.schemas.jobs import (
    ChannelDetail,
    ChannelPolicyRead,
    ChannelPolicyUpdate,
    ChannelSettingsUpdate,
    ChannelSyncRequest,
    ChannelSyncResult,
    ChannelVideoRead,
    DownloadCandidateRequest,
    DownloadCandidateResult,
)
from app.schemas.source import (
    ChannelProbeRequest,
    ChannelProbeResult,
    ChannelRegistrationRequest,
    ChannelRegistrationResult,
    NormalizedSource,
    RegisteredChannel,
    SourceNormalizeRequest,
)
from app.services.channel_policy import get_channel_policy, update_channel_policy
from app.services.channel_registration import (
    list_registered_channels,
    probe_for_registration,
    register_channel,
)
from app.services.channel_sync import (
    ChannelNotFoundError,
    get_channel_detail,
    list_channel_videos,
    run_channel_sync,
    update_channel_settings,
)
from app.services.download_queue import create_channel_download_candidates
from app.services.mock_archive import (
    build_archive_file_layout,
    build_channel_cadence,
    build_channel_coverage,
    build_missing_videos,
    build_removed_videos,
)
from app.services.source_normalizer import UnsupportedSourceError, normalize_source_input
from app.services.ytdlp_probe import ChannelProbeError

router = APIRouter(prefix="/api/channels", tags=["channels"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[RegisteredChannel])
async def get_channels(db: DbSession) -> list[RegisteredChannel]:
    """Return registered archive sources."""
    return await list_registered_channels(db)


@router.post("", response_model=ChannelRegistrationResult)
async def create_channel(
    payload: ChannelRegistrationRequest,
    db: DbSession,
) -> ChannelRegistrationResult:
    """Probe and persist a channel registration."""
    try:
        return await register_channel(db, payload)
    except (UnsupportedSourceError, ChannelProbeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/_normalize", response_model=NormalizedSource)
async def normalize_channel_source(payload: SourceNormalizeRequest) -> NormalizedSource:
    """Normalize channel registration inputs before probing with yt-dlp."""
    try:
        return normalize_source_input(payload.value)
    except UnsupportedSourceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/_probe", response_model=ChannelProbeResult)
async def probe_channel(
    payload: ChannelProbeRequest,
    db: DbSession,
) -> ChannelProbeResult:
    """Return a read-only channel preview before registration commit."""
    try:
        return await probe_for_registration(db, payload)
    except (UnsupportedSourceError, ChannelProbeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{channel_id:int}", response_model=ChannelDetail)
async def get_channel(channel_id: int, db: DbSession) -> ChannelDetail:
    """Return post-registration channel detail."""
    detail = await get_channel_detail(db, channel_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return detail


@router.patch("/{channel_id:int}", response_model=ChannelDetail)
async def patch_channel(
    channel_id: int,
    payload: ChannelSettingsUpdate,
    db: DbSession,
) -> ChannelDetail:
    """Update editable channel scheduling settings."""
    detail = await update_channel_settings(db=db, channel_id=channel_id, payload=payload)
    if detail is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return detail


@router.post("/{channel_id:int}/sync", response_model=ChannelSyncResult)
async def sync_channel(
    channel_id: int,
    db: DbSession,
    payload: ChannelSyncRequest | None = None,
) -> ChannelSyncResult:
    """Run a manual metadata sync for a registered channel."""
    try:
        return await run_channel_sync(db=db, channel_id=channel_id, payload=payload or ChannelSyncRequest())
    except ChannelNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{channel_id:int}/videos", response_model=list[ChannelVideoRead])
async def get_channel_videos(channel_id: int, db: DbSession) -> list[ChannelVideoRead]:
    """Return a channel video timeline."""
    videos = await list_channel_videos(db, channel_id)
    if videos is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return videos


@router.get("/{channel_id:int}/policy", response_model=ChannelPolicyRead)
async def read_channel_policy(channel_id: int, db: DbSession) -> ChannelPolicyRead:
    """Return editable archive policy for a channel."""
    policy = await get_channel_policy(db, channel_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return policy


@router.patch("/{channel_id:int}/policy", response_model=ChannelPolicyRead)
async def patch_channel_policy(
    channel_id: int,
    payload: ChannelPolicyUpdate,
    db: DbSession,
) -> ChannelPolicyRead:
    """Update editable archive policy for a channel."""
    policy = await update_channel_policy(db=db, channel_id=channel_id, payload=payload)
    if policy is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return policy


@router.post("/{channel_id:int}/downloads/candidates", response_model=DownloadCandidateResult)
async def create_download_candidates(
    channel_id: int,
    db: DbSession,
    payload: DownloadCandidateRequest | None = None,
) -> DownloadCandidateResult:
    """Create download queue candidates for missing channel videos."""
    request = payload or DownloadCandidateRequest()
    result = await create_channel_download_candidates(
        db=db,
        channel_id=channel_id,
        quality=request.quality,
        limit=request.limit,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return result


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
