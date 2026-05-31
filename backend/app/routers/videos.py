"""Video endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.jobs import VideoDownloadRequest, VideoDownloadResult
from app.services.download_queue import VideoNotFoundError, enqueue_video_download

router = APIRouter(prefix="/api/videos", tags=["videos"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post("/{video_id:int}/download", response_model=VideoDownloadResult)
async def queue_video_download(
    video_id: int,
    db: DbSession,
    payload: VideoDownloadRequest | None = None,
) -> VideoDownloadResult:
    """Queue one video explicitly without starting a media worker yet."""
    request = payload or VideoDownloadRequest()
    try:
        return await enqueue_video_download(
            db=db,
            video_id=video_id,
            quality=request.quality,
        )
    except VideoNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
