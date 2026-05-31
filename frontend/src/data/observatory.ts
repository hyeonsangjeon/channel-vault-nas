import type { TranslationKey } from "../i18n";

export type MetricTone = "good" | "info" | "active" | "protected" | "warn" | "bad";

export type ArchiveMetric = {
  labelKey?: TranslationKey;
  label?: string;
  value?: string;
  valueKey?: TranslationKey;
  detailKey?: TranslationKey;
  detail?: string;
  tone: MetricTone;
};

export type ChannelNode = {
  id: string;
  title: string;
  health: number;
  storageGb: number;
  newVideos: number;
  failedJobs: number;
  group: string;
};

export type ChannelLink = {
  source: string;
  target: string;
  weight: number;
};

export type QueueLane = {
  labelKey: TranslationKey;
  count: number;
  status: "active" | "waiting" | "blocked";
};

export type ActivityItem = {
  titleKey: TranslationKey;
  channel: string;
  status: "discovered" | "downloading" | "archived" | "failed";
  timeKey: TranslationKey;
};

export type BackupStat = {
  labelKey: TranslationKey;
  value: string;
  detailKey: TranslationKey;
};

export type UploadRhythmDay = {
  labelKey: TranslationKey;
  count: number;
  intensity: number;
};

export type FolderPreviewItem = {
  depth: number;
  name: string;
  kind: "root" | "channel" | "year" | "month" | "file";
};

export type FidelityCheck = {
  labelKey: TranslationKey;
  status: "complete" | "partial" | "planned";
};

export type ImportOption = {
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  statusKey: TranslationKey;
  tone: "ready" | "scan" | "guarded";
};

export const mockMetrics: ArchiveMetric[] = [
  { labelKey: "metrics.totalVideos.label", value: "1,284", detailKey: "metrics.totalVideos.detail", tone: "info" },
  { labelKey: "metrics.archiveCoverage.label", value: "96.3%", detailKey: "metrics.archiveCoverage.detail", tone: "good" },
  { labelKey: "metrics.missingVideos.label", value: "31", detailKey: "metrics.missingVideos.detail", tone: "warn" },
  { labelKey: "metrics.removedSaved.label", value: "17", detailKey: "metrics.removedSaved.detail", tone: "protected" },
  { labelKey: "metrics.storageUsed.label", value: "1.82 TB", detailKey: "metrics.storageUsed.detail", tone: "warn" },
];

export const mockChannels: ChannelNode[] = [
  { id: "c1", title: "wingnut987S", health: 100, storageGb: 0, newVideos: 17, failedJobs: 0, group: "aws" },
  { id: "c2", title: "Signal Kitchen", health: 93, storageGb: 260, newVideos: 4, failedJobs: 1, group: "craft" },
  { id: "c3", title: "Market Notes", health: 86, storageGb: 195, newVideos: 2, failedJobs: 1, group: "analysis" },
  { id: "c4", title: "Archive Radio", health: 97, storageGb: 155, newVideos: 1, failedJobs: 0, group: "audio" },
  { id: "c5", title: "Long Form Works", health: 78, storageGb: 520, newVideos: 5, failedJobs: 1, group: "documentary" },
  { id: "c6", title: "Tiny Tutorials", health: 91, storageGb: 78, newVideos: 2, failedJobs: 0, group: "learning" },
  { id: "c7", title: "Night Builds", health: 89, storageGb: 240, newVideos: 1, failedJobs: 0, group: "engineering" },
];

export const mockLinks: ChannelLink[] = [
  { source: "c1", target: "c3", weight: 2 },
  { source: "c1", target: "c6", weight: 3 },
  { source: "c2", target: "c5", weight: 1 },
  { source: "c3", target: "c7", weight: 2 },
  { source: "c4", target: "c5", weight: 1 },
  { source: "c6", target: "c7", weight: 3 },
];

export const mockQueue: QueueLane[] = [
  { labelKey: "queue.sync", count: 2, status: "active" },
  { labelKey: "queue.metadata", count: 4, status: "active" },
  { labelKey: "queue.thumbnails", count: 9, status: "waiting" },
  { labelKey: "queue.subtitles", count: 5, status: "waiting" },
  { labelKey: "queue.downloads", count: 2, status: "active" },
  { labelKey: "queue.postprocess", count: 1, status: "blocked" },
];

export const mockActivity: ActivityItem[] = [
  { titleKey: "activity.storageEconomics", channel: "Market Notes", status: "discovered", timeKey: "time.2m" },
  { titleKey: "activity.signalTeardown", channel: "Signal Kitchen", status: "downloading", timeKey: "time.7m" },
  { titleKey: "activity.nightlyBuild", channel: "Night Builds", status: "archived", timeKey: "time.13m" },
  { titleKey: "activity.longInterview", channel: "Long Form Works", status: "failed", timeKey: "time.19m" },
];

export const backupStats: BackupStat[] = [
  { labelKey: "backup.total.label", value: "17", detailKey: "backup.total.detail" },
  { labelKey: "backup.archived.label", value: "0", detailKey: "backup.archived.detail" },
  { labelKey: "backup.missing.label", value: "17", detailKey: "backup.missing.detail" },
  { labelKey: "backup.removedSaved.label", value: "0", detailKey: "backup.removedSaved.detail" },
];

export const uploadRhythm: UploadRhythmDay[] = [
  { labelKey: "day.mon", count: 1, intensity: 0.25 },
  { labelKey: "day.tue", count: 3, intensity: 0.55 },
  { labelKey: "day.wed", count: 2, intensity: 0.4 },
  { labelKey: "day.thu", count: 4, intensity: 0.75 },
  { labelKey: "day.fri", count: 4, intensity: 0.75 },
  { labelKey: "day.sat", count: 2, intensity: 0.4 },
  { labelKey: "day.sun", count: 1, intensity: 0.25 },
];

export const folderPreview: FolderPreviewItem[] = [
  { depth: 0, name: "/downfolder", kind: "root" },
  { depth: 1, name: "channels", kind: "channel" },
  { depth: 2, name: "@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]", kind: "channel" },
  { depth: 3, name: "channel.nfo", kind: "file" },
  { depth: 3, name: "_channel.info.json", kind: "file" },
  { depth: 3, name: "poster.jpg", kind: "file" },
  { depth: 3, name: "2022", kind: "year" },
  { depth: 4, name: "2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]", kind: "month" },
  { depth: 5, name: "video.mp4", kind: "file" },
  { depth: 5, name: "video.info.json", kind: "file" },
  { depth: 5, name: "video.ko.srt", kind: "file" },
  { depth: 5, name: "thumbnail.jpg", kind: "file" },
  { depth: 5, name: "video.nfo", kind: "file" },
];

export const fidelityChecks: FidelityCheck[] = [
  { labelKey: "fidelity.infoJson", status: "complete" },
  { labelKey: "fidelity.thumbnail", status: "complete" },
  { labelKey: "fidelity.subtitles", status: "partial" },
  { labelKey: "fidelity.nfo", status: "planned" },
];

export const importOptions: ImportOption[] = [
  {
    labelKey: "import.takeout.label",
    detailKey: "import.takeout.detail",
    statusKey: "import.takeout.status",
    tone: "ready",
  },
  {
    labelKey: "import.folder.label",
    detailKey: "import.folder.detail",
    statusKey: "import.folder.status",
    tone: "scan",
  },
  {
    labelKey: "import.sync.label",
    detailKey: "import.sync.detail",
    statusKey: "import.sync.status",
    tone: "guarded",
  },
];
