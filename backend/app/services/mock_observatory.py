"""Mock data for the first Archive Observatory screen."""

from app.schemas.dashboard import (
    ActivityItem,
    ArchiveMetric,
    ChannelLink,
    ChannelNode,
    CoverageSummary,
    DashboardSnapshot,
    FidelitySummary,
    QueueLane,
)


def build_dashboard_snapshot() -> DashboardSnapshot:
    """Build a deterministic mock dashboard snapshot."""
    return DashboardSnapshot(
        coverage=CoverageSummary(
            source=1284,
            archived=1236,
            missing=31,
            removed_saved=17,
            percent=96.3,
        ),
        fidelity=FidelitySummary(
            info_json=1236,
            thumbnails=1211,
            subtitles=892,
            nfo=0,
        ),
        metrics=[
            ArchiveMetric(label="Total Videos", value="1,284", detail="across watched channels", tone="info"),
            ArchiveMetric(label="Archive Coverage", value="96.3%", detail="1,236 mirrored locally", tone="good"),
            ArchiveMetric(label="Missing Videos", value="31", detail="source has them; NAS does not", tone="warn"),
            ArchiveMetric(label="Removed Saved", value="17", detail="gone upstream, preserved here", tone="active"),
            ArchiveMetric(label="Storage Used", value="1.82 TB", detail="74% of archive volume", tone="warn"),
        ],
        channels=[
            ChannelNode(id="c1", title="Deep Lab", health=98, storage_gb=410, new_videos=3, failed_jobs=0, group="science"),
            ChannelNode(id="c2", title="Signal Kitchen", health=93, storage_gb=260, new_videos=4, failed_jobs=1, group="craft"),
            ChannelNode(id="c3", title="Market Notes", health=86, storage_gb=195, new_videos=2, failed_jobs=1, group="analysis"),
            ChannelNode(id="c4", title="Archive Radio", health=97, storage_gb=155, new_videos=1, failed_jobs=0, group="audio"),
            ChannelNode(id="c5", title="Long Form Works", health=78, storage_gb=520, new_videos=5, failed_jobs=1, group="documentary"),
            ChannelNode(id="c6", title="Tiny Tutorials", health=91, storage_gb=78, new_videos=2, failed_jobs=0, group="learning"),
            ChannelNode(id="c7", title="Night Builds", health=89, storage_gb=240, new_videos=1, failed_jobs=0, group="engineering"),
        ],
        links=[
            ChannelLink(source="c1", target="c3", weight=2),
            ChannelLink(source="c1", target="c6", weight=3),
            ChannelLink(source="c2", target="c5", weight=1),
            ChannelLink(source="c3", target="c7", weight=2),
            ChannelLink(source="c4", target="c5", weight=1),
            ChannelLink(source="c6", target="c7", weight=3),
        ],
        queue=[
            QueueLane(label="Sync", count=2, status="active"),
            QueueLane(label="Metadata", count=4, status="active"),
            QueueLane(label="Thumbnails", count=9, status="waiting"),
            QueueLane(label="Subtitles", count=5, status="waiting"),
            QueueLane(label="Downloads", count=2, status="active"),
            QueueLane(label="Postprocess", count=1, status="blocked"),
        ],
        activity=[
            ActivityItem(title="The quiet economics of storage", channel="Market Notes", status="discovered", time="2 min ago"),
            ActivityItem(title="Signal chain teardown", channel="Signal Kitchen", status="downloading", time="7 min ago"),
            ActivityItem(title="Nightly build diary 042", channel="Night Builds", status="archived", time="13 min ago"),
            ActivityItem(title="Long interview part 3", channel="Long Form Works", status="failed", time="19 min ago"),
        ],
    )
