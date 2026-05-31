"""Registration-time storage forecast helpers."""

from app.schemas.source import StorageForecast

BYTES_PER_GIB = 1024**3
AVERAGE_VIDEO_BYTES = {
    "480p": int(0.18 * BYTES_PER_GIB),
    "720p": int(0.32 * BYTES_PER_GIB),
    "1080p": int(0.52 * BYTES_PER_GIB),
    "best": int(0.78 * BYTES_PER_GIB),
}
AUDIO_ONLY_BYTES = int(0.055 * BYTES_PER_GIB)


def build_storage_forecast(video_count: int, max_quality: str, audio_only: bool) -> StorageForecast:
    """Estimate archive size before a download policy is committed."""
    normalized_quality = max_quality.lower()
    average = AUDIO_ONLY_BYTES if audio_only else AVERAGE_VIDEO_BYTES.get(normalized_quality, AVERAGE_VIDEO_BYTES["1080p"])
    estimated_bytes = max(video_count, 0) * average
    return StorageForecast(
        video_count=video_count,
        max_quality=max_quality,
        audio_only=audio_only,
        estimated_bytes=estimated_bytes,
        estimated_label=_format_bytes(estimated_bytes),
        confidence="rough",
    )


def _format_bytes(value: int) -> str:
    if value >= BYTES_PER_GIB * 1024:
        return f"{value / (BYTES_PER_GIB * 1024):.2f} TB"
    if value >= BYTES_PER_GIB:
        return f"{value / BYTES_PER_GIB:.1f} GB"
    return f"{value / (1024**2):.0f} MB"
