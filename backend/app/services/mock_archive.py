"""Mock archive-priority payloads until real sync data lands."""

from datetime import UTC, datetime

from app.schemas.archive import (
    ArchiveFileLayout,
    CadenceBucket,
    ChannelCadence,
    ChannelCoverage,
    ImportSource,
    MissingVideo,
    RemovedVideo,
)


def build_channel_coverage(channel_id: str) -> ChannelCoverage:
    """Return a deterministic completeness snapshot."""
    return ChannelCoverage(
        channel_id=channel_id,
        source=428,
        archived=412,
        missing=13,
        removed_saved=3,
        percent=96.3,
        updated_at=datetime(2026, 5, 30, 8, 45, tzinfo=UTC),
    )


def build_missing_videos(channel_id: str) -> list[MissingVideo]:
    """Return videos that still need local preservation."""
    del channel_id
    return [
        MissingVideo(
            id="m1",
            title="Prototype teardown: lost notes",
            published_at=datetime(2024, 11, 8, 14, 30, tzinfo=UTC),
            source_state="available",
            reason="metadata discovered, media not downloaded",
        ),
        MissingVideo(
            id="m2",
            title="Live Q&A archive",
            published_at=datetime(2025, 2, 13, 11, 0, tzinfo=UTC),
            source_state="available",
            reason="policy skipped livestream VOD",
        ),
    ]


def build_removed_videos(channel_id: str) -> list[RemovedVideo]:
    """Return videos preserved before removal from the source."""
    del channel_id
    return [
        RemovedVideo(
            id="r1",
            title="Signal memory: unreleased cut",
            published_at=datetime(2023, 9, 18, 9, 15, tzinfo=UTC),
            removed_detected_at=datetime(2026, 5, 12, 6, 2, tzinfo=UTC),
            local_relative_path=(
                "channels/@deeplab [UC8_DEMO]/2023/"
                "2023-09-18 - signal-memory-unreleased-cut [r1]/video.mp4"
            ),
        )
    ]


def build_channel_cadence(channel_id: str) -> ChannelCadence:
    """Return upload rhythm data for the channel detail/dashboard."""
    return ChannelCadence(
        channel_id=channel_id,
        first_video_published_at=datetime(2018, 4, 3, 12, 0, tzinfo=UTC),
        latest_video_published_at=datetime(2026, 5, 29, 12, 0, tzinfo=UTC),
        avg_upload_interval_days=6.8,
        typical_upload_dow=3,
        typical_upload_hour=21,
        next_expected_at=datetime(2026, 6, 5, 12, 0, tzinfo=UTC),
        buckets=[
            CadenceBucket(dow=0, label="Mon", count=8, typical_hour=20),
            CadenceBucket(dow=1, label="Tue", count=13, typical_hour=20),
            CadenceBucket(dow=2, label="Wed", count=7, typical_hour=18),
            CadenceBucket(dow=3, label="Thu", count=28, typical_hour=21),
            CadenceBucket(dow=4, label="Fri", count=21, typical_hour=21),
            CadenceBucket(dow=5, label="Sat", count=5, typical_hour=11),
            CadenceBucket(dow=6, label="Sun", count=3, typical_hour=10),
        ],
    )


def build_archive_file_layout() -> ArchiveFileLayout:
    """Return the default NAS file contract."""
    return ArchiveFileLayout(
        option="per-video-folder",
        root="downfolder/channels",
        template=(
            "channels/{channel_handle} [{channel_id}]/{year}/"
            "{upload_date} - {sanitized_title} [{video_id}]/video.mp4"
        ),
        sidecars=["video.info.json", "video.{lang}.srt", "thumbnail.jpg", "video.nfo"],
        invariants=[
            "folder anchor is upload_date + video_id",
            "video.info.json is always written next to media",
            "relative_path is stored instead of host absolute path",
            "source title changes do not rename files automatically",
        ],
    )


def build_import_sources() -> list[ImportSource]:
    """Return supported import lanes for creator-owned archives."""
    return [
        ImportSource(
            id="google-takeout",
            title="Google Takeout",
            description="Import creator-owned YouTube exports into the NAS archive layout.",
            trust_level="official-export",
            status="planned",
        ),
        ImportSource(
            id="existing-folder",
            title="Existing NAS folder",
            description="Scan media files and sidecars already stored on the NAS.",
            trust_level="local-filesystem",
            status="planned",
        ),
        ImportSource(
            id="authorized-channel-sync",
            title="Authorized channel sync",
            description="Sync sources the user has rights and permission to preserve.",
            trust_level="user-authorized",
            status="guarded",
        ),
    ]
