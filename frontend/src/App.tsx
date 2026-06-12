import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePause,
  ClipboardList,
  Clock3,
  Database,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileArchive,
  FileCheck2,
  FileText,
  Film,
  Folder,
  FolderTree,
  Gauge,
  HardDrive,
  History,
  KeyRound,
  Languages,
  Link2,
  ListFilter,
  Rocket,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  TimerReset,
  Trash2,
  Waves,
  X,
  XCircle,
  Zap,
  Square,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import {
  applyLibraryRescan,
  ApiAuthError,
  apiUrl,
  bulkUpdateDownloadJobs,
  captureStoragePressureSnapshot,
  createDownloadCandidates,
  cancelDownloadJob,
  deleteLibraryView,
  enqueueVideoDownload,
  getChannel,
  getChannelCadence,
  getChannelCoverage,
  getChannelMissingVideos,
  getChannelPolicy,
  getChannelVideos,
  getDashboard,
  getDownloadJobs,
  getDownloadWorkerPlan,
  getDownloadWorkerRunSummary,
  getDownloadWorkerRuns,
  getLibrary,
  getLibraryFiles,
  getLibraryViews,
  getMetadataSyncTicks,
  getMountDoctor,
  getOperationsReadiness,
  getQueuePreflight,
  getRecentEvents,
  getRuntimeSettings,
  getSchedulerTicks,
  getStorageChannelPressureTrend,
  getStorageOrphanQuarantine,
  getStoragePressureTrend,
  getStorageScan,
  getSupportBundle,
  getSyncJobs,
  probeChannel,
  pruneMissingStorageIndex,
  pruneMetadataSyncTicks,
  pruneRecentEvents,
  pruneSchedulerTicks,
  previewArchiveTxt,
  purgeStorageOrphanQuarantine,
  quarantineStorageOrphanSidecar,
  registerChannel,
  requestRuntimeRestart,
  recoverUnindexedStorageDrift,
  restoreStorageOrphanSidecar,
  retryDownloadJob,
  runDownloadWorkerOnce,
  runMetadataSyncSchedulerOnce,
  saveLibraryView,
  seedDemoWorkspace,
  stageArchiveTxt,
  stopDownloadJob,
  syncChannel,
  updateChannel,
  updateChannelPolicy,
  updateRuntimeSettings,
  clearApiAuthToken,
  getApiAuthToken,
  setApiAuthToken,
  wsEventsUrl,
  clearDemoWorkspace,
  type ArchiveEvent,
  type ArchiveEventFilters,
  type ArchiveTxtPreviewResult,
  type ArchiveTxtStageResult,
  type ChannelPolicy,
  type ChannelDetail,
  type ChannelCadence,
  type ChannelCoverage,
  type MissingVideo,
  type OperationMission,
  type OperationsReadiness,
  type ChannelProbeResult,
  type ChannelRegistrationPayload,
  type ChannelRegistrationResult,
  type ChannelSyncResult,
  type ChannelVideo,
  type DashboardSnapshot,
  type DemoWorkspaceClearResult,
  type DemoWorkspaceResult,
  type DownloadJob,
  type DownloadWorkerPlan,
  type DownloadWorkerRunAudit,
  type DownloadWorkerRunFilters,
  type LibraryItem,
  type LibraryFile,
  type LibrarySavedView,
  type LibrarySnapshot,
  type QueuePreflightPlan,
  type RescanApplyResult,
  type RuntimeRestartAdapter,
  type RuntimeSettings,
  type RuntimeSettingsUpdate,
  type MetadataSyncTickFilters,
  type MetadataSyncTick,
  type MountDoctor,
  type MountDoctorPath,
  type SchedulerTick,
  type SchedulerTickFilters,
  type StorageChannelPressureTrend,
  type StorageDriftActionResult,
  type StorageDriftItem,
  type StorageOrphanQuarantineResult,
  type StorageOrphanSidecar,
  type StoragePressureTrend,
  type StorageQuarantineItem,
  type StorageQuarantineList,
  type StorageQuarantinePurgeResult,
  type StorageQuarantineRestoreResult,
  type StorageScan,
  type SyncJob,
} from "./api/channels";
import { ChannelConstellation } from "./components/ChannelConstellation";
import { MetricTile } from "./components/MetricTile";
import { QueueFlow } from "./components/QueueFlow";
import {
  backupStats,
  fidelityChecks,
  folderPreview,
  importOptions,
  uploadRhythm,
  type ArchiveMetric,
  type FolderPreviewItem,
  type MetricTone,
  type QueueLane,
  type UploadRhythmDay,
} from "./data/observatory";
import { languages, useI18n, type Language, type TranslationKey } from "./i18n";

const qualityOptions = ["720p", "1080p", "best"];
const DEMO_WORKSPACE_EXTERNAL_ID = "UC_CVN_DEMO_SIGNAL";
type WorkflowStatus = "idle" | "syncing" | "candidates" | "queueing" | "preflight" | "bulk" | "downloading" | "error";
type NavId = "dashboard" | "channels" | "library" | "queue" | "insights" | "settings";

const navItems: { key: TranslationKey; id: NavId }[] = [
  { key: "nav.dashboard", id: "dashboard" },
  { key: "nav.channels", id: "channels" },
  { key: "nav.library", id: "library" },
  { key: "nav.queue", id: "queue" },
  { key: "nav.insights", id: "insights" },
  { key: "nav.settings", id: "settings" },
];

type ChannelDetailTab = "overview" | "downloads" | "library" | "logs" | "policy";
type WorkerHistoryFilter = "all" | "failed" | "dry_run" | "live";
type ArchiveEventFilter = "all" | "download" | "sync" | "library" | "storage" | "runtime" | "policy" | "failure";
type SchedulerTickStatusFilter = "all" | "completed" | "failed" | "skipped" | "running";
type SchedulerDurationFilter = "all" | "slow";
type AuditExportFormat = "ndjson" | "csv";
type RetentionStatus = "idle" | "pruning" | "pruned" | "error";
type StorageDriftActionStatus = "idle" | "running" | "done" | "error";
type CopyStatus = "idle" | "copied" | "error";
type QueueStatusFilter = "launchable" | "all" | "candidate" | "queued" | "running" | "failed" | "cancelled";
type QueuePreflightFilter = "all" | "ready" | "review" | "unchecked";
type LibraryIntegrityFilter = "all" | "complete" | "partial_sidecars" | "missing_media" | "media_only";
type LibrarySidecarFilter = "all" | "any" | "subtitles" | "thumbnail" | "nfo";
type LibraryPresetFilter = "missing_subtitles" | "media_only" | "h264_1080p" | "complete_mp4";
type LaunchRunwayState = "ready" | "active" | "locked";
type ReleaseReadinessBriefTone = "ready" | "close" | "building";
type CleanInstallGateStepState = "ready" | "active" | "warn";
type DownloadTelemetryStatus = "running" | "completed" | "failed" | "cancelled";
type EventStreamStatus = "connecting" | "live" | "error" | "closed";
type AppRoute = {
  nav: NavId;
  channelTab?: ChannelDetailTab;
  channelId?: number;
  queueJobIds?: number[];
  runtimeGuide?: boolean;
  eventLog?: boolean;
};
type NavStatusTone = "neutral" | "good" | "active" | "warn" | "bad";
type NavStatusBadge = {
  value: string;
  tone: NavStatusTone;
  label: string;
};
type ReleaseReadinessItem = {
  id: string;
  icon: typeof Link2;
  ready: boolean;
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  actionKey: TranslationKey;
  action: () => void;
};
type CleanInstallGateStep = {
  id: string;
  icon: typeof Link2;
  state: CleanInstallGateStepState;
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  actionKey: TranslationKey;
  disabled?: boolean;
  action: () => void | Promise<void>;
};
type RuntimeGuideRailItem = {
  id: string;
  icon: typeof Link2;
  labelKey: TranslationKey;
  detail: string;
  selector: string;
  tone: NavStatusTone;
};
type VolumeMountPreset = {
  id: string;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  envKey: string;
  hostPath: string;
  containerPath: string;
  tone: "good" | "warn" | "idle";
};
type BackupRestoreCommandId = "quiesced" | "sqlite" | "restore";
type BackupRestorePathCard = {
  id: "metadata" | "download" | "runtime";
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  path: MountDoctorPath | null;
  displayPath: string;
  tone: "good" | "warn" | "bad";
};
type ExposureProxyPreset = {
  id: string;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  badgeKey: TranslationKey;
  target: string;
  snippet: string;
};
type DownloadTelemetry = {
  jobId: number;
  videoId: number | null;
  videoTitle: string;
  channelId: number | null;
  channelTitle: string | null;
  archiveDir: string | null;
  quality: string | null;
  percent: number;
  speed: string | null;
  eta: string | null;
  status: DownloadTelemetryStatus;
  error: string | null;
  updatedAt: string;
};
type SavedLibraryView = {
  id: string;
  name: string;
  query: string;
  integrity: LibraryIntegrityFilter;
  sidecar: LibrarySidecarFilter;
  codec: string;
  createdAt: string;
  updatedAt: string;
};
const savedLibraryViewsStorageKey = "channel-vault-library-views";
const archiveTxtDraftStorageKey = "channel-vault-archive-txt-draft";
const archiveTxtDefaultDraft = "youtube 6lXl1hkEgcA\nhttps://youtu.be/M0IXseVAxw8\nyoutube 6lXl1hkEgcA";
const archiveTxtPlaceholderPrefix = "archive.txt import ";
const retentionPresetValues = [100, 200, 500, 1000];
const workerHistoryFilters: { id: WorkerHistoryFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "worker.history.filter.all" },
  { id: "failed", labelKey: "worker.history.filter.failed" },
  { id: "dry_run", labelKey: "worker.history.filter.dryRun" },
  { id: "live", labelKey: "worker.history.filter.live" },
];
const archiveEventFilters: { id: ArchiveEventFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "events.filter.all" },
  { id: "download", labelKey: "events.filter.download" },
  { id: "sync", labelKey: "events.filter.sync" },
  { id: "library", labelKey: "events.filter.library" },
  { id: "storage", labelKey: "events.filter.storage" },
  { id: "runtime", labelKey: "events.filter.runtime" },
  { id: "policy", labelKey: "events.filter.policy" },
  { id: "failure", labelKey: "events.filter.failure" },
];
const channelDetailTabs: { id: ChannelDetailTab; labelKey: TranslationKey; icon: typeof ShieldCheck }[] = [
  { id: "overview", labelKey: "detail.tabs.overview", icon: ShieldCheck },
  { id: "downloads", labelKey: "detail.tabs.downloads", icon: Download },
  { id: "library", labelKey: "detail.tabs.library", icon: BookOpen },
  { id: "logs", labelKey: "detail.tabs.logs", icon: History },
  { id: "policy", labelKey: "detail.tabs.policy", icon: SlidersHorizontal },
];
const schedulerTickStatusFilters: { id: SchedulerTickStatusFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "runtime.ticks.filter.all" },
  { id: "completed", labelKey: "runtime.ticks.completed" },
  { id: "failed", labelKey: "runtime.ticks.failed" },
  { id: "skipped", labelKey: "runtime.ticks.skipped" },
  { id: "running", labelKey: "runtime.ticks.running" },
];
const queueStatusFilters: { id: QueueStatusFilter; labelKey: TranslationKey }[] = [
  { id: "launchable", labelKey: "launch.filter.launchable" },
  { id: "all", labelKey: "launch.filter.all" },
  { id: "candidate", labelKey: "launch.filter.candidate" },
  { id: "queued", labelKey: "launch.filter.queued" },
  { id: "failed", labelKey: "launch.filter.failed" },
  { id: "running", labelKey: "launch.filter.running" },
  { id: "cancelled", labelKey: "launch.filter.cancelled" },
];
const queuePreflightFilters: { id: QueuePreflightFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "launch.preflightFilter.all" },
  { id: "ready", labelKey: "launch.preflightFilter.ready" },
  { id: "review", labelKey: "launch.preflightFilter.review" },
  { id: "unchecked", labelKey: "launch.preflightFilter.unchecked" },
];
const libraryIntegrityFilters: { id: LibraryIntegrityFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "library.filter.all" },
  { id: "complete", labelKey: "library.filter.complete" },
  { id: "partial_sidecars", labelKey: "library.filter.partial" },
  { id: "missing_media", labelKey: "library.filter.missingMedia" },
  { id: "media_only", labelKey: "library.filter.mediaOnly" },
];
const librarySidecarFilters: { id: LibrarySidecarFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "library.filter.all" },
  { id: "any", labelKey: "library.filter.sidecarAny" },
  { id: "subtitles", labelKey: "library.filter.subtitles" },
  { id: "thumbnail", labelKey: "library.filter.thumbnail" },
  { id: "nfo", labelKey: "library.filter.nfo" },
];
const libraryPresetFilters: {
  id: LibraryPresetFilter;
  labelKey: TranslationKey;
  icon: typeof FileCheck2;
  integrity: LibraryIntegrityFilter;
  sidecar: LibrarySidecarFilter;
  codec: string;
}[] = [
  {
    id: "missing_subtitles",
    labelKey: "library.preset.missingSubtitles",
    icon: FileText,
    integrity: "all",
    sidecar: "subtitles",
    codec: "",
  },
  {
    id: "media_only",
    labelKey: "library.preset.mediaOnly",
    icon: Film,
    integrity: "media_only",
    sidecar: "all",
    codec: "",
  },
  {
    id: "h264_1080p",
    labelKey: "library.preset.h2641080",
    icon: Gauge,
    integrity: "all",
    sidecar: "all",
    codec: "h264 1080p",
  },
  {
    id: "complete_mp4",
    labelKey: "library.preset.completeMp4",
    icon: CheckCircle2,
    integrity: "complete",
    sidecar: "all",
    codec: "mp4",
  },
];
type TimelineVideo = {
  id: number | null;
  external_id: string;
  title: string;
  url: string;
  published_at: string | null;
  upload_date: string | null;
  duration_seconds: number | null;
  archive_state: string;
  info_json_path: string | null;
};

type RuntimeDraft = {
  downloadWorkerEnabled: boolean;
  schedulerEnabled: boolean;
  schedulerIntervalSeconds: string;
  schedulerLimit: string;
  metadataSchedulerEnabled: boolean;
  metadataSchedulerIntervalSeconds: string;
  metadataSchedulerLimit: string;
  ytdlpBinary: string;
  ffprobeBinary: string;
};

type RestartAdapterPreset = {
  id: string;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  command: string;
  lines: string[];
};
type CommandPaletteItem = {
  id: string;
  icon: typeof Search;
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  groupKey: TranslationKey;
  keywords: string[];
  disabled?: boolean;
  run: () => void;
};

function App() {
  const { language, setLanguage, t } = useI18n();
  const initialRoute = useMemo(() => readAppRouteFromHash(), []);
  const [activeNavId, setActiveNavId] = useState<NavId>(initialRoute?.nav ?? "dashboard");
  const [sourceValue, setSourceValue] = useState("https://www.youtube.com/@wingnut987s4");
  const [maxQuality, setMaxQuality] = useState("1080p");
  const [audioOnly, setAudioOnly] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [probe, setProbe] = useState<ChannelProbeResult | null>(null);
  const [registration, setRegistration] = useState<ChannelRegistrationResult | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "probing" | "ready" | "committing" | "registered" | "error">("idle");
  const [registrationError, setRegistrationError] = useState("");
  const [channelDetail, setChannelDetail] = useState<ChannelDetail | null>(null);
  const [channelPolicy, setChannelPolicy] = useState<ChannelPolicy | null>(null);
  const [channelVideos, setChannelVideos] = useState<ChannelVideo[]>([]);
  const [channelCoverage, setChannelCoverage] = useState<ChannelCoverage | null>(null);
  const [channelMissingVideos, setChannelMissingVideos] = useState<MissingVideo[]>([]);
  const [channelCadence, setChannelCadence] = useState<ChannelCadence | null>(null);
  const [syncIntervalDraft, setSyncIntervalDraft] = useState("360");
  const [syncIntervalStatus, setSyncIntervalStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
  const [events, setEvents] = useState<ArchiveEvent[]>([]);
  const [eventLogOpen, setEventLogOpen] = useState(initialRoute?.eventLog ?? false);
  const [eventLogRows, setEventLogRows] = useState<ArchiveEvent[]>([]);
  const [eventLogQuery, setEventLogQuery] = useState<ArchiveEventFilters>({});
  const [eventLogScopeLabel, setEventLogScopeLabel] = useState("");
  const [eventLogHighlightId, setEventLogHighlightId] = useState<number | null>(null);
  const [eventLogFilter, setEventLogFilter] = useState<ArchiveEventFilter>("all");
  const [eventLogStatus, setEventLogStatus] = useState<"idle" | "loading" | "error">("idle");
  const [eventLogCopyStatus, setEventLogCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [eventLogRetentionStatus, setEventLogRetentionStatus] = useState<RetentionStatus>("idle");
  const [eventLogRetentionKeep, setEventLogRetentionKeep] = useState("500");
  const [eventDetail, setEventDetail] = useState<ArchiveEvent | null>(null);
  const [eventDetailCopyStatus, setEventDetailCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [eventDetailCurlStatus, setEventDetailCurlStatus] = useState<"idle" | "copied" | "error">("idle");
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authTokenDraft, setAuthTokenDraft] = useState(() => getApiAuthToken());
  const [authMessageKey, setAuthMessageKey] = useState<TranslationKey | "">("");
  const [operationsReadiness, setOperationsReadiness] = useState<OperationsReadiness | null>(null);
  const [operationsStatus, setOperationsStatus] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const [mountDoctor, setMountDoctor] = useState<MountDoctor | null>(null);
  const [mountDoctorStatus, setMountDoctorStatus] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const [demoSeedStatus, setDemoSeedStatus] = useState<"idle" | "loading" | "done" | "skipped" | "error">("idle");
  const [demoClearStatus, setDemoClearStatus] = useState<"idle" | "loading" | "done" | "skipped" | "error">("idle");
  const [topbarRefreshStatus, setTopbarRefreshStatus] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [eventStreamStatus, setEventStreamStatus] = useState<EventStreamStatus>("connecting");
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [storageScan, setStorageScan] = useState<StorageScan | null>(null);
  const [storagePressureTrend, setStoragePressureTrend] = useState<StoragePressureTrend | null>(null);
  const [storagePressureStatus, setStoragePressureStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>("idle");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [preflightPlan, setPreflightPlan] = useState<QueuePreflightPlan | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueStatusFilter, setQueueStatusFilter] = useState<QueueStatusFilter>("launchable");
  const [queuePreflightFilter, setQueuePreflightFilter] = useState<QueuePreflightFilter>("all");
  const [globalDownloadJobs, setGlobalDownloadJobs] = useState<DownloadJob[]>([]);
  const [queueConsoleSearch, setQueueConsoleSearch] = useState("");
  const [queueConsoleStatusFilter, setQueueConsoleStatusFilter] = useState<QueueStatusFilter>("all");
  const [queueConsolePreflightFilter, setQueueConsolePreflightFilter] = useState<QueuePreflightFilter>("all");
  const [queueConsoleChannelFilter, setQueueConsoleChannelFilter] = useState("all");
  const [queueConsoleSelectedJobIds, setQueueConsoleSelectedJobIds] = useState<number[]>([]);
  const [queueConsoleWorkerPlan, setQueueConsoleWorkerPlan] = useState<DownloadWorkerPlan | null>(null);
  const [queueConsoleWorkerRuns, setQueueConsoleWorkerRuns] = useState<DownloadWorkerRunAudit[]>([]);
  const [queueConsoleStatus, setQueueConsoleStatus] = useState<"idle" | "loading" | "bulk" | "worker" | "error">("idle");
  const [queueConsoleConfirmOpen, setQueueConsoleConfirmOpen] = useState(false);
  const [expandedQueueConsoleJobId, setExpandedQueueConsoleJobId] = useState<number | null>(null);
  const [queueConsoleFileMap, setQueueConsoleFileMap] = useState<Record<number, LibraryFile[]>>({});
  const [queueConsoleFileStatus, setQueueConsoleFileStatus] = useState<Record<number, "idle" | "loading" | "error">>({});
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(initialRoute?.channelId ?? null);
  const [selectionSeedKey, setSelectionSeedKey] = useState("");
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryIntegrityFilter, setLibraryIntegrityFilter] = useState<LibraryIntegrityFilter>("all");
  const [librarySidecarFilter, setLibrarySidecarFilter] = useState<LibrarySidecarFilter>("all");
  const [libraryCodecFilter, setLibraryCodecFilter] = useState("");
  const [activeLibraryPreset, setActiveLibraryPreset] = useState<LibraryPresetFilter | null>(null);
  const [savedLibraryViews, setSavedLibraryViews] = useState<SavedLibraryView[]>(() => loadSavedLibraryViews());
  const [activeSavedLibraryViewId, setActiveSavedLibraryViewId] = useState<string | null>(null);
  const [libraryViewNameDraft, setLibraryViewNameDraft] = useState("");
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<LibraryItem | null>(null);
  const [selectedLibraryFiles, setSelectedLibraryFiles] = useState<LibraryFile[]>([]);
  const [libraryDetailStatus, setLibraryDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [storageOrphanKindFilter, setStorageOrphanKindFilter] = useState("all");
  const [storageReportCopyStatus, setStorageReportCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [storageLensCopyStatus, setStorageLensCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [storageLensCommandCopyStatus, setStorageLensCommandCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [storageChannelPressureTrend, setStorageChannelPressureTrend] = useState<StorageChannelPressureTrend | null>(null);
  const [storageFocusPath, setStorageFocusPath] = useState("");
  const [storageDriftActionStatus, setStorageDriftActionStatus] = useState<Record<string, StorageDriftActionStatus>>({});
  const [selectedStorageDriftItem, setSelectedStorageDriftItem] = useState<StorageDriftItem | null>(null);
  const [storageDriftPreview, setStorageDriftPreview] = useState<StorageDriftActionResult | null>(null);
  const [storageDriftPreviewStatus, setStorageDriftPreviewStatus] = useState<"idle" | "planning" | "running" | "done" | "error">("idle");
  const [selectedStorageOrphan, setSelectedStorageOrphan] = useState<StorageOrphanSidecar | null>(null);
  const [storageOrphanQuarantinePlan, setStorageOrphanQuarantinePlan] = useState<StorageOrphanQuarantineResult | null>(null);
  const [storageOrphanQuarantineStatus, setStorageOrphanQuarantineStatus] = useState<"idle" | "planning" | "running" | "done" | "error">("idle");
  const [storageQuarantineOpen, setStorageQuarantineOpen] = useState(false);
  const [storageQuarantine, setStorageQuarantine] = useState<StorageQuarantineList | null>(null);
  const [storageQuarantineStatus, setStorageQuarantineStatus] = useState<"idle" | "loading" | "planning" | "running" | "done" | "error">("idle");
  const [selectedStorageQuarantineItem, setSelectedStorageQuarantineItem] = useState<StorageQuarantineItem | null>(null);
  const [storageQuarantineRestorePlan, setStorageQuarantineRestorePlan] = useState<StorageQuarantineRestoreResult | null>(null);
  const [storageQuarantinePurgeAge, setStorageQuarantinePurgeAge] = useState("30");
  const [storageQuarantinePurgeConfirm, setStorageQuarantinePurgeConfirm] = useState("");
  const [storageQuarantinePurgePlan, setStorageQuarantinePurgePlan] = useState<StorageQuarantinePurgeResult | null>(null);
  const [rescanResult, setRescanResult] = useState<RescanApplyResult | null>(null);
  const [archiveTxtDraft, setArchiveTxtDraft] = useState(() => loadArchiveTxtDraft());
  const [archiveTxtPreview, setArchiveTxtPreview] = useState<ArchiveTxtPreviewResult | null>(null);
  const [archiveTxtStatus, setArchiveTxtStatus] = useState<"idle" | "previewing" | "done" | "error">("idle");
  const [archiveTxtStageStatus, setArchiveTxtStageStatus] = useState<"idle" | "staging" | "done" | "error">("idle");
  const [archiveTxtStageResult, setArchiveTxtStageResult] = useState<ArchiveTxtStageResult | null>(null);
  const [archiveTxtSyncStatus, setArchiveTxtSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [archiveTxtSyncResult, setArchiveTxtSyncResult] = useState<ChannelSyncResult | null>(null);
  const [archiveTxtQueueStatus, setArchiveTxtQueueStatus] = useState<"idle" | "preparing" | "done" | "error">("idle");
  const [archiveTxtRunConfirmOpen, setArchiveTxtRunConfirmOpen] = useState(false);
  const [archiveTxtRunStatus, setArchiveTxtRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [workerPlan, setWorkerPlan] = useState<DownloadWorkerPlan | null>(null);
  const [workerRuns, setWorkerRuns] = useState<DownloadWorkerRunAudit[]>([]);
  const [downloadTelemetry, setDownloadTelemetry] = useState<Record<number, DownloadTelemetry>>({});
  const [workerHistoryRuns, setWorkerHistoryRuns] = useState<DownloadWorkerRunAudit[]>([]);
  const [workerHistoryOpen, setWorkerHistoryOpen] = useState(false);
  const [downloadRunSummaryOpen, setDownloadRunSummaryOpen] = useState(false);
  const [downloadRunSummaryCopyStatus, setDownloadRunSummaryCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [workerHistoryFilter, setWorkerHistoryFilter] = useState<WorkerHistoryFilter>("all");
  const [schedulerTickDrawerOpen, setSchedulerTickDrawerOpen] = useState(false);
  const [schedulerTickRows, setSchedulerTickRows] = useState<SchedulerTick[]>([]);
  const [schedulerTickStatusFilter, setSchedulerTickStatusFilter] = useState<SchedulerTickStatusFilter>("all");
  const [schedulerDurationFilter, setSchedulerDurationFilter] = useState<SchedulerDurationFilter>("all");
  const [schedulerIntervalFilter, setSchedulerIntervalFilter] = useState("");
  const [schedulerLimitFilter, setSchedulerLimitFilter] = useState("");
  const [schedulerRetentionKeep, setSchedulerRetentionKeep] = useState("200");
  const [metadataTickDrawerOpen, setMetadataTickDrawerOpen] = useState(false);
  const [metadataTickRows, setMetadataTickRows] = useState<MetadataSyncTick[]>([]);
  const [metadataTickStatusFilter, setMetadataTickStatusFilter] = useState<SchedulerTickStatusFilter>("all");
  const [metadataDurationFilter, setMetadataDurationFilter] = useState<SchedulerDurationFilter>("all");
  const [metadataIntervalFilter, setMetadataIntervalFilter] = useState("");
  const [metadataLimitFilter, setMetadataLimitFilter] = useState("");
  const [metadataRetentionKeep, setMetadataRetentionKeep] = useState("200");
  const [metadataRunStatus, setMetadataRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [runtimeGuideOpen, setRuntimeGuideOpen] = useState(initialRoute?.runtimeGuide ?? false);
  const [runtimeGuideCopyStatus, setRuntimeGuideCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [runtimeRestartCopyStatus, setRuntimeRestartCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [runtimeVolumeCopyStatus, setRuntimeVolumeCopyStatus] = useState<CopyStatus>("idle");
  const [runtimeBackupCopyStatus, setRuntimeBackupCopyStatus] = useState<{
    id: BackupRestoreCommandId;
    status: CopyStatus;
  } | null>(null);
  const [runtimeProxyCopyStatus, setRuntimeProxyCopyStatus] = useState<{
    id: string;
    status: CopyStatus;
  } | null>(null);
  const [runtimeDeploymentSmokeCopyStatus, setRuntimeDeploymentSmokeCopyStatus] = useState<CopyStatus>("idle");
  const [launchCommandCopyStatus, setLaunchCommandCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [schedulerTickCopyStatus, setSchedulerTickCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [metadataTickCopyStatus, setMetadataTickCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [supportBundleCopyStatus, setSupportBundleCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [betaBriefCopyStatus, setBetaBriefCopyStatus] = useState<CopyStatus>("idle");
  const [betaProofCopyStatus, setBetaProofCopyStatus] = useState<CopyStatus>("idle");
  const [supportBundleSource, setSupportBundleSource] = useState<"idle" | "server" | "fallback">("idle");
  const [schedulerTickRetentionStatus, setSchedulerTickRetentionStatus] = useState<RetentionStatus>("idle");
  const [metadataTickRetentionStatus, setMetadataTickRetentionStatus] = useState<RetentionStatus>("idle");
  const [runtimeRestartStatus, setRuntimeRestartStatus] = useState<"idle" | "requesting" | "requested" | "manual" | "error">("idle");
  const [runtimeRestartMessage, setRuntimeRestartMessage] = useState("");
  const [runtimeRestartEvents, setRuntimeRestartEvents] = useState<ArchiveEvent[]>([]);
  const [runtimeRestartEventsStatus, setRuntimeRestartEventsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [runtimeRestartPresetCopyStatus, setRuntimeRestartPresetCopyStatus] = useState<{
    id: string;
    status: "copied" | "error";
  } | null>(null);
  const [runtimeComposeSmokeCopyStatus, setRuntimeComposeSmokeCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [accessTokenValue, setAccessTokenValue] = useState("");
  const [accessTokenRevealed, setAccessTokenRevealed] = useState(false);
  const [accessTokenRotate, setAccessTokenRotate] = useState(false);
  const [accessTokenCopyStatus, setAccessTokenCopyStatus] = useState<{
    id: "token" | "env" | "smoke";
    status: CopyStatus;
  } | null>(null);
  const [runtimeApplyStatus, setRuntimeApplyStatus] = useState<"idle" | "applying" | "saved" | "error">("idle");
  const [runtimeApplyMessage, setRuntimeApplyMessage] = useState("");
  const [runtimeDraft, setRuntimeDraft] = useState<RuntimeDraft>(() => defaultRuntimeDraft());
  const [runtimeClockNow, setRuntimeClockNow] = useState(() => Date.now());
  const [activeChannelTab, setActiveChannelTab] = useState<ChannelDetailTab>(
    initialRoute?.channelTab ?? (initialRoute?.nav === "library" ? "library" : "overview"),
  );
  const [liveDownloadConfirmOpen, setLiveDownloadConfirmOpen] = useState(false);
  const [liveDownloadStatus, setLiveDownloadStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const registeredChannelIdRef = useRef<number | null>(null);
  const applyingRouteHashRef = useRef(false);
  const librarySearchInputRef = useRef<HTMLInputElement | null>(null);
  const accessGuardRef = useRef<HTMLDivElement | null>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setCommandPaletteQuery("");
        window.setTimeout(() => commandPaletteInputRef.current?.focus(), 0);
        return;
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    window.setTimeout(() => commandPaletteInputRef.current?.focus(), 0);
  }, [commandPaletteOpen]);

  const activeProbe = registration?.probe ?? probe;
  const registeredChannelId = registration?.channel.id ?? activeProbe?.existing_channel_id ?? selectedChannelId;
  const activeTitle = channelDetail?.title ?? activeProbe?.title ?? "wingnut987S";
  const activeHandle = channelDetail?.handle ?? activeProbe?.handle ?? "@wingnut987s4";
  const activeExternalId = channelDetail?.external_id ?? activeProbe?.external_id ?? "UCmLADXQtWVuzOnOK5TNrWaw";
  const isDemoWorkspace = channelDetail?.external_id === DEMO_WORKSPACE_EXTERNAL_ID;
  const activeInitials = getInitials(activeTitle);
  const activeCounts = channelDetail ?? registration?.channel;
  const activeArchivedCount = library?.archived ?? activeCounts?.archived_count ?? 0;
  const activeMissingCount = library?.missing ?? activeCounts?.missing_count ?? 0;
  const activeBackupStats = activeCounts
    ? [
        { labelKey: "backup.total.label" as TranslationKey, value: String(activeCounts.video_count), detailKey: "backup.total.detail" as TranslationKey },
        { labelKey: "backup.archived.label" as TranslationKey, value: String(activeArchivedCount), detailKey: "backup.archived.detail" as TranslationKey },
        { labelKey: "backup.missing.label" as TranslationKey, value: String(activeMissingCount), detailKey: "backup.missing.detail" as TranslationKey },
        { labelKey: "backup.removedSaved.label" as TranslationKey, value: String(channelDetail?.removed_saved_count ?? 0), detailKey: "backup.removedSaved.detail" as TranslationKey },
      ]
    : activeProbe
      ? [
          { labelKey: "backup.total.label" as TranslationKey, value: String(activeProbe.video_count), detailKey: "backup.total.detail" as TranslationKey },
          { labelKey: "backup.archived.label" as TranslationKey, value: "0", detailKey: "backup.archived.detail" as TranslationKey },
          { labelKey: "backup.missing.label" as TranslationKey, value: String(activeProbe.video_count), detailKey: "backup.missing.detail" as TranslationKey },
          { labelKey: "backup.removedSaved.label" as TranslationKey, value: "0", detailKey: "backup.removedSaved.detail" as TranslationKey },
        ]
    : backupStats;
  const activeFolderRows = useMemo(
    () => buildFolderRows(activeProbe) ?? buildRegisteredFolderRows(channelDetail, channelVideos) ?? folderPreview,
    [activeProbe, channelDetail, channelVideos],
  );
  const activeFolderRoot = activeProbe
    ? buildFolderRoot(activeProbe)
    : buildRegisteredFolderRoot(channelDetail, channelVideos) ?? "/downfolder/channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2022";
  const activeChannels = useMemo(
    () => {
      if (dashboard?.channels.length) {
        return dashboard.channels.map((channel) => ({
          id: channel.id,
          title: channel.title,
          health: channel.health,
          storageGb: Math.max(1, Math.round(channel.storage_gb)),
          newVideos: channel.new_videos,
          failedJobs: channel.failed_jobs,
          group: channel.group,
        }));
      }

      if (registeredChannelId || registration || activeProbe) {
        return [
          {
            id: registeredChannelId ? String(registeredChannelId) : "preview-source",
            title: activeTitle,
            health: registration ? 100 : activeProbe ? 82 : 72,
            storageGb: activeProbe ? Math.max(1, Math.round(activeProbe.storage_forecast.estimated_bytes / 1024 ** 3)) : 0,
            newVideos: activeProbe?.video_count ?? activeMissingCount,
            failedJobs: 0,
            group: "local",
          },
        ];
      }

      return [];
    },
    [activeMissingCount, activeProbe, activeTitle, dashboard, registeredChannelId, registration],
  );
  const channelSwitcherOptions = useMemo(() => {
    const channels = new Map<number, { id: number; title: string; detail: string }>();
    dashboard?.channels.forEach((channel) => {
      const channelId = parseDashboardChannelId(channel.id);
      if (!Number.isFinite(channelId)) return;
      channels.set(channelId, {
        id: channelId,
        title: channel.title,
        detail: `${channel.new_videos} ${t("metrics.newVideos.label")} · ${channel.failed_jobs} ${t("queue.failed")}`,
      });
    });
    if (registeredChannelId && !channels.has(registeredChannelId)) {
      channels.set(registeredChannelId, {
        id: registeredChannelId,
        title: activeTitle,
        detail: activeHandle ?? activeExternalId,
      });
    }
    return Array.from(channels.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [activeExternalId, activeHandle, activeTitle, dashboard, registeredChannelId, t]);
  const activeChannelContextDetail = registeredChannelId
    ? `${activeArchivedCount}/${activeCounts?.video_count ?? channelVideos.length} · ${activeMissingCount} ${t("backup.missing.label")}`
    : t("channel.switcher.noChannel");
  const currentAppRoute = useMemo<AppRoute>(() => {
    const queueJobIds =
      activeNavId === "queue"
        ? Array.from(
            new Set(
              [...queueConsoleSelectedJobIds, expandedQueueConsoleJobId]
                .filter((jobId): jobId is number => typeof jobId === "number" && Number.isFinite(jobId)),
            ),
          )
        : undefined;
    return {
      nav: activeNavId,
      channelTab: activeNavId === "channels" ? activeChannelTab : undefined,
      channelId: registeredChannelId ?? undefined,
      queueJobIds: queueJobIds?.length ? queueJobIds : undefined,
      runtimeGuide: activeNavId === "settings" && runtimeGuideOpen,
      eventLog: eventLogOpen,
    };
  }, [activeChannelTab, activeNavId, eventLogOpen, expandedQueueConsoleJobId, queueConsoleSelectedJobIds, registeredChannelId, runtimeGuideOpen]);

  useEffect(() => {
    if (applyingRouteHashRef.current) return;
    writeAppHash(currentAppRoute, "replace");
  }, [currentAppRoute]);

  useEffect(() => {
    function applyRouteFromHash() {
      const route = readAppRouteFromHash();
      if (!route) return;
      applyingRouteHashRef.current = true;
      setActiveNavId(route.nav);
      if (route.nav === "channels") {
        setActiveChannelTab(route.channelTab ?? "overview");
      } else if (route.nav === "library") {
        setActiveChannelTab("library");
      }
      if (route.channelId) {
        setSelectedChannelId(route.channelId);
        if (route.nav === "queue") {
          setQueueConsoleChannelFilter(String(route.channelId));
        }
      }
      if (route.nav === "queue" && route.queueJobIds?.length) {
        setQueueConsoleSelectedJobIds(route.queueJobIds);
        setExpandedQueueConsoleJobId(route.queueJobIds[0]);
      }
      if (route.runtimeGuide && route.nav === "settings") {
        void handleOpenRuntimeGuide();
      }
      if (route.eventLog) {
        void handleOpenEventLog();
      }
      window.setTimeout(() => {
        applyingRouteHashRef.current = false;
      }, 0);
    }

    applyRouteFromHash();
    window.addEventListener("hashchange", applyRouteFromHash);
    window.addEventListener("popstate", applyRouteFromHash);
    return () => {
      window.removeEventListener("hashchange", applyRouteFromHash);
      window.removeEventListener("popstate", applyRouteFromHash);
    };
  }, []);
  const activeLinks = useMemo(() => {
    if (!dashboard?.channels.length) return [];
    const ids = new Set(dashboard.channels.map((channel) => channel.id));
    return dashboard.links
      .filter((link) => ids.has(link.source) && ids.has(link.target))
      .map((link) => ({ source: link.source, target: link.target, weight: link.weight }));
  }, [dashboard]);
  const storageMapChannels = useMemo(
    () =>
      storageScan?.channels.length
        ? storageScan.channels.map((channel) => ({
            id: channel.relative_path,
            title: channel.title,
            storageGb: Math.max(1, channel.pressure_score),
            label: channel.label,
            mediaCount: channel.media_count,
            orphanSidecars: channel.orphan_sidecar_count,
            warn: channel.orphan_sidecar_count > 0 || channel.pressure_score > 65,
          }))
        : activeChannels.map((channel) => ({
            id: channel.id,
            title: channel.title,
            storageGb: channel.storageGb,
            label: `${channel.storageGb} ${t("unit.gb")}`,
            mediaCount: 0,
            orphanSidecars: 0,
            warn: channel.health < 85,
          })),
    [activeChannels, storageScan, t],
  );
  const storageVolume = storageScan?.volume ?? null;
  const storageDrift = storageScan?.drift ?? {
    unindexed_media_count: 0,
    indexed_missing_count: 0,
    unindexed_media: [],
    indexed_missing: [],
  };
  const storageDriftTotal = storageDrift.unindexed_media_count + storageDrift.indexed_missing_count;
  const storageArchivePercent =
    storageVolume && storageVolume.total_bytes > 0
      ? Math.min(100, Math.max(1, Math.round((storageVolume.archive_bytes / storageVolume.total_bytes) * 100)))
      : 0;
  const storageExtensionMaxBytes = useMemo(
    () => Math.max(1, ...(storageScan?.top_extensions.map((extension) => extension.bytes) ?? [0])),
    [storageScan],
  );
  const storageFolderMaxBytes = useMemo(
    () => Math.max(1, ...(storageScan?.folder_tree.map((node) => node.bytes) ?? [0])),
    [storageScan],
  );
  const storageOrphanBytesLabel = useMemo(
    () => formatBytes(storageScan?.orphan_sidecars.reduce((sum, sidecar) => sum + sidecar.size_bytes, 0) ?? 0),
    [storageScan],
  );
  const storageOrphanKindSummary = useMemo(() => {
    if (!storageScan?.orphan_sidecars.length) return t("storage.triage.none");
    const counts = storageScan.orphan_sidecars.reduce<Record<string, number>>((summary, sidecar) => {
      summary[sidecar.kind] = (summary[sidecar.kind] ?? 0) + 1;
      return summary;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(" · ");
  }, [storageScan, t]);
  const storageOrphanKinds = useMemo(() => {
    const kinds = new Set(storageScan?.orphan_sidecars.map((sidecar) => sidecar.kind) ?? []);
    return ["all", ...Array.from(kinds).sort()];
  }, [storageScan]);
  const filteredStorageOrphans = useMemo(() => {
    const orphans = storageScan?.orphan_sidecars ?? [];
    if (storageOrphanKindFilter === "all") return orphans;
    return orphans.filter((sidecar) => sidecar.kind === storageOrphanKindFilter);
  }, [storageOrphanKindFilter, storageScan]);
  const storagePressureLeader = useMemo(
    () => [...(storageScan?.channels ?? [])].sort((a, b) => b.pressure_score - a.pressure_score)[0] ?? null,
    [storageScan],
  );
  const storageTriageMode = storageDriftTotal
    ? t("storage.triage.mode.rescan")
    : storageScan?.orphan_sidecars.length
      ? t("storage.triage.mode.sidecars")
      : t("storage.triage.mode.clean");
  const storageReportRows = useMemo(() => buildStorageReportRows(storageScan), [storageScan]);
  const storagePressurePeakBytes = useMemo(
    () => Math.max(1, ...(storagePressureTrend?.snapshots.map((snapshot) => snapshot.archive_bytes) ?? [0])),
    [storagePressureTrend],
  );
  const storagePressureLatest = storagePressureTrend?.latest ?? null;
  const storagePressureSnapshotCount = storagePressureTrend?.snapshots.length ?? 0;
  const activeStorageChannel = useMemo(() => {
    const handleNeedle = activeHandle?.toLowerCase();
    const externalNeedle = activeExternalId?.toLowerCase();
    const titleNeedle = activeTitle.toLowerCase();
    return (
      storageScan?.channels.find((channel) => {
        const haystack = `${channel.title} ${channel.relative_path}`.toLowerCase();
        return (
          channel.title.toLowerCase() === titleNeedle ||
          (handleNeedle ? haystack.includes(handleNeedle) : false) ||
          (externalNeedle ? haystack.includes(externalNeedle) : false)
        );
      }) ?? null
    );
  }, [activeExternalId, activeHandle, activeTitle, storageScan]);
  const activeStorageShare =
    storageVolume && activeStorageChannel && storageVolume.archive_bytes > 0
      ? Math.min(100, Math.max(0, Math.round((activeStorageChannel.bytes / storageVolume.archive_bytes) * 100)))
      : 0;
  const activeStoragePath = useMemo(() => {
    if (!storageScan?.volume.root || !activeStorageChannel?.relative_path) return "";
    return `${storageScan.volume.root.replace(/\/$/, "")}/${activeStorageChannel.relative_path}`;
  }, [activeStorageChannel, storageScan]);
  const activeStorageOpenCommand = useMemo(
    () => buildStorageOpenCommand(activeStoragePath, runtimeSettings?.restart_adapter ?? null, t),
    [activeStoragePath, runtimeSettings?.restart_adapter, t],
  );
  const activeStorageHistoryPeakBytes = useMemo(
    () => Math.max(1, storageChannelPressureTrend?.peak_bytes ?? activeStorageChannel?.bytes ?? 0),
    [activeStorageChannel?.bytes, storageChannelPressureTrend],
  );
  const activeStorageGrowthComparisons = storageChannelPressureTrend?.comparisons ?? [];
  const activeStorageGrowthWarning = storageChannelPressureTrend?.warning ?? null;
  const activeStorageDriftRows = useMemo(() => {
    if (!storageScan || !activeStorageChannel) return [];
    const basePath = activeStorageChannel.relative_path.toLowerCase();
    return [...storageScan.drift.unindexed_media, ...storageScan.drift.indexed_missing].filter((item) =>
      item.relative_path.toLowerCase().includes(basePath),
    );
  }, [activeStorageChannel, storageScan]);
  const storageQuarantineRows = useMemo(() => buildStorageQuarantineRows(storageQuarantine), [storageQuarantine]);
  const storageQuarantineAgeSummary = useMemo(
    () => summarizeStorageQuarantineAge(storageQuarantine?.items ?? [], t),
    [storageQuarantine, t],
  );
  const activeTimeline = useMemo<TimelineVideo[]>(
    () =>
      channelVideos.length
        ? channelVideos.map((video) => ({
            id: video.id,
            external_id: video.external_id,
            title: video.title,
            url: video.url,
            published_at: video.published_at,
            upload_date: video.upload_date,
            duration_seconds: video.duration_seconds,
            archive_state: video.archive_state,
            info_json_path: video.info_json_path,
          }))
        : activeProbe?.videos.map((video) => ({
            id: null,
            external_id: video.external_id,
            title: video.title,
            url: video.url,
            published_at: video.published_at,
            upload_date: video.upload_date,
            duration_seconds: video.duration_seconds,
            archive_state: "missing",
            info_json_path: null,
          })) ?? [],
    [activeProbe, channelVideos],
  );
  const activeRhythm = useMemo(() => buildUploadRhythm(activeTimeline, uploadRhythm), [activeTimeline]);
  const latestUploadLabel = channelDetail?.latest_video_published_at
    ? `${t("backup.latest.label")}: ${formatDateLabel(channelDetail.latest_video_published_at)}`
    : t("cadence.latest");
  const cadenceAverageLabel = channelDetail?.avg_upload_interval_days
    ? `${t("metrics.uploadCadence.label")}: ${channelDetail.avg_upload_interval_days}d`
    : t("cadence.next");
  const channelCoveragePercent = channelCoverage?.percent ?? (activeCounts?.video_count ? Math.round((activeArchivedCount / activeCounts.video_count) * 100) : 0);
  const channelCadenceMax = Math.max(1, ...(channelCadence?.buckets.map((bucket) => bucket.count) ?? [0]));
  const syncIntervalNumber = Number(syncIntervalDraft);
  const syncIntervalValid = Number.isInteger(syncIntervalNumber) && syncIntervalNumber >= 5 && syncIntervalNumber <= 10_080;
  const activeQueue = useMemo(
    () => (registeredChannelId ? buildQueueLanes(downloadJobs, workflowStatus === "syncing") : []),
    [downloadJobs, registeredChannelId, workflowStatus],
  );
  const activeMetrics = useMemo<ArchiveMetric[]>(() => {
    if (!dashboard) return [];
    return dashboard.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      detail: metric.detail,
      tone: normalizeMetricTone(metric.tone),
    }));
  }, [dashboard]);
  const activeActivity = useMemo(() => dashboard?.activity ?? [], [dashboard]);
  const renderedActivity = useMemo(
    () =>
      activeActivity.map((item) => ({
            title: item.title,
            channel: item.channel,
            status: item.status,
            time: item.time,
          })),
    [activeActivity],
  );
  const policySubtitleLabel = channelPolicy?.subtitle_languages.length
    ? channelPolicy.subtitle_languages.join(", ")
    : t("policy.none");
  const workerPolicyLabel = channelPolicy?.worker_paused ? t("policy.worker.paused") : t("policy.worker.live");
  const launchableJobs = useMemo(
    () => downloadJobs.filter((job) => job.status === "candidate" || job.status === "queued"),
    [downloadJobs],
  );
  const nextDownloadJobs = useMemo(
    () => downloadJobs.filter((job) => job.status === "candidate" || job.status === "queued").slice(0, 5),
    [downloadJobs],
  );
  const archiveSkipCount = Math.max(activeArchivedCount, downloadJobs.filter((job) => job.status === "completed").length);
  const simpleFlowStats = {
    seen: channelDetail?.video_count ?? channelVideos.length,
    archived: archiveSkipCount,
    fresh: Math.max(activeMissingCount, 0),
    queued: downloadJobs.filter((job) => job.status === "queued").length,
    running: downloadJobs.filter((job) => job.status === "running").length,
  };
  const archiveTxtStageableCount = (archiveTxtPreview?.known_missing_count ?? 0) + (archiveTxtPreview?.unknown_count ?? 0);
  const archiveTxtDraftLineCount = archiveTxtDraft.split(/\r?\n/).filter((line) => line.trim()).length;
  const archiveTxtStagedVideoRows = useMemo(() => {
    if (!archiveTxtStageResult?.video_ids.length) {
      return { enriched: [] as ChannelVideo[], pending: [] as ChannelVideo[], rows: [] as ChannelVideo[] };
    }
    const stagedIds = new Set(archiveTxtStageResult.video_ids);
    const rows = channelVideos.filter((video) => stagedIds.has(video.id));
    return {
      rows,
      enriched: rows.filter((video) => !video.title.startsWith(archiveTxtPlaceholderPrefix)),
      pending: rows.filter((video) => video.title.startsWith(archiveTxtPlaceholderPrefix)),
    };
  }, [archiveTxtStageResult, channelVideos]);
  const archiveTxtWizardStepIndex = archiveTxtStageResult
    ? 3
    : archiveTxtPreview
      ? 2
      : archiveTxtDraft.trim()
        ? 1
        : 0;
  const archiveTxtRunJobIds = useMemo(() => archiveTxtStageResult?.job_ids.slice(0, 5) ?? [], [archiveTxtStageResult]);
  const archiveTxtRunJobs = useMemo(() => {
    if (!archiveTxtRunJobIds.length) return [];
    const jobIds = new Set(archiveTxtRunJobIds);
    return downloadJobs.filter((job) => jobIds.has(job.id)).slice(0, 5);
  }, [archiveTxtRunJobIds, downloadJobs]);
  const archiveTxtRunLimit = archiveTxtRunJobIds.length;
  const archiveTxtRunBlocked =
    !workerPlan?.enabled || Boolean(workerPlan?.locked_reason) || archiveTxtRunLimit === 0 || archiveTxtRunStatus === "running";
  const liveRunLimit = Math.min(5, Math.max(workerPlan?.claimable_count ?? 0, nextDownloadJobs.length, activeMissingCount));
  const liveDownloadBlocked =
    !workerPlan?.enabled || Boolean(workerPlan?.locked_reason) || liveRunLimit === 0 || liveDownloadStatus === "running";
  const actionableQueueJobs = useMemo(() => downloadJobs.filter(isSelectableQueueJob), [downloadJobs]);
  const preflightPlanStatusByJobId = useMemo(() => {
    const statuses = new Map<number, string>();
    preflightPlan?.ready_job_ids.forEach((id) => statuses.set(id, "ready"));
    preflightPlan?.review_job_ids.forEach((id) => statuses.set(id, "review"));
    return statuses;
  }, [preflightPlan]);
  const queueRadar = useMemo(
    () => ({
      total: downloadJobs.length,
      review: downloadJobs.filter((job) => effectivePreflightStatus(job, preflightPlanStatusByJobId) === "review").length,
      retry: downloadJobs.filter((job) => job.status === "failed" || job.status === "cancelled").length,
      running: downloadJobs.filter((job) => job.status === "running").length,
    }),
    [downloadJobs, preflightPlanStatusByJobId],
  );
  const preflightFilterCounts = useMemo(
    () => ({
      all: downloadJobs.length,
      ready: downloadJobs.filter((job) => effectivePreflightStatus(job, preflightPlanStatusByJobId) === "ready").length,
      review: downloadJobs.filter((job) => effectivePreflightStatus(job, preflightPlanStatusByJobId) === "review").length,
      unchecked: downloadJobs.filter((job) => effectivePreflightStatus(job, preflightPlanStatusByJobId) === "unchecked").length,
    }),
    [downloadJobs, preflightPlanStatusByJobId],
  );
  const runningJobs = useMemo(() => downloadJobs.filter((job) => job.status === "running"), [downloadJobs]);
  const runningWorkerJobs = useMemo(
    () => (workerPlan?.running_jobs.length ? workerPlan.running_jobs.map((item) => item.job) : runningJobs),
    [runningJobs, workerPlan],
  );
  const archiveTxtSummaryJobIds = useMemo(() => new Set(archiveTxtStageResult?.job_ids ?? []), [archiveTxtStageResult]);
  const archiveTxtSummaryJobs = useMemo(
    () => downloadJobs.filter((job) => archiveTxtSummaryJobIds.has(job.id)),
    [archiveTxtSummaryJobIds, downloadJobs],
  );
  const latestWorkerRun = workerRuns[0] ?? null;
  const latestWorkerAuditJobIds = useMemo(
    () => {
      const startedIds = latestWorkerRun?.started_job_ids ?? [];
      const plannedIds = latestWorkerRun?.planned_job_ids ?? [];
      return new Set(startedIds.length ? startedIds : plannedIds);
    },
    [latestWorkerRun],
  );
  const latestWorkerCompletedJobIds = useMemo(() => new Set(latestWorkerRun?.completed_job_ids ?? []), [latestWorkerRun]);
  const latestWorkerFailedJobIds = useMemo(() => new Set(latestWorkerRun?.failed_job_ids ?? []), [latestWorkerRun]);
  const latestWorkerJobs = useMemo(
    () =>
      latestWorkerAuditJobIds.size
        ? downloadJobs.filter((job) => latestWorkerAuditJobIds.has(job.id))
        : downloadJobs.filter((job) => archiveTxtSummaryJobIds.has(job.id)),
    [archiveTxtSummaryJobIds, downloadJobs, latestWorkerAuditJobIds],
  );
  const recentCompletedJobs = useMemo(
    () =>
      latestWorkerCompletedJobIds.size
        ? downloadJobs.filter((job) => latestWorkerCompletedJobIds.has(job.id))
        : downloadJobs.filter((job) => job.status === "completed"),
    [downloadJobs, latestWorkerCompletedJobIds],
  );
  const recentCompletedVideoIds = useMemo(() => new Set(recentCompletedJobs.map((job) => job.video_id)), [recentCompletedJobs]);
  const recentArchivedLibraryItems = useMemo(
    () =>
      recentCompletedVideoIds.size
        ? (library?.items ?? []).filter((item) => recentCompletedVideoIds.has(item.id))
        : (library?.items ?? []).filter((item) => item.archive_state === "archived" || item.media_count > 0),
    [library, recentCompletedVideoIds],
  );
  const telemetryByJobId = useMemo(
    () => new Map(Object.values(downloadTelemetry).map((item) => [item.jobId, item])),
    [downloadTelemetry],
  );
  const visibleDownloadTelemetry = useMemo(() => {
    const jobIds = new Set(downloadJobs.map((job) => job.id));
    return Object.values(downloadTelemetry)
      .filter((item) => jobIds.has(item.jobId) || item.channelId === registeredChannelId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [downloadJobs, downloadTelemetry, registeredChannelId]);
  const activeDownloadTelemetry = useMemo(() => {
    const fromRunningJobs = runningWorkerJobs.map((job) => {
      const existing = telemetryByJobId.get(job.id);
      return (
        existing ?? {
          jobId: job.id,
          videoId: job.video_id,
          videoTitle: job.video_title,
          channelId: job.channel_id,
          channelTitle: job.channel_title,
          archiveDir: job.archive_path,
          quality: job.quality,
          percent: job.progress,
          speed: null,
          eta: null,
          status: "running" as DownloadTelemetryStatus,
          error: null,
          updatedAt: job.updated_at,
        }
      );
    });
    const fromEvents = visibleDownloadTelemetry.filter((item) => item.status === "running");
    return dedupeDownloadTelemetry([...fromRunningJobs, ...fromEvents]).slice(0, 5);
  }, [runningWorkerJobs, telemetryByJobId, visibleDownloadTelemetry]);
  const latestDownloadTelemetry = activeDownloadTelemetry[0] ?? visibleDownloadTelemetry[0] ?? null;
  const liveActiveJobCount = Math.max(simpleFlowStats.running, activeDownloadTelemetry.length);
  const workerHistorySummary = useMemo(
    () => ({
      total: workerHistoryRuns.length,
      failed: workerHistoryRuns.filter((run) => run.status === "failed" || run.failed_count > 0).length,
      live: workerHistoryRuns.filter((run) => !run.dry_run).length,
      dryRun: workerHistoryRuns.filter((run) => run.dry_run).length,
    }),
    [workerHistoryRuns],
  );
  const launchableJobKey = useMemo(() => launchableJobs.map((job) => job.id).join(","), [launchableJobs]);
  const filteredLaunchJobs = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    const statusFiltered =
      queueStatusFilter === "launchable"
        ? actionableQueueJobs
        : queueStatusFilter === "all"
          ? downloadJobs
          : downloadJobs.filter((job) => job.status === queueStatusFilter);
    const preflightFiltered =
      queuePreflightFilter === "all"
        ? statusFiltered
        : statusFiltered.filter((job) => effectivePreflightStatus(job, preflightPlanStatusByJobId) === queuePreflightFilter);
    if (!query) return preflightFiltered;
    return preflightFiltered.filter((job) =>
      [job.video_title, job.video_external_id, job.channel_title, job.quality, job.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [actionableQueueJobs, downloadJobs, preflightPlanStatusByJobId, queuePreflightFilter, queueSearch, queueStatusFilter]);
  const visibleActionableJobs = useMemo(() => filteredLaunchJobs.filter(isSelectableQueueJob), [filteredLaunchJobs]);
  const selectedJobs = useMemo(
    () => actionableQueueJobs.filter((job) => selectedJobIds.includes(job.id)),
    [actionableQueueJobs, selectedJobIds],
  );
  const selectedRetryableCount = selectedJobs.filter((job) => job.status === "failed" || job.status === "cancelled").length;
  const selectedCandidateCount = selectedJobs.filter((job) => job.status === "candidate").length;
  const selectedQueuedCount = selectedJobs.filter((job) => job.status === "queued").length;
  const selectedReviewCount = selectedJobs.filter((job) => effectivePreflightStatus(job, preflightPlanStatusByJobId) === "review").length;
  const selectedBytesLabel = useMemo(
    () => formatBytes(selectedJobs.reduce((sum, job) => sum + (job.estimated_bytes ?? 0), 0)),
    [selectedJobs],
  );
  const launchableBytesLabel = useMemo(
    () => formatBytes(launchableJobs.reduce((sum, job) => sum + (job.estimated_bytes ?? 0), 0)),
    [launchableJobs],
  );
  const launchEstimateLabel = selectedJobs.length ? selectedBytesLabel : launchableBytesLabel;
  const preflightReadyCount = preflightPlan?.ready_job_ids.length ?? 0;
  const preflightReviewCount = preflightPlan?.review_job_ids.length ?? 0;
  const launchCommandManifest = useMemo(() => preflightPlan?.command_preview.join("\n") ?? "", [preflightPlan]);
  const launchRunwayFreeLabel = storageVolume?.free_label ?? "0 MB";
  const allVisibleJobsSelected =
    visibleActionableJobs.length > 0 && visibleActionableJobs.every((job) => selectedJobIds.includes(job.id));
  const queueConsoleChannelOptions = useMemo(() => {
    const channels = new Map<number, string>();
    globalDownloadJobs.forEach((job) => channels.set(job.channel_id, job.channel_title));
    return Array.from(channels, ([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [globalDownloadJobs]);
  const queueConsoleActionableJobs = useMemo(
    () => globalDownloadJobs.filter(isSelectableQueueJob),
    [globalDownloadJobs],
  );
  const filteredQueueConsoleJobs = useMemo(() => {
    const query = queueConsoleSearch.trim().toLowerCase();
    const statusFiltered =
      queueConsoleStatusFilter === "launchable"
        ? queueConsoleActionableJobs
        : queueConsoleStatusFilter === "all"
          ? globalDownloadJobs
          : globalDownloadJobs.filter((job) => job.status === queueConsoleStatusFilter);
    const preflightFiltered =
      queueConsolePreflightFilter === "all"
        ? statusFiltered
        : statusFiltered.filter((job) => job.preflight_status === queueConsolePreflightFilter);
    const channelFiltered =
      queueConsoleChannelFilter === "all"
        ? preflightFiltered
        : preflightFiltered.filter((job) => String(job.channel_id) === queueConsoleChannelFilter);
    if (!query) return channelFiltered;
    return channelFiltered.filter((job) =>
      [job.video_title, job.video_external_id, job.channel_title, job.quality, job.status, job.archive_path ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [
    globalDownloadJobs,
    queueConsoleActionableJobs,
    queueConsoleChannelFilter,
    queueConsolePreflightFilter,
    queueConsoleSearch,
    queueConsoleStatusFilter,
  ]);
  const visibleQueueConsoleActionableJobs = useMemo(
    () => filteredQueueConsoleJobs.filter(isSelectableQueueJob),
    [filteredQueueConsoleJobs],
  );
  const queueConsoleSelectedJobs = useMemo(
    () => queueConsoleActionableJobs.filter((job) => queueConsoleSelectedJobIds.includes(job.id)),
    [queueConsoleActionableJobs, queueConsoleSelectedJobIds],
  );
  const allVisibleQueueConsoleJobsSelected =
    visibleQueueConsoleActionableJobs.length > 0 &&
    visibleQueueConsoleActionableJobs.every((job) => queueConsoleSelectedJobIds.includes(job.id));
  const queueConsoleCounts = useMemo(
    () => ({
      total: globalDownloadJobs.length,
      candidate: globalDownloadJobs.filter((job) => job.status === "candidate").length,
      queued: globalDownloadJobs.filter((job) => job.status === "queued").length,
      running: globalDownloadJobs.filter((job) => job.status === "running").length,
      completed: globalDownloadJobs.filter((job) => job.status === "completed").length,
      failed: globalDownloadJobs.filter((job) => job.status === "failed").length,
      cancelled: globalDownloadJobs.filter((job) => job.status === "cancelled").length,
      review: globalDownloadJobs.filter((job) => job.preflight_status === "review").length,
    }),
    [globalDownloadJobs],
  );
  const queueConsoleSelectedBytesLabel = useMemo(
    () => formatBytes(queueConsoleSelectedJobs.reduce((sum, job) => sum + (job.estimated_bytes ?? 0), 0)),
    [queueConsoleSelectedJobs],
  );
  const queueConsoleRunningJobs = useMemo(
    () =>
      queueConsoleWorkerPlan?.running_jobs.length
        ? queueConsoleWorkerPlan.running_jobs.map((item) => item.job)
        : globalDownloadJobs.filter((job) => job.status === "running"),
    [globalDownloadJobs, queueConsoleWorkerPlan],
  );
  const queueConsoleClaimableIds = useMemo(
    () => new Set((queueConsoleWorkerPlan?.jobs ?? []).map((item) => item.job.id)),
    [queueConsoleWorkerPlan],
  );
  const queueConsoleWorkerPlanByJobId = useMemo(() => {
    const planItems = [...(queueConsoleWorkerPlan?.jobs ?? []), ...(queueConsoleWorkerPlan?.running_jobs ?? [])];
    return new Map(planItems.map((item) => [item.job.id, item]));
  }, [queueConsoleWorkerPlan]);
  const queueConsoleConfirmJobs = queueConsoleWorkerPlan?.jobs.slice(0, 5) ?? [];
  const queueConsoleSkippedCount = Math.max(
    0,
    (queueConsoleWorkerPlan?.queued_count ?? 0) - (queueConsoleWorkerPlan?.claimable_count ?? 0),
  );
  const queueConsoleActiveTelemetry = useMemo(() => {
    const fromRunningJobs = queueConsoleRunningJobs.map((job) => {
      const existing = telemetryByJobId.get(job.id);
      return (
        existing ?? {
          jobId: job.id,
          videoId: job.video_id,
          videoTitle: job.video_title,
          channelId: job.channel_id,
          channelTitle: job.channel_title,
          archiveDir: job.archive_path,
          quality: job.quality,
          percent: job.progress,
          speed: null,
          eta: null,
          status: "running" as DownloadTelemetryStatus,
          error: null,
          updatedAt: job.updated_at,
        }
      );
    });
    const fromEvents = Object.values(downloadTelemetry).filter((item) => item.status === "running");
    return dedupeDownloadTelemetry([...fromRunningJobs, ...fromEvents]).slice(0, 5);
  }, [downloadTelemetry, queueConsoleRunningJobs, telemetryByJobId]);
  const queueConsoleLatestTelemetry = useMemo(
    () =>
      queueConsoleActiveTelemetry[0] ??
      Object.values(downloadTelemetry).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ??
      null,
    [downloadTelemetry, queueConsoleActiveTelemetry],
  );
  const queueConsoleHasActiveFilters =
    queueConsoleSearch.trim().length > 0 ||
    queueConsoleStatusFilter !== "all" ||
    queueConsolePreflightFilter !== "all" ||
    queueConsoleChannelFilter !== "all";
  const queueConsoleClaimBlocked =
    (queueConsoleWorkerPlan?.queued_count ?? queueConsoleCounts.queued) > 0 &&
    ((queueConsoleWorkerPlan?.claimable_count ?? 0) === 0 || Boolean(queueConsoleWorkerPlan?.locked_reason));
  const visibleLibraryItems = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const codec = libraryCodecFilter.trim().toLowerCase();
    const items = library?.items ?? [];
    return items.filter((item) => {
      const matchesQuery =
        !query ||
        [item.title, item.video_external_id, item.channel_title, item.archive_state, item.queue_status ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesIntegrity =
        libraryIntegrityFilter === "all" || item.integrity_state === libraryIntegrityFilter;
      const matchesSidecar =
        librarySidecarFilter === "all" || libraryItemMissingSidecar(item, librarySidecarFilter);
      const codecTokens = codec.split(/\s+/).filter(Boolean);
      const codecHaystack = [item.media_container, item.video_codec, item.audio_codec, item.height ? `${item.height}p` : "", mediaProfileLabel(item)]
        .join(" ")
        .toLowerCase();
      const matchesCodec = codecTokens.length === 0 || codecTokens.every((token) => codecHaystack.includes(token));
      return matchesQuery && matchesIntegrity && matchesSidecar && matchesCodec;
    });
  }, [library, libraryCodecFilter, libraryIntegrityFilter, libraryQuery, librarySidecarFilter]);
  const librarySourceItemCount = library?.items.length ?? 0;
  const libraryHasActiveFilters =
    libraryQuery.trim().length > 0 ||
    libraryIntegrityFilter !== "all" ||
    librarySidecarFilter !== "all" ||
    libraryCodecFilter.trim().length > 0;
  const ytdlpBinary = useMemo(
    () => runtimeSettings?.binaries.find((binary) => binary.name === "yt-dlp") ?? null,
    [runtimeSettings],
  );
  const ffprobeBinary = useMemo(
    () => runtimeSettings?.binaries.find((binary) => binary.name === "ffprobe") ?? null,
    [runtimeSettings],
  );
  const schedulerStatus = runtimeSettings?.scheduler_status ?? null;
  const metadataSchedulerStatus = runtimeSettings?.metadata_scheduler_status ?? null;
  const restartAdapter = runtimeSettings?.restart_adapter ?? null;
  const restartAdapterLabel = restartAdapter ? restartAdapterLabelText(restartAdapter.adapter, t) : t("runtime.checking");
  const restartAdapterDetail = restartAdapter ? restartAdapter.reason : t("runtime.checking");
  const workerRuntimeLabel = !runtimeSettings
    ? t("runtime.checking")
    : runtimeSettings.download_worker_enabled
      ? t("runtime.enabled")
      : t("runtime.disabled");
  const schedulerRuntimeLabel = schedulerStatus ? schedulerStateLabel(schedulerStatus.state, t) : t("runtime.checking");
  const metadataSchedulerRuntimeLabel = metadataSchedulerStatus
    ? schedulerStateLabel(metadataSchedulerStatus.state, t)
    : t("runtime.checking");
  const schedulerCadenceLabel = schedulerStatus
    ? t("runtime.interval").replace("{seconds}", String(schedulerStatus.interval_seconds))
    : t("runtime.checking");
  const schedulerLimitLabel = schedulerStatus
    ? t("runtime.limit").replace("{count}", String(schedulerStatus.limit))
    : t("runtime.checking");
  const metadataSchedulerCadenceLabel = metadataSchedulerStatus
    ? t("runtime.interval").replace("{seconds}", String(metadataSchedulerStatus.interval_seconds))
    : t("runtime.checking");
  const metadataSchedulerLimitLabel = metadataSchedulerStatus
    ? t("runtime.limit").replace("{count}", String(metadataSchedulerStatus.limit))
    : t("runtime.checking");
  const schedulerDetailLabel = schedulerStatus ? schedulerStateDetail(schedulerStatus, t) : t("runtime.checking");
  const metadataSchedulerDetailLabel = metadataSchedulerStatus
    ? metadataSchedulerStateDetail(metadataSchedulerStatus, t)
    : t("runtime.checking");
  const schedulerNextTickLabel = schedulerStatus ? schedulerNextTick(schedulerStatus, t, runtimeClockNow) : t("runtime.checking");
  const schedulerLastTickLabel = schedulerStatus ? schedulerLastTick(schedulerStatus, t) : t("runtime.checking");
  const metadataSchedulerNextTickLabel = metadataSchedulerStatus
    ? metadataSchedulerNextTick(metadataSchedulerStatus, t, runtimeClockNow)
    : t("runtime.checking");
  const metadataSchedulerLastTickLabel = metadataSchedulerStatus
    ? metadataSchedulerLastTick(metadataSchedulerStatus, t)
    : t("runtime.checking");
  const metadataSchedulerDueLabel = metadataSchedulerStatus
    ? t("runtime.metadataScheduler.due").replace("{count}", String(metadataSchedulerStatus.due_channel_count))
    : t("runtime.checking");
  const metadataSchedulerNextDueLabel = metadataSchedulerStatus
    ? formatDateTimeLabel(metadataSchedulerStatus.next_due_at, t("runtime.scheduler.none"))
    : t("runtime.checking");
  const metadataDueChannels = metadataSchedulerStatus?.due_channels ?? [];
  const runtimePendingOverrides = runtimeSettings?.pending_overrides.filter((item) => item.pending_restart) ?? [];
  const runtimeDraftIntervalNumber = Number(runtimeDraft.schedulerIntervalSeconds);
  const runtimeDraftLimitNumber = Number(runtimeDraft.schedulerLimit);
  const runtimeDraftMetadataIntervalNumber = Number(runtimeDraft.metadataSchedulerIntervalSeconds);
  const runtimeDraftMetadataLimitNumber = Number(runtimeDraft.metadataSchedulerLimit);
  const runtimeDraftValid =
    Number.isInteger(runtimeDraftIntervalNumber) &&
    runtimeDraftIntervalNumber >= 5 &&
    Number.isInteger(runtimeDraftLimitNumber) &&
    runtimeDraftLimitNumber >= 1 &&
    runtimeDraftLimitNumber <= 20 &&
    Number.isInteger(runtimeDraftMetadataIntervalNumber) &&
    runtimeDraftMetadataIntervalNumber >= 30 &&
    Number.isInteger(runtimeDraftMetadataLimitNumber) &&
    runtimeDraftMetadataLimitNumber >= 1 &&
    runtimeDraftMetadataLimitNumber <= 20 &&
    runtimeDraft.ytdlpBinary.trim().length > 0 &&
    runtimeDraft.ffprobeBinary.trim().length > 0;
  const binaryStateLabel = (binary: RuntimeSettings["binaries"][number] | null) =>
    !binary ? t("runtime.checking") : binary.available ? t("runtime.available") : t("runtime.missing");
  const binaryDetailLabel = (binary: RuntimeSettings["binaries"][number] | null) =>
    binary ? binary.resolved_path ?? binary.command : t("runtime.checking");
  const runtimeEnvRows = useMemo(
    () => [
      {
        key: "CVN_DOWNLOAD_WORKER_ENABLED",
        value: String(runtimeSettings?.download_worker_enabled ?? false),
        recommended: String(runtimeDraft.downloadWorkerEnabled),
        tone: runtimeDraft.downloadWorkerEnabled ? "good" : "warn",
      },
      {
        key: "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED",
        value: String(runtimeSettings?.download_worker_scheduler_enabled ?? false),
        recommended: String(runtimeDraft.schedulerEnabled),
        tone: runtimeDraft.schedulerEnabled ? "good" : "warn",
      },
      {
        key: "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS",
        value: String(runtimeSettings?.download_worker_scheduler_interval_seconds ?? 300),
        recommended: runtimeDraft.schedulerIntervalSeconds || "300",
        tone: "idle",
      },
      {
        key: "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT",
        value: String(runtimeSettings?.download_worker_scheduler_limit ?? 1),
        recommended: runtimeDraft.schedulerLimit || "1",
        tone: "idle",
      },
      {
        key: "CVN_METADATA_SYNC_SCHEDULER_ENABLED",
        value: String(runtimeSettings?.metadata_sync_scheduler_enabled ?? false),
        recommended: String(runtimeDraft.metadataSchedulerEnabled),
        tone: runtimeDraft.metadataSchedulerEnabled ? "good" : "warn",
      },
      {
        key: "CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS",
        value: String(runtimeSettings?.metadata_sync_scheduler_interval_seconds ?? 900),
        recommended: runtimeDraft.metadataSchedulerIntervalSeconds || "900",
        tone: "idle",
      },
      {
        key: "CVN_METADATA_SYNC_SCHEDULER_LIMIT",
        value: String(runtimeSettings?.metadata_sync_scheduler_limit ?? 2),
        recommended: runtimeDraft.metadataSchedulerLimit || "2",
        tone: "idle",
      },
      {
        key: "CVN_YTDLP_BINARY",
        value: ytdlpBinary?.command ?? "yt-dlp",
        recommended: runtimeDraft.ytdlpBinary || "yt-dlp",
        tone: ytdlpBinary?.available ? "good" : "warn",
      },
      {
        key: "CVN_FFPROBE_BINARY",
        value: ffprobeBinary?.command ?? "ffprobe",
        recommended: runtimeDraft.ffprobeBinary || "ffprobe",
        tone: ffprobeBinary?.available ? "good" : "warn",
      },
    ],
    [ffprobeBinary, runtimeDraft, runtimeSettings, ytdlpBinary],
  );
  const runtimeEnvManifest = useMemo(
    () => runtimeEnvRows.map((row) => `${row.key}=${row.recommended}`).join("\n"),
    [runtimeEnvRows],
  );
  const composeSmokeCommand = useMemo(() => buildComposeSmokeCommand(false), []);
  const composeSmokeFastCommand = useMemo(() => buildComposeSmokeCommand(true), []);
  const runtimeRestartPresets = useMemo(() => restartAdapterPresets(), []);
  const runtimeVolumePresets = useMemo(() => volumeMountPresets(), []);
  const runtimeVolumeEnvManifest = useMemo(() => buildVolumeMountEnvManifest(runtimeVolumePresets), [runtimeVolumePresets]);
  const runtimeVolumeMkdirCommand = useMemo(() => buildVolumeMountMkdirCommand(runtimeVolumePresets), [runtimeVolumePresets]);
  const runtimeBackupRestorePaths = useMemo(
    () => buildBackupRestorePathCards(mountDoctor, runtimeSettings),
    [mountDoctor, runtimeSettings],
  );
  const runtimeBackupRestoreCommands = useMemo(
    () => buildBackupRestoreCommands(mountDoctor, runtimeSettings),
    [mountDoctor, runtimeSettings],
  );
  const runtimeBackupRestoreReady =
    Boolean(mountDoctor) &&
    mountDoctor?.status !== "critical" &&
    runtimeBackupRestorePaths.every((path) => path.tone !== "bad");
  const runtimeExposureProxyPresets = useMemo(() => exposureProxyPresets(), []);
  const schedulerTickSummary = useMemo(
    () => summarizeSchedulerTicks(schedulerTickRows.length ? schedulerTickRows : runtimeSettings?.scheduler_ticks ?? []),
    [runtimeSettings?.scheduler_ticks, schedulerTickRows],
  );
  const schedulerDrawerSummary = useMemo(() => summarizeSchedulerTicks(schedulerTickRows), [schedulerTickRows]);
  const metadataSyncTickSummary = useMemo(
    () => summarizeMetadataSyncTicks(runtimeSettings?.metadata_sync_ticks ?? []),
    [runtimeSettings?.metadata_sync_ticks],
  );
  const metadataDrawerSummary = useMemo(() => summarizeMetadataSyncTicks(metadataTickRows), [metadataTickRows]);
  const latestMetadataSyncTick = runtimeSettings?.metadata_sync_ticks[0] ?? null;
  const eventLogSourceRows = eventLogRows.length ? eventLogRows : events;
  const filteredEventLogRows = useMemo(
    () => eventLogSourceRows.filter((event) => eventMatchesFilter(event, eventLogFilter)),
    [eventLogFilter, eventLogSourceRows],
  );
  const eventLogSummary = useMemo(() => summarizeArchiveEvents(eventLogSourceRows), [eventLogSourceRows]);
  const eventDetailTargetChannelId = eventDetail ? readEventNumber(eventDetail.data, "channel_id") : null;
  const eventDetailTargetJobIds = eventDetail ? readEventNumberList(eventDetail.data, "job_ids") : [];
  const eventDetailTargetJobId = eventDetail ? (readEventNumber(eventDetail.data, "job_id") ?? eventDetailTargetJobIds[0] ?? null) : null;
  const activeSavedLibraryView = useMemo(
    () => savedLibraryViews.find((view) => view.id === activeSavedLibraryViewId) ?? null,
    [activeSavedLibraryViewId, savedLibraryViews],
  );
  const savedLibraryViewName =
    libraryViewNameDraft.trim() || defaultLibraryViewName(libraryIntegrityFilter, librarySidecarFilter, libraryCodecFilter, libraryQuery, t);
  const libraryActiveViewChips = useMemo(
    () => buildLibraryActiveViewChips(libraryQuery, libraryIntegrityFilter, librarySidecarFilter, libraryCodecFilter, t),
    [libraryCodecFilter, libraryIntegrityFilter, libraryQuery, librarySidecarFilter, t],
  );
  const libraryActiveSummary = t("library.active.count")
    .replace("{count}", String(library?.total ?? 0))
    .replace("{bytes}", library?.total_label ?? "0 MB");

  const registrationPayload: ChannelRegistrationPayload = {
    value: sourceValue,
    max_quality: maxQuality,
    audio_only: audioOnly,
    subtitles_enabled: subtitlesEnabled,
    auto_download: false,
    backfill_mode: "all",
  };

  useEffect(() => {
    if (!runtimeGuideOpen && !schedulerStatus?.next_tick_at && !metadataSchedulerStatus?.next_tick_at) return;
    const timer = window.setInterval(() => setRuntimeClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [metadataSchedulerStatus?.next_tick_at, runtimeGuideOpen, schedulerStatus?.next_tick_at]);

  useEffect(() => {
    registeredChannelIdRef.current = registeredChannelId ?? null;
  }, [registeredChannelId]);

  useEffect(() => {
    setLaunchCommandCopyStatus("idle");
  }, [launchCommandManifest]);

  useEffect(() => {
    setSchedulerTickCopyStatus("idle");
  }, [schedulerDurationFilter, schedulerIntervalFilter, schedulerLimitFilter, schedulerTickRows, schedulerTickStatusFilter]);

  useEffect(() => {
    setMetadataTickCopyStatus("idle");
  }, [metadataDurationFilter, metadataIntervalFilter, metadataLimitFilter, metadataTickRows, metadataTickStatusFilter]);

  useEffect(() => {
    if (!runtimeSettings) return;
    setRuntimeDraft(runtimeDraftFromSettings(runtimeSettings));
  }, [runtimeSettings]);

  useEffect(() => {
    if (!channelDetail) return;
    setSyncIntervalDraft(String(channelDetail.sync_interval_minutes));
    setSyncIntervalStatus("idle");
  }, [channelDetail?.id, channelDetail?.sync_interval_minutes]);

  useEffect(() => {
    localStorage.setItem(savedLibraryViewsStorageKey, JSON.stringify(savedLibraryViews));
  }, [savedLibraryViews]);

  useEffect(() => {
    if (archiveTxtDraft.trim()) {
      localStorage.setItem(archiveTxtDraftStorageKey, archiveTxtDraft);
    } else {
      localStorage.removeItem(archiveTxtDraftStorageKey);
    }
  }, [archiveTxtDraft]);

  useEffect(() => {
    let cancelled = false;
    async function loadLibraryViews() {
      try {
        const views = await getLibraryViews();
        if (!cancelled) setSavedLibraryViews(views.map(toSavedLibraryView));
      } catch {
        // Local saved views remain available as an offline fallback.
      }
    }
    void loadLibraryViews();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAuthFailure(error: unknown) {
    const authError = error instanceof ApiAuthError || (error instanceof Error && error.name === "ApiAuthError");
    if (!authError) return false;
    setAuthRequired(true);
    setAuthMessageKey("auth.gate.required");
    setEventStreamStatus("closed");
    return true;
  }

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = authTokenDraft.trim();
    if (!token) {
      setAuthMessageKey("auth.gate.empty");
      return;
    }
    setApiAuthToken(token);
    setAuthRequired(false);
    setAuthMessageKey("auth.gate.saved");
    window.location.reload();
  }

  function handleAuthClear() {
    clearApiAuthToken();
    setAuthTokenDraft("");
    setAuthMessageKey("auth.gate.cleared");
  }

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        const [snapshot, recentEvents, runtimeSnapshot, storageSnapshot, pressureTrend, readinessSnapshot, mountDoctorSnapshot] = await Promise.all([
          getDashboard(),
          getRecentEvents(100),
          getRuntimeSettings(),
          getStorageScan(),
          getStoragePressureTrend(),
          getOperationsReadiness(),
          getMountDoctor(),
        ]);
        const [globalJobs, globalWorkerSnapshot, globalWorkerRunSnapshot] = await Promise.all([
          getDownloadJobs(undefined, { limit: 200 }),
          getDownloadWorkerPlan(undefined, 5),
          getDownloadWorkerRuns(undefined, 8),
        ]);
        if (cancelled) return;
        setDashboard(snapshot);
        setEvents(recentEvents);
        setRuntimeSettings(runtimeSnapshot);
        setStorageScan(storageSnapshot);
        setStoragePressureTrend(pressureTrend);
        setOperationsReadiness(readinessSnapshot);
        setMountDoctor(mountDoctorSnapshot);
        setGlobalDownloadJobs(globalJobs);
        setQueueConsoleWorkerPlan(globalWorkerSnapshot);
        setQueueConsoleWorkerRuns(globalWorkerRunSnapshot);
      } catch (error) {
        if (cancelled) return;
        if (handleAuthFailure(error)) return;
        setDashboard(null);
      }
    }
    loadDashboard();

    const socket = new WebSocket(wsEventsUrl());
    setEventStreamStatus("connecting");
    socket.onopen = () => {
      setEventStreamStatus("live");
    };
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as ArchiveEvent;
        setEventStreamStatus("live");
        setEvents((current) => [event, ...current.filter((item) => item.occurred_at !== event.occurred_at)].slice(0, 100));
        if (event.type.startsWith("runtime.restart")) {
          setRuntimeRestartEvents((current) => [event, ...current.filter((item) => item.occurred_at !== event.occurred_at)].slice(0, 8));
        }
        applyDownloadTelemetryEvent(event);
        getDashboard().then(setDashboard).catch(() => undefined);
        getStorageScan().then(setStorageScan).catch(() => undefined);
        getOperationsReadiness().then(setOperationsReadiness).catch(() => undefined);
        if (event.type === "storage.pressure.snapshot") {
          getStoragePressureTrend().then(setStoragePressureTrend).catch(() => undefined);
        }
        if (event.type.startsWith("download.") || event.type === "library.rescan.applied") {
          refreshQueueConsoleState().catch(() => undefined);
        }
        const channelId = registeredChannelIdRef.current;
        if (channelId) {
          refreshChannelAfterEvent(channelId, event.type).catch(() => undefined);
        }
      } catch {
        // Ignore malformed development events.
      }
    };
    socket.onerror = () => {
      setEventStreamStatus("error");
    };
    socket.onclose = (event) => {
      if (!cancelled && event.code === 1008) {
        setAuthRequired(true);
        setAuthMessageKey("auth.gate.required");
      }
      if (!cancelled) setEventStreamStatus("closed");
    };

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  useEffect(() => {
    setStorageLensCopyStatus("idle");
    setStorageLensCommandCopyStatus("idle");
    if (!activeStorageChannel?.relative_path) {
      setStorageChannelPressureTrend(null);
      return;
    }
    let cancelled = false;
    getStorageChannelPressureTrend(activeStorageChannel.relative_path)
      .then((trend) => {
        if (!cancelled) setStorageChannelPressureTrend(trend);
      })
      .catch(() => {
        if (!cancelled) setStorageChannelPressureTrend(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStorageChannel?.relative_path]);

  useEffect(() => {
    if (registeredChannelId || !dashboard?.channels.length) return;
    const firstChannelId = parseDashboardChannelId(dashboard.channels[0].id);
    if (Number.isFinite(firstChannelId)) {
      setSelectedChannelId(firstChannelId);
    }
  }, [dashboard, registeredChannelId]);

  useEffect(() => {
    if (!registeredChannelId || launchableJobs.length === 0) return;
    const nextSeedKey = `${registeredChannelId}:${launchableJobKey}`;
    if (selectionSeedKey === nextSeedKey) return;
    setSelectedJobIds(launchableJobs.map((job) => job.id));
    setSelectionSeedKey(nextSeedKey);
  }, [launchableJobKey, launchableJobs, registeredChannelId, selectionSeedKey]);

  useEffect(() => {
    if (!registeredChannelId) {
      setChannelDetail(null);
      setChannelPolicy(null);
      setChannelVideos([]);
      setChannelCoverage(null);
      setChannelMissingVideos([]);
      setChannelCadence(null);
      setSyncJobs([]);
      setDownloadJobs([]);
      setPreflightPlan(null);
      setSelectedJobIds([]);
      setSelectionSeedKey("");
      setLibrary(null);
      setWorkerPlan(null);
      setWorkerRuns([]);
      setDownloadTelemetry({});
      return;
    }

    const channelId = registeredChannelId;
    let cancelled = false;
    async function load() {
      try {
        const [
          detail,
          policy,
          videos,
          coverage,
          missingVideos,
          cadence,
          syncJobSnapshot,
          jobs,
          librarySnapshot,
          workerSnapshot,
          workerRunSnapshot,
        ] = await Promise.all([
          getChannel(channelId),
          getChannelPolicy(channelId),
          getChannelVideos(channelId),
          getChannelCoverage(channelId),
          getChannelMissingVideos(channelId),
          getChannelCadence(channelId),
          getSyncJobs(channelId, 4),
          getDownloadJobs(channelId),
          getLibrary(channelId),
          getDownloadWorkerPlan(channelId),
          getDownloadWorkerRuns(channelId),
        ]);
        if (cancelled) return;
        setChannelDetail(detail);
        setChannelPolicy(policy);
        setChannelVideos(videos);
        setChannelCoverage(coverage);
        setChannelMissingVideos(missingVideos);
        setChannelCadence(cadence);
        setSyncJobs(syncJobSnapshot);
        setDownloadJobs(jobs);
        setLibrary(librarySnapshot);
        setWorkerPlan(workerSnapshot);
        setWorkerRuns(workerRunSnapshot);
      } catch (error) {
        if (cancelled) return;
        setWorkflowStatus("error");
        setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [registeredChannelId, t]);

  async function handleProbe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationStatus("probing");
    setRegistrationError("");
    setRegistration(null);
    setSelectedChannelId(null);
    setChannelDetail(null);
    setChannelPolicy(null);
    setChannelVideos([]);
    setChannelCoverage(null);
    setChannelMissingVideos([]);
    setChannelCadence(null);
    setSyncJobs([]);
    setDownloadJobs([]);
    setPreflightPlan(null);
    setSelectedJobIds([]);
    setSelectionSeedKey("");
    setLibrary(null);
    setWorkerPlan(null);
    setWorkflowMessage("");
    try {
      const result = await probeChannel(registrationPayload);
      setProbe(result);
      setRegistrationStatus("ready");
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : t("registration.error.generic"));
      setRegistrationStatus("error");
    }
  }

  async function handleCommit() {
    setRegistrationStatus("committing");
    setRegistrationError("");
    try {
      const result = await registerChannel(registrationPayload);
      setRegistration(result);
      setProbe(result.probe);
      setSelectedChannelId(result.channel.id);
      setRegistrationStatus("registered");
      await loadChannelState(result.channel.id);
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : t("registration.error.generic"));
      setRegistrationStatus("error");
    }
  }

  async function handleManualSync() {
    if (!registeredChannelId) return;
    setWorkflowStatus("syncing");
    setWorkflowMessage("");
    try {
      const result = await syncChannel(registeredChannelId, {
        max_quality: maxQuality,
        audio_only: audioOnly,
        subtitles_enabled: subtitlesEnabled,
      });
      await loadChannelState(registeredChannelId);
      setWorkflowStatus(result.job.status === "failed" ? "error" : "idle");
      setWorkflowMessage(
        result.job.status === "failed"
          ? result.job.error_message ?? t("workflow.error")
          : t("sync.completed").replace("{count}", String(result.videos_created)),
      );
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleUpdateSyncInterval() {
    if (!registeredChannelId || !syncIntervalValid) return;
    setSyncIntervalStatus("saving");
    try {
      const detail = await updateChannel(registeredChannelId, { sync_interval_minutes: syncIntervalNumber });
      setChannelDetail(detail);
      setSyncIntervalStatus("saved");
      setWorkflowMessage(t("detail.syncOps.intervalSaved").replace("{minutes}", String(detail.sync_interval_minutes)));
    } catch (error) {
      setSyncIntervalStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleBuildCandidates() {
    if (!registeredChannelId) return;
    setWorkflowStatus("candidates");
    setWorkflowMessage("");
    try {
      const result = await createDownloadCandidates(registeredChannelId, maxQuality);
      applyDownloadJobs(result.jobs);
      setPreflightPlan(null);
      setSelectedJobIds(result.jobs.filter(isLaunchableJob).map((job) => job.id));
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowStatus("idle");
      setWorkflowMessage(t("queue.candidates.created").replace("{count}", String(result.candidates_created)));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleQueueOne() {
    const firstMissing = channelVideos.find((video) => video.archive_state === "missing") ?? channelVideos[0];
    if (!firstMissing || !registeredChannelId) return;
    setWorkflowStatus("queueing");
    setWorkflowMessage("");
    try {
      await enqueueVideoDownload(firstMissing.id, maxQuality);
      const jobs = await getDownloadJobs(registeredChannelId);
      applyDownloadJobs(jobs);
      setPreflightPlan(null);
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowStatus("idle");
      setWorkflowMessage(t("queue.one.created"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleToggleAutoDownload() {
    if (!registeredChannelId || !channelPolicy) return;
    try {
      const policy = await updateChannelPolicy(registeredChannelId, {
        auto_download: !channelPolicy.auto_download,
      });
      setChannelPolicy(policy);
      setWorkflowMessage(policy.auto_download ? t("policy.auto.enabled") : t("policy.auto.disabled"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handlePolicyQuality(quality: string) {
    if (!registeredChannelId) return;
    try {
      const policy = await updateChannelPolicy(registeredChannelId, { max_quality: quality });
      setChannelPolicy(policy);
      setMaxQuality(policy.max_quality);
      setWorkflowMessage(t("policy.updated"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleToggleWorkerPause() {
    if (!registeredChannelId || !channelPolicy) return;
    try {
      const nextPaused = !channelPolicy.worker_paused;
      const policy = await updateChannelPolicy(registeredChannelId, {
        worker_paused: nextPaused,
        worker_pause_reason: nextPaused ? t("policy.worker.pause.reason") : null,
      });
      const workerSnapshot = await getDownloadWorkerPlan(registeredChannelId);
      setChannelPolicy(policy);
      setWorkerPlan(workerSnapshot);
      setWorkflowMessage(nextPaused ? t("policy.worker.pause.enabled") : t("policy.worker.pause.disabled"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleRetryJob(jobId: number) {
    if (!registeredChannelId) return;
    try {
      await retryDownloadJob(jobId);
      applyDownloadJobs(await getDownloadJobs(registeredChannelId));
      setPreflightPlan(null);
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowMessage(t("job.retried"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleCancelJob(jobId: number) {
    if (!registeredChannelId) return;
    try {
      await cancelDownloadJob(jobId);
      applyDownloadJobs(await getDownloadJobs(registeredChannelId));
      setPreflightPlan(null);
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowMessage(t("job.cancelled"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleStopJob(jobId: number) {
    if (!registeredChannelId) return;
    try {
      await stopDownloadJob(jobId);
      applyDownloadJobs(await getDownloadJobs(registeredChannelId));
      setPreflightPlan(null);
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowMessage(t("job.stopped"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleRunPreflight() {
    if (!registeredChannelId) return;
    setWorkflowStatus("preflight");
    setWorkflowMessage("");
    try {
      const plan = await getQueuePreflight(registeredChannelId);
      setPreflightPlan(plan);
      applyDownloadJobs(plan.jobs);
      setSelectedJobIds(plan.ready_job_ids);
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowStatus("idle");
      setWorkflowMessage(
        t("preflight.completed")
          .replace("{count}", String(plan.job_count))
          .replace("{size}", plan.estimated_label),
      );
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleBulkQueueAction(action: "queue" | "cancel" | "prioritize" | "retry", priority?: number) {
    if (!registeredChannelId) return;
    const jobIds = selectedJobIds.length ? selectedJobIds : preflightPlan?.ready_job_ids ?? [];
    if (jobIds.length === 0) {
      setWorkflowMessage(t("queue.selection.empty"));
      return;
    }
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await bulkUpdateDownloadJobs({ job_ids: jobIds, action, priority });
      const jobs = await getDownloadJobs(registeredChannelId);
      applyDownloadJobs(jobs);
      setPreflightPlan(null);
      const [snapshot, librarySnapshot, workerSnapshot] = await Promise.all([
        getDashboard(),
        getLibrary(registeredChannelId),
        getDownloadWorkerPlan(registeredChannelId),
      ]);
      setDashboard(snapshot);
      setLibrary(librarySnapshot);
      setWorkerPlan(workerSnapshot);
      setWorkflowStatus("idle");
      const messageKey =
        action === "queue"
          ? "queue.bulk.queued"
          : action === "cancel"
            ? "queue.bulk.cancelled"
            : action === "retry"
              ? "queue.bulk.retried"
              : "queue.bulk.prioritized";
      setWorkflowMessage(t(messageKey as TranslationKey).replace("{count}", String(result.updated)));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleToggleQueueConsoleJobSelection(jobId: number) {
    if (!queueConsoleActionableJobs.some((job) => job.id === jobId)) return;
    setQueueConsoleSelectedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId],
    );
  }

  function handleSelectVisibleQueueConsoleJobs() {
    if (allVisibleQueueConsoleJobsSelected) {
      const visibleIds = new Set(visibleQueueConsoleActionableJobs.map((job) => job.id));
      setQueueConsoleSelectedJobIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }
    setQueueConsoleSelectedJobIds((current) =>
      Array.from(new Set([...current, ...visibleQueueConsoleActionableJobs.map((job) => job.id)])),
    );
  }

  function handleResetQueueConsoleFilters() {
    setQueueConsoleSearch("");
    setQueueConsoleStatusFilter("all");
    setQueueConsolePreflightFilter("all");
    setQueueConsoleChannelFilter("all");
  }

  async function handleToggleQueueConsoleDetails(job: DownloadJob) {
    if (expandedQueueConsoleJobId === job.id) {
      setExpandedQueueConsoleJobId(null);
      return;
    }
    setExpandedQueueConsoleJobId(job.id);
    if (queueConsoleFileMap[job.video_id] || queueConsoleFileStatus[job.video_id] === "loading") return;
    setQueueConsoleFileStatus((current) => ({ ...current, [job.video_id]: "loading" }));
    try {
      const files = await getLibraryFiles(job.video_id);
      setQueueConsoleFileMap((current) => ({ ...current, [job.video_id]: files }));
      setQueueConsoleFileStatus((current) => ({ ...current, [job.video_id]: "idle" }));
    } catch {
      setQueueConsoleFileStatus((current) => ({ ...current, [job.video_id]: "error" }));
    }
  }

  async function handleQueueConsoleBulkAction(action: "queue" | "cancel" | "prioritize" | "retry", priority?: number) {
    const jobIds = queueConsoleSelectedJobIds;
    if (jobIds.length === 0) {
      setWorkflowMessage(t("queue.selection.empty"));
      return;
    }
    setQueueConsoleStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await bulkUpdateDownloadJobs({ job_ids: jobIds, action, priority });
      await refreshQueueConsoleState();
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      const messageKey =
        action === "queue"
          ? "queue.bulk.queued"
          : action === "cancel"
            ? "queue.bulk.cancelled"
            : action === "retry"
              ? "queue.bulk.retried"
              : "queue.bulk.prioritized";
      setWorkflowMessage(t(messageKey as TranslationKey).replace("{count}", String(result.updated)));
      setQueueConsoleStatus("idle");
    } catch (error) {
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleQueueConsoleJobAction(job: DownloadJob, action: "retry" | "cancel" | "stop") {
    setQueueConsoleStatus("bulk");
    setWorkflowMessage("");
    try {
      if (action === "retry") await retryDownloadJob(job.id);
      if (action === "cancel") await cancelDownloadJob(job.id);
      if (action === "stop") await stopDownloadJob(job.id);
      await refreshQueueConsoleState();
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setQueueConsoleStatus("idle");
      setWorkflowMessage(action === "retry" ? t("job.retried") : action === "stop" ? t("job.stopped") : t("job.cancelled"));
    } catch (error) {
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleOpenQueueConsoleRunConfirm() {
    setQueueConsoleStatus("loading");
    setWorkflowMessage("");
    try {
      await refreshQueueConsoleState();
      setQueueConsoleStatus("idle");
      setQueueConsoleConfirmOpen(true);
    } catch (error) {
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleQueueConsoleRunWorker() {
    if (!queueConsoleWorkerPlan?.enabled || queueConsoleWorkerPlan.locked_reason) return;
    setQueueConsoleConfirmOpen(false);
    setQueueConsoleStatus("worker");
    setWorkflowStatus("downloading");
    setWorkflowMessage("");
    try {
      const result = await runDownloadWorkerOnce({ limit: 5, dry_run: false });
      await refreshQueueConsoleState();
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setWorkflowStatus(result.failed > 0 ? "error" : "idle");
      setQueueConsoleStatus(result.failed > 0 ? "error" : "idle");
      setWorkflowMessage(
        t("worker.liveComplete")
          .replace("{completed}", String(result.completed))
          .replace("{failed}", String(result.failed))
          .replace("{candidates}", "0"),
      );
    } catch (error) {
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleRefreshQueueConsole() {
    setQueueConsoleStatus("loading");
    try {
      await refreshQueueConsoleState();
      setQueueConsoleStatus("idle");
    } catch (error) {
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleApplyRescan() {
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await applyLibraryRescan();
      setRescanResult(result);
      const [snapshot, recentEvents, storageSnapshot] = await Promise.all([getDashboard(), getRecentEvents(100), getStorageScan()]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setStorageScan(storageSnapshot);
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setWorkflowStatus("idle");
      setWorkflowMessage(
        t("import.rescan.done")
          .replace("{videos}", String(result.videos_created))
          .replace("{files}", String(result.media_files_indexed)),
      );
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function resetArchiveTxtReviewState() {
    setArchiveTxtPreview(null);
    setArchiveTxtStageResult(null);
    setArchiveTxtSyncResult(null);
    setArchiveTxtSyncStatus("idle");
    setArchiveTxtQueueStatus("idle");
    setArchiveTxtStageStatus("idle");
    setArchiveTxtStatus("idle");
  }

  function replaceArchiveTxtDraft(value: string) {
    setArchiveTxtDraft(value);
    resetArchiveTxtReviewState();
  }

  async function loadArchiveTxtFile(file: File) {
    try {
      const content = await file.text();
      replaceArchiveTxtDraft(content);
      setWorkflowStatus("idle");
      setWorkflowMessage(t("archiveTxt.fileLoaded").replace("{name}", file.name));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleArchiveTxtFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      void loadArchiveTxtFile(file);
    }
    event.currentTarget.value = "";
  }

  function handleArchiveTxtDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) => item.type === "text/plain" || item.name.endsWith(".txt"));
    if (file) {
      void loadArchiveTxtFile(file);
    }
  }

  async function handlePreviewArchiveTxt() {
    if (!archiveTxtDraft.trim()) return;
    setArchiveTxtStatus("previewing");
    setArchiveTxtStageStatus("idle");
    setArchiveTxtStageResult(null);
    setArchiveTxtSyncStatus("idle");
    setArchiveTxtSyncResult(null);
    setArchiveTxtQueueStatus("idle");
    setWorkflowMessage("");
    try {
      const preview = await previewArchiveTxt(archiveTxtDraft, registeredChannelId);
      setArchiveTxtPreview(preview);
      setArchiveTxtStatus("done");
      setWorkflowStatus("idle");
      setWorkflowMessage(
        t("archiveTxt.previewDone")
          .replace("{archived}", String(preview.archived_count))
          .replace("{missing}", String(preview.known_missing_count))
          .replace("{unknown}", String(preview.unknown_count)),
      );
    } catch (error) {
      setArchiveTxtStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleStageArchiveTxt() {
    if (!archiveTxtDraft.trim() || !registeredChannelId || archiveTxtStageableCount <= 0) return;
    setArchiveTxtStageStatus("staging");
    setArchiveTxtSyncStatus("idle");
    setArchiveTxtSyncResult(null);
    setArchiveTxtQueueStatus("idle");
    setWorkflowMessage("");
    try {
      const result = await stageArchiveTxt(archiveTxtDraft, registeredChannelId, channelPolicy?.max_quality ?? maxQuality);
      setArchiveTxtStageResult(result);
      setArchiveTxtPreview(result.preview);
      setArchiveTxtStageStatus("done");
      setWorkflowStatus("idle");
      const [snapshot, recentEvents] = await Promise.all([getDashboard(), getRecentEvents(100)]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      await refreshQueueConsoleState();
      await loadChannelState(registeredChannelId);
      setWorkflowMessage(
        t("archiveTxt.stageDone")
          .replace("{videos}", String(result.videos_created))
          .replace("{candidates}", String(result.candidates_created)),
      );
    } catch (error) {
      setArchiveTxtStageStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleArchiveTxtOpenQueue() {
    setActiveNavId("queue");
    setQueueConsoleSearch("");
    setQueueConsoleStatusFilter("launchable");
    setQueueConsolePreflightFilter("all");
    if (registeredChannelId) {
      setQueueConsoleChannelFilter(String(registeredChannelId));
    }
    setQueueConsoleSelectedJobIds(archiveTxtStageResult?.job_ids ?? []);
    setQueueConsoleStatus("loading");
    try {
      await refreshQueueConsoleState();
      setQueueConsoleStatus("idle");
      window.setTimeout(() => scrollToAppSection(".queue-console-panel"), 0);
    } catch (error) {
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleArchiveTxtPrepareQueue() {
    if (!archiveTxtStageResult || !registeredChannelId) return;
    const jobIds = archiveTxtStageResult.job_ids.slice(0, 5);
    if (jobIds.length === 0) {
      setWorkflowMessage(t("archiveTxt.queuePreparedEmpty"));
      await handleArchiveTxtOpenQueue();
      return;
    }
    setArchiveTxtQueueStatus("preparing");
    setQueueConsoleStatus("bulk");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await bulkUpdateDownloadJobs({ job_ids: jobIds, action: "queue", priority: 85 });
      await refreshQueueConsoleState();
      await loadChannelState(registeredChannelId);
      setQueueConsoleSearch("");
      setQueueConsoleChannelFilter(String(registeredChannelId));
      setQueueConsoleStatusFilter("queued");
      setQueueConsolePreflightFilter("all");
      setQueueConsoleSelectedJobIds(jobIds);
      setArchiveTxtQueueStatus("done");
      setQueueConsoleStatus("idle");
      setWorkflowStatus("idle");
      setActiveNavId("queue");
      setWorkflowMessage(t("archiveTxt.queuePrepared").replace("{count}", String(result.updated)));
      window.setTimeout(() => scrollToAppSection(".queue-console-panel"), 0);
    } catch (error) {
      setArchiveTxtQueueStatus("error");
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleArchiveTxtOpenRunConfirm() {
    if (!archiveTxtStageResult || !registeredChannelId) return;
    setArchiveTxtRunStatus("idle");
    setWorkflowMessage("");
    try {
      const [plan, jobs] = await Promise.all([
        getDownloadWorkerPlan(registeredChannelId, 5),
        getDownloadJobs(registeredChannelId),
      ]);
      setWorkerPlan(plan);
      setDownloadJobs(jobs);
      setArchiveTxtRunConfirmOpen(true);
    } catch (error) {
      setArchiveTxtRunStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleArchiveTxtPrepareAndRun() {
    if (!archiveTxtStageResult || !registeredChannelId || archiveTxtRunBlocked) return;
    const jobIds = archiveTxtRunJobIds;
    if (!jobIds.length) {
      setWorkflowMessage(t("archiveTxt.queuePreparedEmpty"));
      return;
    }
    setArchiveTxtRunStatus("running");
    setArchiveTxtQueueStatus("preparing");
    setQueueConsoleStatus("worker");
    setWorkflowStatus("downloading");
    setWorkflowMessage("");
    try {
      const quality = channelPolicy?.max_quality ?? maxQuality;
      const queued = await bulkUpdateDownloadJobs({ job_ids: jobIds, action: "queue", priority: 85, quality });
      const result = await runDownloadWorkerOnce({
        channel_id: registeredChannelId,
        limit: Math.min(5, jobIds.length),
        dry_run: false,
      });
      await Promise.all([refreshQueueConsoleState(), loadChannelState(registeredChannelId)]);
      const runs = await getDownloadWorkerRuns(registeredChannelId);
      setWorkerPlan(result.plan);
      setWorkerRuns(runs);
      setQueueConsoleSearch("");
      setQueueConsoleChannelFilter(String(registeredChannelId));
      setQueueConsoleStatusFilter("all");
      setQueueConsolePreflightFilter("all");
      setQueueConsoleSelectedJobIds(jobIds);
      setArchiveTxtRunStatus(result.failed > 0 ? "error" : "done");
      setArchiveTxtQueueStatus(result.failed > 0 ? "error" : "done");
      setQueueConsoleStatus(result.failed > 0 ? "error" : "idle");
      setWorkflowStatus(result.failed > 0 ? "error" : "idle");
      setActiveNavId("queue");
      setArchiveTxtRunConfirmOpen(false);
      setWorkflowMessage(
        t("archiveTxt.runComplete")
          .replace("{prepared}", String(queued.updated))
          .replace("{completed}", String(result.completed))
          .replace("{failed}", String(result.failed)),
      );
      window.setTimeout(() => scrollToAppSection(".queue-console-panel"), 0);
    } catch (error) {
      setArchiveTxtRunStatus("error");
      setArchiveTxtQueueStatus("error");
      setQueueConsoleStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleArchiveTxtMetadataSync() {
    if (!registeredChannelId || !archiveTxtStageResult || archiveTxtStageResult.videos_created <= 0) return;
    setArchiveTxtSyncStatus("syncing");
    setWorkflowStatus("syncing");
    setWorkflowMessage("");
    try {
      const result = await syncChannel(registeredChannelId, {
        max_quality: channelPolicy?.max_quality ?? maxQuality,
        audio_only: channelPolicy?.audio_only ?? audioOnly,
        subtitles_enabled: channelPolicy?.subtitles_enabled ?? subtitlesEnabled,
      });
      setArchiveTxtSyncResult(result);
      const failed = result.job.status === "failed";
      setArchiveTxtSyncStatus(failed ? "error" : "done");
      const [snapshot, recentEvents] = await Promise.all([getDashboard(), getRecentEvents(100)]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      await refreshQueueConsoleState();
      await loadChannelState(registeredChannelId);
      setWorkflowStatus(failed ? "error" : "idle");
      setWorkflowMessage(
        failed
          ? result.job.error_message ?? t("workflow.error")
          : t("archiveTxt.syncDone")
              .replace("{enriched}", String(result.videos_enriched))
              .replace("{created}", String(result.videos_created)),
      );
    } catch (error) {
      setArchiveTxtSyncStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handlePreviewStorageDrift(item: StorageDriftItem) {
    const key = storageDriftActionKey(item);
    const isRecover = item.kind === "unindexed_media";
    setSelectedStorageDriftItem(item);
    setStorageDriftPreview(null);
    setStorageDriftPreviewStatus("planning");
    setStorageDriftActionStatus((current) => ({ ...current, [key]: "running" }));
    setWorkflowMessage("");
    try {
      const preview = isRecover
        ? await recoverUnindexedStorageDrift(item.relative_path, true)
        : await pruneMissingStorageIndex(item.relative_path, true);
      setStorageDriftPreview(preview);
      setStorageDriftPreviewStatus(preview.warnings.length ? "error" : "idle");
      setStorageDriftActionStatus((current) => ({ ...current, [key]: preview.warnings.length ? "error" : "idle" }));
      if (preview.warnings.length) {
        setWorkflowStatus("error");
        setWorkflowMessage(preview.warnings.join(" · "));
      }
    } catch (error) {
      setStorageDriftPreviewStatus("error");
      setStorageDriftActionStatus((current) => ({ ...current, [key]: "error" }));
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleApplyStorageDriftPreview() {
    if (!selectedStorageDriftItem) return;
    const item = selectedStorageDriftItem;
    const key = storageDriftActionKey(item);
    const isRecover = item.kind === "unindexed_media";
    setStorageDriftActionStatus((current) => ({ ...current, [key]: "running" }));
    setStorageDriftPreviewStatus("running");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = isRecover
        ? await recoverUnindexedStorageDrift(item.relative_path)
        : await pruneMissingStorageIndex(item.relative_path);
      const [snapshot, recentEvents, storageSnapshot] = await Promise.all([getDashboard(), getRecentEvents(100), getStorageScan()]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setStorageScan(storageSnapshot);
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      const count = isRecover ? (result.rescan?.media_files_indexed ?? 0) : result.deleted_media_files;
      setStorageDriftPreview(result);
      setStorageDriftPreviewStatus(result.applied ? "done" : "error");
      setStorageDriftActionStatus((current) => ({ ...current, [key]: "done" }));
      setWorkflowStatus(result.applied ? "idle" : "error");
      setWorkflowMessage(
        result.applied
          ? t(isRecover ? "storage.drift.recoverDone" : "storage.drift.pruneDone").replace("{count}", String(count))
          : result.warnings.join(" · ") || t("workflow.error"),
      );
      if (result.applied) {
        window.setTimeout(() => {
          setSelectedStorageDriftItem(null);
          setStorageDriftPreview(null);
          setStorageDriftPreviewStatus("idle");
          setStorageDriftActionStatus((current) => ({ ...current, [key]: "idle" }));
        }, 1200);
      }
    } catch (error) {
      setStorageDriftPreviewStatus("error");
      setStorageDriftActionStatus((current) => ({ ...current, [key]: "error" }));
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleWorkerDryRun() {
    if (!registeredChannelId) return;
    try {
      const result = await runDownloadWorkerOnce({ channel_id: registeredChannelId, limit: 3, dry_run: true });
      const runs = await getDownloadWorkerRuns(registeredChannelId);
      setWorkerPlan(result.plan);
      setWorkerRuns(runs);
      setWorkflowMessage(t("worker.dryRunComplete").replace("{count}", String(result.plan.claimable_count)));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleOpenLiveDownloadConfirm() {
    if (!registeredChannelId) return;
    setActiveChannelTab("downloads");
    setLiveDownloadStatus("idle");
    setLiveDownloadConfirmOpen(true);
  }

  async function handleRunLiveDownloadPass() {
    if (!registeredChannelId || liveDownloadBlocked) return;
    setLiveDownloadStatus("running");
    setWorkflowStatus("downloading");
    setWorkflowMessage("");
    try {
      const quality = channelPolicy?.max_quality ?? maxQuality;
      const candidateResult = await createDownloadCandidates(registeredChannelId, quality);
      let jobs = await getDownloadJobs(registeredChannelId);
      const candidateIds = jobs
        .filter((job) => job.status === "candidate")
        .slice(0, 5)
        .map((job) => job.id);
      if (candidateIds.length) {
        await bulkUpdateDownloadJobs({ job_ids: candidateIds, action: "queue", priority: 85, quality });
        jobs = await getDownloadJobs(registeredChannelId);
      }
      const queuedCount = jobs.filter((job) => job.status === "queued").length;
      const limit = Math.min(5, Math.max(queuedCount, 1));
      const result = await runDownloadWorkerOnce({
        channel_id: registeredChannelId,
        limit,
        dry_run: false,
      });
      await loadChannelState(registeredChannelId);
      setLiveDownloadStatus(result.failed > 0 ? "error" : "done");
      setWorkflowStatus(result.failed > 0 ? "error" : "idle");
      setWorkflowMessage(
        t("worker.liveComplete")
          .replace("{completed}", String(result.completed))
          .replace("{failed}", String(result.failed))
          .replace("{candidates}", String(candidateResult.candidates_created)),
      );
    } catch (error) {
      setLiveDownloadStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    } finally {
      setLiveDownloadConfirmOpen(false);
    }
  }

  async function copyTextToClipboard(value: string) {
    const copyWithField = () => {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "true");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(field);
      if (!copied) {
        throw new Error("Clipboard copy failed");
      }
    };

    const writeViaClipboardApi = async () => {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard api unavailable");
      }
      // Some headless/embedded browsers leave writeText pending forever; bound it
      // so the UI never gets stuck and we can fall back to a synchronous copy.
      let timer: number | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("clipboard timeout")), 1200);
      });
      try {
        await Promise.race([navigator.clipboard.writeText(value), timeout]);
      } finally {
        if (timer !== undefined) {
          window.clearTimeout(timer);
        }
      }
    };

    try {
      await writeViaClipboardApi();
    } catch {
      copyWithField();
    }
  }

  async function handleCopyRuntimeEnv() {
    try {
      await copyTextToClipboard(runtimeEnvManifest);
      setRuntimeGuideCopyStatus("copied");
      window.setTimeout(() => setRuntimeGuideCopyStatus("idle"), 1800);
    } catch {
      setRuntimeGuideCopyStatus("error");
      window.setTimeout(() => setRuntimeGuideCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyRestartPreset(preset: RestartAdapterPreset) {
    try {
      await copyTextToClipboard(preset.lines.join("\n"));
      setRuntimeRestartPresetCopyStatus({ id: preset.id, status: "copied" });
      window.setTimeout(() => setRuntimeRestartPresetCopyStatus(null), 1800);
    } catch {
      setRuntimeRestartPresetCopyStatus({ id: preset.id, status: "error" });
      window.setTimeout(() => setRuntimeRestartPresetCopyStatus(null), 2200);
    }
  }

  async function handleCopyComposeSmokeCommand() {
    try {
      await copyTextToClipboard(composeSmokeCommand);
      setRuntimeComposeSmokeCopyStatus("copied");
      window.setTimeout(() => setRuntimeComposeSmokeCopyStatus("idle"), 1800);
    } catch {
      setRuntimeComposeSmokeCopyStatus("error");
      window.setTimeout(() => setRuntimeComposeSmokeCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyVolumeMountEnv() {
    try {
      await copyTextToClipboard(`${runtimeVolumeMkdirCommand}\n\n${runtimeVolumeEnvManifest}`);
      setRuntimeVolumeCopyStatus("copied");
      window.setTimeout(() => setRuntimeVolumeCopyStatus("idle"), 1800);
    } catch {
      setRuntimeVolumeCopyStatus("error");
      window.setTimeout(() => setRuntimeVolumeCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyBackupRestoreCommand(id: BackupRestoreCommandId) {
    try {
      await copyTextToClipboard(runtimeBackupRestoreCommands[id]);
      setRuntimeBackupCopyStatus({ id, status: "copied" });
      window.setTimeout(() => setRuntimeBackupCopyStatus(null), 1800);
    } catch {
      setRuntimeBackupCopyStatus({ id, status: "error" });
      window.setTimeout(() => setRuntimeBackupCopyStatus(null), 2200);
    }
  }

  async function handleCopyExposureProxyPreset(preset: ExposureProxyPreset) {
    try {
      await copyTextToClipboard(preset.snippet);
      setRuntimeProxyCopyStatus({ id: preset.id, status: "copied" });
      window.setTimeout(() => setRuntimeProxyCopyStatus(null), 1800);
    } catch {
      setRuntimeProxyCopyStatus({ id: preset.id, status: "error" });
      window.setTimeout(() => setRuntimeProxyCopyStatus(null), 2200);
    }
  }

  async function handleCopyDeploymentSmokeCommand() {
    try {
      await copyTextToClipboard(DEPLOYMENT_SMOKE_COMMAND);
      setRuntimeDeploymentSmokeCopyStatus("copied");
      window.setTimeout(() => setRuntimeDeploymentSmokeCopyStatus("idle"), 1800);
    } catch {
      setRuntimeDeploymentSmokeCopyStatus("error");
      window.setTimeout(() => setRuntimeDeploymentSmokeCopyStatus("idle"), 2200);
    }
  }

  function handleGenerateAccessToken() {
    setAccessTokenValue(generateAccessToken());
    setAccessTokenRevealed(false);
    setAccessTokenCopyStatus(null);
  }

  function handleJumpToAccessGuard() {
    accessGuardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRuntimeGuideRailClick(selector: string) {
    scrollToAppSection(selector);
  }

  async function handleCopyAccessToken(kind: "token" | "env" | "smoke") {
    const value =
      kind === "token"
        ? accessTokenValue
        : kind === "env"
          ? accessTokenValue
            ? `CVN_AUTH_TOKEN=${accessTokenValue}`
            : ""
          : ACCESS_TOKEN_SMOKE_COMMAND;
    if (!value) return;
    try {
      await copyTextToClipboard(value);
      setAccessTokenCopyStatus({ id: kind, status: "copied" });
      window.setTimeout(() => setAccessTokenCopyStatus(null), 1800);
    } catch {
      setAccessTokenCopyStatus({ id: kind, status: "error" });
      window.setTimeout(() => setAccessTokenCopyStatus(null), 2200);
    }
  }

  async function handleCopyLaunchCommands() {
    try {
      await copyTextToClipboard(launchCommandManifest);
      setLaunchCommandCopyStatus("copied");
      window.setTimeout(() => setLaunchCommandCopyStatus("idle"), 1800);
    } catch {
      setLaunchCommandCopyStatus("error");
      window.setTimeout(() => setLaunchCommandCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyStorageLensPath() {
    if (!activeStoragePath) return;
    try {
      await copyTextToClipboard(activeStoragePath);
      setStorageLensCopyStatus("copied");
      window.setTimeout(() => setStorageLensCopyStatus("idle"), 1800);
    } catch {
      setStorageLensCopyStatus("error");
      window.setTimeout(() => setStorageLensCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyStorageLensOpenCommand() {
    if (!activeStorageOpenCommand.command) return;
    try {
      await copyTextToClipboard(activeStorageOpenCommand.command);
      setStorageLensCommandCopyStatus("copied");
      window.setTimeout(() => setStorageLensCommandCopyStatus("idle"), 1800);
    } catch {
      setStorageLensCommandCopyStatus("error");
      window.setTimeout(() => setStorageLensCommandCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyTickRows(kind: "scheduler" | "metadata") {
    const payload =
      kind === "scheduler"
        ? {
            kind: "download_worker_scheduler_ticks",
            filters: {
              status: schedulerTickStatusFilter,
              duration: schedulerDurationFilter,
              interval_seconds: schedulerIntervalFilter || null,
              worker_limit: schedulerLimitFilter || null,
            },
            count: schedulerTickRows.length,
            ticks: schedulerTickRows,
          }
        : {
            kind: "metadata_sync_scheduler_ticks",
            filters: {
              status: metadataTickStatusFilter,
              duration: metadataDurationFilter,
              interval_seconds: metadataIntervalFilter || null,
              channel_limit: metadataLimitFilter || null,
            },
            count: metadataTickRows.length,
            ticks: metadataTickRows,
          };
    const setStatus = kind === "scheduler" ? setSchedulerTickCopyStatus : setMetadataTickCopyStatus;
    try {
      await copyTextToClipboard(JSON.stringify(payload, null, 2));
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  function buildSupportBundle() {
    return {
      kind: "channel_vault_support_bundle",
      generated_at: new Date().toISOString(),
      release_readiness: {
        done: releaseReadinessDone,
        total: releaseReadinessItems.length,
        items: releaseReadinessItems.map((item) => ({
          id: item.id,
          ready: item.ready,
          title: t(item.titleKey),
        })),
      },
      active_channel: {
        id: registeredChannelId,
        title: registeredChannelId ? activeTitle : null,
        handle: registeredChannelId ? activeHandle : null,
        external_id: registeredChannelId ? activeExternalId : null,
        videos: activeCounts?.video_count ?? channelVideos.length,
        archived: activeArchivedCount,
        missing: activeMissingCount,
        last_synced_at: channelDetail?.last_synced_at ?? null,
        next_sync_due_at: channelDetail?.next_sync_due_at ?? null,
      },
      queue: {
        counts: queueConsoleCounts,
        latest_telemetry: queueConsoleLatestTelemetry,
        worker_plan: queueConsoleWorkerPlan
          ? {
              enabled: queueConsoleWorkerPlan.enabled,
              dry_run: queueConsoleWorkerPlan.dry_run,
              queued_count: queueConsoleWorkerPlan.queued_count,
              claimable_count: queueConsoleWorkerPlan.claimable_count,
              running_count: queueConsoleWorkerPlan.running_count,
              locked_reason: queueConsoleWorkerPlan.locked_reason,
            }
          : null,
      },
      runtime: runtimeSettings
        ? {
            worker_enabled: runtimeSettings.download_worker_enabled,
            scheduler_enabled: runtimeSettings.download_worker_scheduler_enabled,
            metadata_scheduler_enabled: runtimeSettings.metadata_sync_scheduler_enabled,
            pending_restart: runtimeSettings.pending_restart,
            scheduler_state: runtimeSettings.scheduler_status?.state ?? null,
            metadata_scheduler_state: runtimeSettings.metadata_scheduler_status?.state ?? null,
            restart_adapter: runtimeSettings.restart_adapter?.adapter ?? null,
            binaries: runtimeSettings.binaries.map((binary) => ({
              name: binary.name,
              available: binary.available,
              command: binary.command,
              resolved_path: binary.resolved_path,
            })),
          }
        : null,
      storage: storageScan
        ? {
            root: storageScan.volume.root,
            archive_label: storageScan.volume.archive_label,
            free_label: storageScan.volume.free_label,
            pressure_percent: storageScan.volume.pressure_percent,
            drift: {
              unindexed_media_count: storageScan.drift.unindexed_media_count,
              indexed_missing_count: storageScan.drift.indexed_missing_count,
            },
            orphan_sidecar_count: storageScan.orphan_sidecars.length,
          }
        : null,
      library: {
        total: library?.total ?? 0,
        archived: library?.archived ?? 0,
        missing: library?.missing ?? 0,
        total_label: library?.total_label ?? "0 MB",
        active_filters: {
          query: libraryQuery || null,
          integrity: libraryIntegrityFilter,
          sidecar: librarySidecarFilter,
          codec: libraryCodecFilter || null,
        },
      },
      recent_events: events.slice(0, 12),
    };
  }

  async function loadSupportBundle() {
    try {
      const bundle = await getSupportBundle();
      setSupportBundleSource("server");
      return bundle;
    } catch (error) {
      if (handleAuthFailure(error)) {
        throw error;
      }
      setSupportBundleSource("fallback");
      return buildSupportBundle();
    }
  }

  async function handleCopySupportBundle() {
    try {
      await copyTextToClipboard(JSON.stringify(await loadSupportBundle(), null, 2));
      setSupportBundleCopyStatus("copied");
      window.setTimeout(() => setSupportBundleCopyStatus("idle"), 1800);
    } catch {
      setSupportBundleCopyStatus("error");
      window.setTimeout(() => setSupportBundleCopyStatus("idle"), 2200);
    }
  }

  async function handleDownloadSupportBundle() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadTextFile(
        `channel-vault-support-${timestamp}.json`,
        JSON.stringify(await loadSupportBundle(), null, 2),
        "application/json;charset=utf-8",
      );
    } catch {
      setSupportBundleCopyStatus("error");
      window.setTimeout(() => setSupportBundleCopyStatus("idle"), 2200);
    }
  }

  function buildBetaReadinessBrief() {
    const pendingLines = releaseReadinessPendingItems.length
      ? releaseReadinessPendingItems.map((item) => `- ${t(item.titleKey)}: ${t(item.detailKey)}`)
      : [`- ${t("release.brief.nonePending")}`];
    const mountDoctorLabel = mountDoctor
      ? `${t(`mountDoctor.status.${mountDoctor.status}` as TranslationKey)} (${mountDoctor.score})`
      : t("runtime.checking");
    const supportSourceLabel =
      supportBundleSource === "server"
        ? t("support.bundle.server")
        : supportBundleSource === "fallback"
          ? t("support.bundle.fallback")
          : t("support.bundle.ready");

    return [
      "Channel Vault NAS beta readiness",
      `${t("release.brief.generated")}: ${new Date().toISOString()}`,
      `${t("release.brief.statusLabel")}: ${t(releaseReadinessBriefStatusKey)}`,
      t("release.brief.score").replace("{done}", String(releaseReadinessDone)).replace("{total}", String(releaseReadinessItems.length)),
      "",
      t("release.brief.pendingTitle"),
      ...pendingLines,
      "",
      `${t("mountDoctor.title")}: ${mountDoctorLabel}`,
      `${t("release.readiness.backup.title")}: ${runtimeBackupRestoreReady ? t("runtime.backup.ready") : t("runtime.backup.warn")}`,
      `${t("queue.console.title")}: ${queueConsoleCounts.queued} ${t("queue.queued")} · ${queueConsoleCounts.running} ${t("queue.running")} · ${queueConsoleCounts.failed} ${t("queue.failed")}`,
      `${t("support.bundle.privacyTitle")}: ${supportSourceLabel}`,
    ].join("\n");
  }

  async function handleCopyBetaReadinessBrief() {
    try {
      await copyTextToClipboard(buildBetaReadinessBrief());
      setBetaBriefCopyStatus("copied");
      window.setTimeout(() => setBetaBriefCopyStatus("idle"), 1800);
    } catch {
      setBetaBriefCopyStatus("error");
      window.setTimeout(() => setBetaBriefCopyStatus("idle"), 2200);
    }
  }

  function buildBetaProofPayload() {
    return {
      kind: "channel_vault_beta_onboarding_proof",
      generated_at: new Date().toISOString(),
      privacy: {
        redacted_for_public_issue: true,
        excludes: ["channel_titles", "video_titles", "source_urls", "absolute_paths", "generated_download_commands", "tokens"],
      },
      release_readiness: {
        status: releaseReadinessBriefTone,
        status_label: t(releaseReadinessBriefStatusKey),
        score: {
          done: releaseReadinessDone,
          total: releaseReadinessItems.length,
        },
        checks: releaseReadinessItems.map((item) => ({
          id: item.id,
          ready: item.ready,
          label: t(item.titleKey),
        })),
        pending: releaseReadinessPendingItems.map((item) => ({
          id: item.id,
          label: t(item.titleKey),
        })),
      },
      clean_install_gate: {
        visible_for_empty_workspace: !hasAnyRegisteredChannel,
        ready: cleanInstallGateReadyCount,
        total: cleanInstallGateSteps.length,
        next_step: cleanInstallGateNextStep
          ? {
              id: cleanInstallGateNextStep.id,
              state: cleanInstallGateNextStep.state,
              label: t(cleanInstallGateNextStep.titleKey),
            }
          : null,
        steps: cleanInstallGateSteps.map((step) => ({
          id: step.id,
          state: step.state,
          label: t(step.titleKey),
        })),
      },
      runtime: {
        worker_enabled: runtimeSettings?.download_worker_enabled ?? null,
        download_scheduler_enabled: runtimeSettings?.download_worker_scheduler_enabled ?? null,
        metadata_scheduler_enabled: runtimeSettings?.metadata_sync_scheduler_enabled ?? null,
        pending_restart: runtimeSettings?.pending_restart ?? null,
        restart_adapter: restartAdapter?.adapter ?? null,
        restart_executable: restartAdapter?.executable ?? null,
        scheduler_state: runtimeSettings?.scheduler_status?.state ?? null,
        metadata_scheduler_state: runtimeSettings?.metadata_scheduler_status?.state ?? null,
      },
      mounts: {
        status: mountDoctor?.status ?? null,
        score: mountDoctor?.score ?? null,
        critical_count: mountDoctorCriticalCount,
        warning_count: mountDoctorWarningCount,
        inspected_roots: mountDoctorPathRows.length,
      },
      backup_restore: {
        recoverable: runtimeBackupRestoreReady,
        durable_roots: runtimeBackupRestorePaths.map((path) => ({
          id: path.id,
          tone: path.tone,
          label: t(path.labelKey),
          state: path.path ? mountDoctorPathState(path.path, t) : t("runtime.backup.pathUnknown"),
        })),
      },
      storage: storageScan
        ? {
            scanned: true,
            archive_label: storageScan.volume.archive_label,
            free_label: storageScan.volume.free_label,
            pressure_percent: storageScan.volume.pressure_percent,
            drift: {
              unindexed_media_count: storageScan.drift.unindexed_media_count,
              indexed_missing_count: storageScan.drift.indexed_missing_count,
            },
            orphan_sidecar_count: storageScan.orphan_sidecars.length,
          }
        : {
            scanned: false,
          },
      queue: {
        counts: queueConsoleCounts,
        worker_plan_ready: Boolean(queueConsoleWorkerPlan),
        claimable_count: queueConsoleWorkerPlan?.claimable_count ?? null,
        locked_reason_present: Boolean(queueConsoleWorkerPlan?.locked_reason),
      },
      library: {
        total: library?.total ?? 0,
        archived: library?.archived ?? 0,
        missing: library?.missing ?? 0,
      },
      audit: {
        recent_event_count: events.length,
        scheduler_tick_count: runtimeSettings?.scheduler_ticks.length ?? 0,
        metadata_tick_count: runtimeSettings?.metadata_sync_ticks.length ?? 0,
      },
      support_bundle: {
        source: supportBundleSource,
        server_redaction_preferred: true,
      },
    };
  }

  async function handleCopyBetaProof() {
    try {
      await copyTextToClipboard(JSON.stringify(buildBetaProofPayload(), null, 2));
      setBetaProofCopyStatus("copied");
      window.setTimeout(() => setBetaProofCopyStatus("idle"), 1800);
    } catch {
      setBetaProofCopyStatus("error");
      window.setTimeout(() => setBetaProofCopyStatus("idle"), 2200);
    }
  }

  function handleDownloadBetaProof() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(
      `channel-vault-beta-proof-${timestamp}.json`,
      JSON.stringify(buildBetaProofPayload(), null, 2),
      "application/json;charset=utf-8",
    );
  }

  async function handleCopyDownloadRunSummary() {
    let serverSummary: Awaited<ReturnType<typeof getDownloadWorkerRunSummary>> | null = null;
    try {
      serverSummary = await getDownloadWorkerRunSummary(registeredChannelId ?? undefined, latestWorkerRun?.id);
    } catch {
      serverSummary = null;
    }
    const summarizeJob = (job: DownloadJob) => ({
      id: job.id,
      video_id: job.video_id,
      video_external_id: job.video_external_id,
      title: job.video_title,
      status: job.status,
      progress: job.progress,
      quality: job.quality,
      priority: job.priority,
      archive_path: job.archive_path,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error_message: job.error_message,
    });
    const payload = {
      kind: "download_run_summary",
      generated_at: new Date().toISOString(),
      channel_id: registeredChannelId,
      channel_title: channelDetail?.title ?? null,
      server_summary: serverSummary,
      latest_worker_run: serverSummary?.run ?? latestWorkerRun,
      archive_txt: {
        staged_job_ids: archiveTxtStageResult?.job_ids ?? [],
        staged_video_ids: archiveTxtStageResult?.video_ids ?? [],
        archived_skip_count: archiveTxtPreview?.archived_count ?? archiveSkipCount,
        duplicate_count: archiveTxtPreview?.duplicate_count ?? 0,
        invalid_count: archiveTxtPreview?.invalid_count ?? 0,
        candidates_created: archiveTxtStageResult?.candidates_created ?? 0,
      },
      latest_worker_jobs: (serverSummary?.latest_worker_jobs ?? latestWorkerJobs).map(summarizeJob),
      archive_txt_jobs: archiveTxtSummaryJobs.map(summarizeJob),
      completed_jobs: (serverSummary?.completed_jobs ?? recentCompletedJobs).map(summarizeJob),
      archived_files:
        serverSummary?.archived_files ??
        recentArchivedLibraryItems.map((item) => ({
          video_id: item.id,
          video_external_id: item.video_external_id,
          title: item.title,
          archive_state: item.archive_state,
          integrity_state: item.integrity_state,
          media_count: item.media_count,
          total_bytes: item.total_bytes,
          total_label: item.total_label,
          media_files: item.media_files,
        })),
    };
    try {
      await copyTextToClipboard(JSON.stringify(payload, null, 2));
      setDownloadRunSummaryCopyStatus("copied");
      window.setTimeout(() => setDownloadRunSummaryCopyStatus("idle"), 1800);
    } catch {
      setDownloadRunSummaryCopyStatus("error");
      window.setTimeout(() => setDownloadRunSummaryCopyStatus("idle"), 2200);
    }
  }

  function handleDownloadTickRows(kind: "scheduler" | "metadata", format: AuditExportFormat) {
    const rows = kind === "scheduler" ? schedulerTickRows : metadataTickRows;
    const filenamePrefix = kind === "scheduler" ? "download-scheduler-ticks" : "metadata-sync-ticks";
    downloadAuditRows(filenamePrefix, rows as unknown as Record<string, unknown>[], format);
  }

  function handleDownloadWorkerSummary(format: AuditExportFormat, scope: "channel" | "latest" = "channel") {
    const params = new URLSearchParams({ format });
    if (scope === "channel") {
      if (typeof registeredChannelId === "number") params.set("channel_id", String(registeredChannelId));
      if (typeof latestWorkerRun?.id === "number") params.set("run_id", String(latestWorkerRun.id));
    }
    triggerDownloadUrl(apiUrl(`/api/jobs/downloads/worker/summary/export?${params}`));
  }

  async function handlePruneTickRows(kind: "scheduler" | "metadata") {
    const confirmKey: TranslationKey =
      kind === "scheduler" ? "runtime.ticks.retentionConfirm" : "runtime.metadataTicks.retentionConfirm";
    const keep = normalizeRetentionKeep(kind === "scheduler" ? schedulerRetentionKeep : metadataRetentionKeep, 200);
    if (!window.confirm(t(confirmKey).replace("{keep}", String(keep)))) return;
    const setStatus = kind === "scheduler" ? setSchedulerTickRetentionStatus : setMetadataTickRetentionStatus;
    setStatus("pruning");
    try {
      const result = kind === "scheduler" ? await pruneSchedulerTicks(keep) : await pruneMetadataSyncTicks(keep);
      if (kind === "scheduler") {
        await refreshSchedulerTicks();
      } else {
        await refreshMetadataTicks();
      }
      setStatus("pruned");
      setWorkflowStatus("idle");
      setWorkflowMessage(
        t("runtime.ticks.retentionDone")
          .replace("{count}", String(result.deleted))
          .replace("{keep}", String(result.keep_latest)),
      );
      window.setTimeout(() => setStatus("idle"), 2200);
    } catch (error) {
      setStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
      window.setTimeout(() => setStatus("idle"), 2600);
    }
  }

  async function loadEventLog(query: ArchiveEventFilters, scopeLabel: string) {
    setEventLogQuery(query);
    setEventLogScopeLabel(scopeLabel);
    setEventLogStatus("loading");
    try {
      const rows = await getRecentEvents(200, query);
      setEventLogRows(rows);
      if (!scopeLabel) setEvents(rows.slice(0, 100));
      setEventLogStatus("idle");
    } catch {
      setEventLogStatus("error");
    }
  }

  async function handleRefreshEventLog() {
    await loadEventLog(eventLogQuery, eventLogScopeLabel);
  }

  async function handleOpenEventLog() {
    setEventLogFilter("all");
    setEventLogHighlightId(null);
    setEventDetail(null);
    setEventDetailCopyStatus("idle");
    setEventDetailCurlStatus("idle");
    setEventLogOpen(true);
    await loadEventLog({}, "");
  }

  async function loadRuntimeRestartEvents() {
    setRuntimeRestartEventsStatus("loading");
    try {
      const rows = await getRecentEvents(8, { type_prefix: "runtime.restart" });
      setRuntimeRestartEvents(rows);
      setRuntimeRestartEventsStatus("idle");
    } catch {
      setRuntimeRestartEventsStatus("error");
    }
  }

  async function handleOpenRuntimeGuide() {
    setRuntimeGuideCopyStatus("idle");
    setRuntimeRestartCopyStatus("idle");
    setRuntimeRestartStatus("idle");
    setRuntimeRestartMessage("");
    setRuntimeRestartPresetCopyStatus(null);
    setRuntimeComposeSmokeCopyStatus("idle");
    setRuntimeBackupCopyStatus(null);
    setRuntimeApplyStatus("idle");
    setRuntimeApplyMessage("");
    setRuntimeGuideOpen(true);
    await loadRuntimeRestartEvents();
  }

  async function handleOpenRuntimeRestartEventLog() {
    setEventLogFilter("runtime");
    setEventLogHighlightId(null);
    setEventDetail(null);
    setEventDetailCopyStatus("idle");
    setEventDetailCurlStatus("idle");
    setEventLogOpen(true);
    await loadEventLog({ type_prefix: "runtime.restart" }, t("runtime.restart.ledgerTitle"));
  }

  async function handleOpenRuntimeRestartMissionLog(mission: OperationMission) {
    const targetEventId = Number(mission.target_id);
    setEventLogFilter("runtime");
    setEventLogHighlightId(Number.isFinite(targetEventId) ? targetEventId : null);
    setEventDetail(null);
    setEventDetailCopyStatus("idle");
    setEventDetailCurlStatus("idle");
    setEventLogOpen(true);
    const query = Number.isFinite(targetEventId)
      ? { event_id: targetEventId, type_prefix: "runtime.restart" }
      : { type_prefix: "runtime.restart" };
    await loadEventLog(
      query,
      Number.isFinite(targetEventId)
        ? `${t("runtime.restart.ledgerTitle")} · #${targetEventId}`
        : t("runtime.restart.ledgerTitle"),
    );
  }

  async function handleOpenQueueJobEventLog(job: DownloadJob) {
    setEventLogFilter("download");
    setEventLogHighlightId(null);
    setEventDetail(null);
    setEventDetailCopyStatus("idle");
    setEventDetailCurlStatus("idle");
    setEventLogOpen(true);
    await loadEventLog(
      { type_prefix: "download.", job_id: job.id },
      `${t("events.scopeJob")} #${job.id} · ${job.video_title}`,
    );
  }

  async function handleCopyEventLog() {
    try {
      await copyTextToClipboard(
        JSON.stringify(
          {
            kind: "archive_event_log",
            filter: eventLogFilter,
            query: eventLogQuery,
            scope: eventLogScopeLabel || null,
            highlighted_event_id: eventLogHighlightId,
            count: filteredEventLogRows.length,
            events: filteredEventLogRows,
          },
          null,
          2,
        ),
      );
      setEventLogCopyStatus("copied");
      window.setTimeout(() => setEventLogCopyStatus("idle"), 1800);
    } catch {
      setEventLogCopyStatus("error");
      window.setTimeout(() => setEventLogCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyEventDetail() {
    if (!eventDetail) return;
    try {
      await copyTextToClipboard(JSON.stringify(eventDetail, null, 2));
      setEventDetailCopyStatus("copied");
      window.setTimeout(() => setEventDetailCopyStatus("idle"), 1800);
    } catch {
      setEventDetailCopyStatus("error");
      window.setTimeout(() => setEventDetailCopyStatus("idle"), 2200);
    }
  }

  async function handleCopyEventDetailCurl() {
    if (typeof eventDetail?.id !== "number") return;
    try {
      await copyTextToClipboard(buildEventDetailCurlCommand(eventDetail.id));
      setEventDetailCurlStatus("copied");
      window.setTimeout(() => setEventDetailCurlStatus("idle"), 1800);
    } catch {
      setEventDetailCurlStatus("error");
      window.setTimeout(() => setEventDetailCurlStatus("idle"), 2200);
    }
  }

  async function handleOpenEventDetailChannelTarget() {
    if (!eventDetailTargetChannelId) return;
    setEventLogOpen(false);
    setEventDetail(null);
    setEventDetailCopyStatus("idle");
    setEventDetailCurlStatus("idle");
    setActiveNavId("channels");
    setSelectedChannelId(eventDetailTargetChannelId);
    setActiveChannelTab("overview");
    setWorkflowStatus("idle");
    setWorkflowMessage(t("events.detailOpenedChannel").replace("{id}", String(eventDetailTargetChannelId)));
    await loadChannelState(eventDetailTargetChannelId).catch(() => undefined);
    scrollToAppSection(".channel-detail-panel");
  }

  async function handleOpenEventDetailQueueTarget() {
    if (!eventDetailTargetJobId) return;
    const targetJobIds = eventDetailTargetJobIds.length ? eventDetailTargetJobIds : [eventDetailTargetJobId];
    setEventLogOpen(false);
    setEventDetail(null);
    setEventDetailCopyStatus("idle");
    setEventDetailCurlStatus("idle");
    setActiveNavId("queue");
    setQueueConsoleSearch("");
    setQueueConsoleStatusFilter("all");
    setQueueConsolePreflightFilter("all");
    setQueueConsoleChannelFilter(eventDetailTargetChannelId ? String(eventDetailTargetChannelId) : "all");
    setQueueConsoleSelectedJobIds(targetJobIds);
    setExpandedQueueConsoleJobId(eventDetailTargetJobId);
    setWorkflowStatus("idle");
    setWorkflowMessage(t("events.detailOpenedQueue").replace("{id}", String(eventDetailTargetJobId)));
    await refreshQueueConsoleState().catch(() => undefined);
    scrollToAppSection(".queue-console-panel");
  }

  function handleDownloadEventLog(format: AuditExportFormat) {
    downloadAuditRows("archive-event-log", filteredEventLogRows as unknown as Record<string, unknown>[], format);
  }

  function handleDownloadEventDetail(format: AuditExportFormat) {
    if (!eventDetail) return;
    if (typeof eventDetail.id === "number") {
      triggerDownloadUrl(buildEventDetailExportUrl(eventDetail.id, format));
      return;
    }
    downloadAuditRows("archive-event-detail", [eventDetail as unknown as Record<string, unknown>], format);
  }

  async function handlePruneEventLog() {
    const keep = normalizeRetentionKeep(eventLogRetentionKeep, 500);
    if (!window.confirm(t("events.retentionConfirm").replace("{keep}", String(keep)))) return;
    setEventLogRetentionStatus("pruning");
    try {
      const result = await pruneRecentEvents(keep);
      await loadEventLog(eventLogQuery, eventLogScopeLabel);
      setEventLogRetentionStatus("pruned");
      setWorkflowStatus("idle");
      setWorkflowMessage(
        t("events.retentionDone")
          .replace("{count}", String(result.deleted))
          .replace("{keep}", String(result.keep_latest)),
      );
      window.setTimeout(() => setEventLogRetentionStatus("idle"), 2200);
    } catch (error) {
      setEventLogRetentionStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
      window.setTimeout(() => setEventLogRetentionStatus("idle"), 2600);
    }
  }

  async function handleCopyRestartCommand() {
    try {
      await copyTextToClipboard(runtimeSettings?.restart_command ?? "");
      setRuntimeRestartCopyStatus("copied");
      window.setTimeout(() => setRuntimeRestartCopyStatus("idle"), 1800);
    } catch {
      setRuntimeRestartCopyStatus("error");
      window.setTimeout(() => setRuntimeRestartCopyStatus("idle"), 2200);
    }
  }

  async function handleRequestRuntimeRestart() {
    if (!runtimeSettings?.restart_adapter) return;
    setRuntimeRestartStatus("requesting");
    setRuntimeRestartMessage("");
    try {
      const result = await requestRuntimeRestart("operator requested runtime restart after env apply");
      const runtimeSnapshot = await getRuntimeSettings();
      setRuntimeSettings(runtimeSnapshot);
      await loadRuntimeRestartEvents();
      setRuntimeRestartStatus(result.requested ? "requested" : "manual");
      setRuntimeRestartMessage(result.requested ? t("runtime.restart.requested") : result.message);
    } catch (error) {
      setRuntimeRestartStatus("error");
      setRuntimeRestartMessage(error instanceof Error ? error.message : t("runtime.restart.error"));
    }
  }

  async function handleApplyRuntimeSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runtimeDraftValid) {
      setRuntimeApplyStatus("error");
      setRuntimeApplyMessage(t("runtime.apply.invalid"));
      return;
    }
    setRuntimeApplyStatus("applying");
    setRuntimeApplyMessage("");
    const payload: RuntimeSettingsUpdate = {
      download_worker_enabled: runtimeDraft.downloadWorkerEnabled,
      download_worker_scheduler_enabled: runtimeDraft.schedulerEnabled,
      download_worker_scheduler_interval_seconds: runtimeDraftIntervalNumber,
      download_worker_scheduler_limit: runtimeDraftLimitNumber,
      metadata_sync_scheduler_enabled: runtimeDraft.metadataSchedulerEnabled,
      metadata_sync_scheduler_interval_seconds: runtimeDraftMetadataIntervalNumber,
      metadata_sync_scheduler_limit: runtimeDraftMetadataLimitNumber,
      ytdlp_binary: runtimeDraft.ytdlpBinary.trim(),
      ffprobe_binary: runtimeDraft.ffprobeBinary.trim(),
    };
    try {
      const result = await updateRuntimeSettings(payload);
      setRuntimeSettings(result.runtime);
      setRuntimeApplyStatus("saved");
      setRuntimeApplyMessage(
        result.restart_required
          ? t("runtime.apply.savedRestart").replace("{count}", String(result.changed_keys.length))
          : t("runtime.apply.savedClean").replace("{count}", String(result.changed_keys.length)),
      );
    } catch (error) {
      setRuntimeApplyStatus("error");
      setRuntimeApplyMessage(error instanceof Error ? error.message : t("runtime.apply.error"));
    }
  }

  async function refreshWorkerHistory(filter: WorkerHistoryFilter = workerHistoryFilter) {
    if (!registeredChannelId) return;
    const runs = await getDownloadWorkerRuns(registeredChannelId, 24, workerHistoryQuery(filter));
    setWorkerHistoryRuns(runs);
  }

  async function handleOpenWorkerHistory() {
    setWorkerHistoryRuns(workerRuns);
    setWorkerHistoryOpen(true);
    try {
      await refreshWorkerHistory();
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleWorkerHistoryFilter(filter: WorkerHistoryFilter) {
    setWorkerHistoryFilter(filter);
    try {
      await refreshWorkerHistory(filter);
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function refreshSchedulerTicks(
    statusFilter: SchedulerTickStatusFilter = schedulerTickStatusFilter,
    durationFilter: SchedulerDurationFilter = schedulerDurationFilter,
    intervalFilter: string = schedulerIntervalFilter,
    limitFilter: string = schedulerLimitFilter,
  ) {
    const filters = schedulerTickQuery(statusFilter, durationFilter, intervalFilter, limitFilter);
    const ticks = await getSchedulerTicks(48, filters);
    setSchedulerTickRows(ticks);
  }

  async function handleOpenSchedulerTicks() {
    setSchedulerTickRows(runtimeSettings?.scheduler_ticks ?? []);
    setSchedulerTickDrawerOpen(true);
    try {
      await refreshSchedulerTicks();
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleSchedulerTickStatus(filter: SchedulerTickStatusFilter) {
    setSchedulerTickStatusFilter(filter);
    try {
      await refreshSchedulerTicks(filter);
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleSchedulerDurationFilter(filter: SchedulerDurationFilter) {
    setSchedulerDurationFilter(filter);
    try {
      await refreshSchedulerTicks(schedulerTickStatusFilter, filter);
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleSchedulerNumericFilter(kind: "interval" | "limit", value: string) {
    if (kind === "interval") {
      setSchedulerIntervalFilter(value);
    } else {
      setSchedulerLimitFilter(value);
    }
    try {
      await refreshSchedulerTicks(
        schedulerTickStatusFilter,
        schedulerDurationFilter,
        kind === "interval" ? value : schedulerIntervalFilter,
        kind === "limit" ? value : schedulerLimitFilter,
      );
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleResetSchedulerTickFilters() {
    setSchedulerTickStatusFilter("all");
    setSchedulerDurationFilter("all");
    setSchedulerIntervalFilter("");
    setSchedulerLimitFilter("");
    try {
      await refreshSchedulerTicks("all", "all", "", "");
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function refreshMetadataTicks(
    statusFilter: SchedulerTickStatusFilter = metadataTickStatusFilter,
    durationFilter: SchedulerDurationFilter = metadataDurationFilter,
    intervalFilter: string = metadataIntervalFilter,
    limitFilter: string = metadataLimitFilter,
  ) {
    const filters = metadataTickQuery(statusFilter, durationFilter, intervalFilter, limitFilter);
    const ticks = await getMetadataSyncTicks(48, filters);
    setMetadataTickRows(ticks);
  }

  async function handleOpenMetadataTicks() {
    setMetadataTickRows(runtimeSettings?.metadata_sync_ticks ?? []);
    setMetadataTickDrawerOpen(true);
    try {
      await refreshMetadataTicks();
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleMetadataTickStatus(filter: SchedulerTickStatusFilter) {
    setMetadataTickStatusFilter(filter);
    try {
      await refreshMetadataTicks(filter);
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleMetadataDurationFilter(filter: SchedulerDurationFilter) {
    setMetadataDurationFilter(filter);
    try {
      await refreshMetadataTicks(metadataTickStatusFilter, filter);
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleMetadataNumericFilter(kind: "interval" | "limit", value: string) {
    if (kind === "interval") {
      setMetadataIntervalFilter(value);
    } else {
      setMetadataLimitFilter(value);
    }
    try {
      await refreshMetadataTicks(
        metadataTickStatusFilter,
        metadataDurationFilter,
        kind === "interval" ? value : metadataIntervalFilter,
        kind === "limit" ? value : metadataLimitFilter,
      );
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleResetMetadataTickFilters() {
    setMetadataTickStatusFilter("all");
    setMetadataDurationFilter("all");
    setMetadataIntervalFilter("");
    setMetadataLimitFilter("");
    try {
      await refreshMetadataTicks("all", "all", "", "");
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleRunMetadataSchedulerOnce() {
    setMetadataRunStatus("running");
    setWorkflowMessage("");
    try {
      const tick = await runMetadataSyncSchedulerOnce();
      const [runtimeSnapshot, ticks] = await Promise.all([
        getRuntimeSettings(),
        getMetadataSyncTicks(48, metadataTickQuery(metadataTickStatusFilter, metadataDurationFilter, metadataIntervalFilter, metadataLimitFilter)),
      ]);
      setRuntimeSettings(runtimeSnapshot);
      setMetadataTickRows(ticks);
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setMetadataRunStatus("done");
      setWorkflowStatus(tick.status === "failed" ? "error" : "idle");
      setWorkflowMessage(
        t("runtime.metadataScheduler.runDone")
          .replace("{status}", schedulerTickStatusLabel(tick.status, t))
          .replace("{synced}", String(tick.synced_count))
          .replace("{candidates}", String(tick.candidates_created_count)),
      );
    } catch (error) {
      setMetadataRunStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleFocusMetadataDueChannel(channelId: number) {
    setRegistration(null);
    setProbe(null);
    setSelectedChannelId(channelId);
    setWorkflowStatus("idle");
    setWorkflowMessage(t("runtime.metadataScheduler.focused"));
  }

  async function handleOpenLibraryDetail(item: LibraryItem) {
    setSelectedLibraryItem(item);
    setLibraryDetailStatus("loading");
    setSelectedLibraryFiles([]);
    try {
      const files = await getLibraryFiles(item.id);
      setSelectedLibraryFiles(files);
      setLibraryDetailStatus("idle");
    } catch (error) {
      setLibraryDetailStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleApplyLibraryPreset(presetId: LibraryPresetFilter) {
    const preset = libraryPresetFilters.find((item) => item.id === presetId);
    if (!preset) return;
    setActiveLibraryPreset(preset.id);
    setActiveSavedLibraryViewId(null);
    setLibraryIntegrityFilter(preset.integrity);
    setLibrarySidecarFilter(preset.sidecar);
    setLibraryCodecFilter(preset.codec);
  }

  function handleLibraryIntegrityFilter(filter: LibraryIntegrityFilter) {
    setActiveLibraryPreset(null);
    setActiveSavedLibraryViewId(null);
    setLibraryIntegrityFilter(filter);
  }

  function handleLibrarySidecarFilter(filter: LibrarySidecarFilter) {
    setActiveLibraryPreset(null);
    setActiveSavedLibraryViewId(null);
    setLibrarySidecarFilter(filter);
  }

  function handleResetLibraryFilters() {
    setActiveLibraryPreset(null);
    setActiveSavedLibraryViewId(null);
    setLibraryQuery("");
    setLibraryIntegrityFilter("all");
    setLibrarySidecarFilter("all");
    setLibraryCodecFilter("");
    setLibraryViewNameDraft("");
  }

  function handleOpenStorageTriageView(target: "missing_media" | "partial_sidecars") {
    setActiveChannelTab("library");
    setActiveLibraryPreset(null);
    setActiveSavedLibraryViewId(null);
    setLibraryQuery("");
    setLibraryCodecFilter("");
    setLibraryIntegrityFilter(target);
    setLibrarySidecarFilter(target === "partial_sidecars" ? "any" : "all");
  }

  async function handleCopyStorageReport() {
    if (!storageScan) return;
    try {
      await copyTextToClipboard(
        JSON.stringify(
          {
            kind: "storage_scan_report",
            scanned_at: storageScan.scanned_at,
            root: storageScan.volume.root,
            row_count: storageReportRows.length,
            rows: storageReportRows,
          },
          null,
          2,
        ),
      );
      setStorageReportCopyStatus("copied");
      window.setTimeout(() => setStorageReportCopyStatus("idle"), 1800);
    } catch {
      setStorageReportCopyStatus("error");
      window.setTimeout(() => setStorageReportCopyStatus("idle"), 2200);
    }
  }

  function handleDownloadStorageReport(format: AuditExportFormat) {
    downloadAuditRows("storage-scan", storageReportRows, format);
  }

  async function handleCaptureStoragePressureSnapshot() {
    setStoragePressureStatus("saving");
    setWorkflowMessage("");
    try {
      const [trend, recentEvents] = await Promise.all([
        captureStoragePressureSnapshot(),
        getRecentEvents(100),
      ]);
      setStoragePressureTrend(trend);
      if (activeStorageChannel?.relative_path) {
        getStorageChannelPressureTrend(activeStorageChannel.relative_path).then(setStorageChannelPressureTrend).catch(() => undefined);
      }
      setEvents(recentEvents);
      setStoragePressureStatus("done");
      setWorkflowStatus("idle");
      setWorkflowMessage(
        t("storage.pressure.captureDone")
          .replace("{count}", String(trend.snapshots.length))
          .replace("{size}", trend.latest?.archive_label ?? "0 MB"),
      );
      window.setTimeout(() => setStoragePressureStatus("idle"), 1800);
    } catch (error) {
      setStoragePressureStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
      window.setTimeout(() => setStoragePressureStatus("idle"), 2200);
    }
  }

  function handleDownloadStorageQuarantine(format: AuditExportFormat) {
    downloadAuditRows("storage-quarantine", storageQuarantineRows, format);
  }

  async function handlePreviewOrphanQuarantine(sidecar: StorageOrphanSidecar) {
    setSelectedStorageOrphan(sidecar);
    setStorageOrphanQuarantinePlan(null);
    setStorageOrphanQuarantineStatus("planning");
    setWorkflowMessage("");
    try {
      const plan = await quarantineStorageOrphanSidecar(sidecar.relative_path, true);
      setStorageOrphanQuarantinePlan(plan);
      setStorageOrphanQuarantineStatus(plan.warnings.length ? "error" : "idle");
      if (plan.warnings.length) {
        setWorkflowStatus("error");
        setWorkflowMessage(plan.warnings.join(" · "));
      }
    } catch (error) {
      setStorageOrphanQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleApplyOrphanQuarantine() {
    if (!selectedStorageOrphan) return;
    setStorageOrphanQuarantineStatus("running");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await quarantineStorageOrphanSidecar(selectedStorageOrphan.relative_path, false);
      const [snapshot, recentEvents, storageSnapshot] = await Promise.all([getDashboard(), getRecentEvents(100), getStorageScan()]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setStorageScan(storageSnapshot);
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setStorageOrphanQuarantinePlan(result);
      setStorageOrphanQuarantineStatus(result.applied ? "done" : "error");
      setWorkflowStatus(result.applied ? "idle" : "error");
      setWorkflowMessage(
        result.applied
          ? t("storage.orphan.quarantineDone")
              .replace("{path}", compactArchivePath(result.destination_relative_path ?? selectedStorageOrphan.relative_path))
              .replace("{size}", selectedStorageOrphan.label)
          : result.warnings.join(" · ") || t("workflow.error"),
      );
      if (result.applied) {
        window.setTimeout(() => {
          setSelectedStorageOrphan(null);
          setStorageOrphanQuarantinePlan(null);
          setStorageOrphanQuarantineStatus("idle");
        }, 1200);
      }
    } catch (error) {
      setStorageOrphanQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function refreshStorageQuarantine() {
    const quarantine = await getStorageOrphanQuarantine(100);
    setStorageQuarantine(quarantine);
    return quarantine;
  }

  async function handleOpenStorageQuarantine() {
    setStorageQuarantineOpen(true);
    setSelectedStorageQuarantineItem(null);
    setStorageQuarantineRestorePlan(null);
    setStorageQuarantinePurgePlan(null);
    setStorageQuarantineStatus("loading");
    setWorkflowMessage("");
    try {
      await refreshStorageQuarantine();
      setStorageQuarantineStatus("idle");
    } catch (error) {
      setStorageQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handlePreviewStorageQuarantineRestore(item: StorageQuarantineItem) {
    setSelectedStorageQuarantineItem(item);
    setStorageQuarantineRestorePlan(null);
    setStorageQuarantinePurgePlan(null);
    setStorageQuarantineStatus("planning");
    setWorkflowMessage("");
    try {
      const plan = await restoreStorageOrphanSidecar(item.relative_path, true);
      setStorageQuarantineRestorePlan(plan);
      setStorageQuarantineStatus(plan.warnings.length ? "error" : "idle");
      if (plan.warnings.length) {
        setWorkflowStatus("error");
        setWorkflowMessage(plan.warnings.join(" · "));
      }
    } catch (error) {
      setStorageQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleApplyStorageQuarantineRestore() {
    if (!selectedStorageQuarantineItem) return;
    setStorageQuarantineStatus("running");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await restoreStorageOrphanSidecar(selectedStorageQuarantineItem.relative_path, false);
      const [snapshot, recentEvents, storageSnapshot] = await Promise.all([
        getDashboard(),
        getRecentEvents(100),
        getStorageScan(),
        refreshStorageQuarantine(),
      ]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setStorageScan(storageSnapshot);
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setStorageQuarantineRestorePlan(result);
      setStorageQuarantineStatus(result.applied ? "done" : "error");
      setWorkflowStatus(result.applied ? "idle" : "error");
      setWorkflowMessage(
        result.applied
          ? t("storage.quarantine.restoreDone")
              .replace("{path}", compactArchivePath(result.destination_relative_path ?? selectedStorageQuarantineItem.original_relative_path))
              .replace("{size}", selectedStorageQuarantineItem.label)
          : result.warnings.join(" · ") || t("workflow.error"),
      );
      if (result.applied) {
        window.setTimeout(() => {
          setSelectedStorageQuarantineItem(null);
          setStorageQuarantineRestorePlan(null);
          setStorageQuarantineStatus("idle");
        }, 1200);
      }
    } catch (error) {
      setStorageQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function readStorageQuarantinePurgeAge() {
    const parsed = Number.parseInt(storageQuarantinePurgeAge, 10);
    if (!Number.isFinite(parsed)) return 30;
    return Math.min(3650, Math.max(1, parsed));
  }

  async function handlePreviewStorageQuarantinePurge() {
    setSelectedStorageQuarantineItem(null);
    setStorageQuarantineRestorePlan(null);
    setStorageQuarantinePurgePlan(null);
    setStorageQuarantineStatus("planning");
    setWorkflowMessage("");
    try {
      const plan = await purgeStorageOrphanQuarantine(readStorageQuarantinePurgeAge(), true);
      setStorageQuarantinePurgePlan(plan);
      setStorageQuarantineStatus(plan.warnings.length ? "error" : "idle");
      if (plan.warnings.length) {
        setWorkflowStatus("error");
        setWorkflowMessage(plan.warnings.join(" · "));
      }
    } catch (error) {
      setStorageQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleApplyStorageQuarantinePurge() {
    if (!storageQuarantinePurgePlan) return;
    setStorageQuarantineStatus("running");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await purgeStorageOrphanQuarantine(
        storageQuarantinePurgePlan.min_age_days,
        false,
        storageQuarantinePurgeConfirm,
      );
      const [snapshot, recentEvents, storageSnapshot] = await Promise.all([
        getDashboard(),
        getRecentEvents(100),
        getStorageScan(),
        refreshStorageQuarantine(),
      ]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setStorageScan(storageSnapshot);
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setSelectedStorageQuarantineItem(null);
      setStorageQuarantineRestorePlan(null);
      setStorageQuarantinePurgePlan(result);
      setStorageQuarantineStatus(result.warnings.length ? "error" : "done");
      setWorkflowStatus(result.warnings.length ? "error" : "idle");
      setWorkflowMessage(
        result.warnings.length
          ? result.warnings.join(" · ")
          : result.deleted_files
            ? t("storage.quarantine.purgeDone")
                .replace("{count}", String(result.deleted_files))
                .replace("{size}", result.deleted_label)
            : t("storage.quarantine.purgeNothing"),
      );
      if (!result.warnings.length) {
        setStorageQuarantinePurgeConfirm("");
      }
    } catch (error) {
      setStorageQuarantineStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleSaveLibraryView() {
    const name = savedLibraryViewName.trim();
    if (!name) return;
    await persistLibraryView(name);
  }

  async function handleOverwriteSavedLibraryView() {
    if (!activeSavedLibraryView) return;
    await persistLibraryView(activeSavedLibraryView.name);
  }

  async function persistLibraryView(name: string) {
    const now = new Date().toISOString();
    const nextView: SavedLibraryView = {
      id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      query: libraryQuery,
      integrity: libraryIntegrityFilter,
      sidecar: librarySidecarFilter,
      codec: libraryCodecFilter,
      createdAt: now,
      updatedAt: now,
    };
    setSavedLibraryViews((current) => [nextView, ...current.filter((view) => view.name !== name)].slice(0, 10));
    setActiveSavedLibraryViewId(nextView.id);
    setLibraryViewNameDraft("");
    try {
      const saved = await saveLibraryView({
        name,
        query: libraryQuery,
        integrity: libraryIntegrityFilter,
        sidecar: librarySidecarFilter,
        codec: libraryCodecFilter,
      });
      const persistedView = toSavedLibraryView(saved);
      setSavedLibraryViews((current) => [persistedView, ...current.filter((view) => view.name !== name)].slice(0, 10));
      setActiveSavedLibraryViewId(persistedView.id);
      setWorkflowStatus("idle");
      setWorkflowMessage(t("library.saved.saved"));
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleApplySavedLibraryView(view: SavedLibraryView) {
    setActiveLibraryPreset(null);
    setActiveSavedLibraryViewId(view.id);
    setLibraryQuery(view.query);
    setLibraryIntegrityFilter(view.integrity);
    setLibrarySidecarFilter(view.sidecar);
    setLibraryCodecFilter(view.codec);
  }

  async function handleDeleteSavedLibraryView(viewId: string) {
    setSavedLibraryViews((current) => current.filter((view) => view.id !== viewId));
    if (activeSavedLibraryViewId === viewId) setActiveSavedLibraryViewId(null);
    const persistedId = Number(viewId);
    if (!Number.isInteger(persistedId)) return;
    try {
      await deleteLibraryView(persistedId);
    } catch (error) {
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  function handleToggleJobSelection(jobId: number) {
    if (!actionableQueueJobs.some((job) => job.id === jobId)) return;
    setSelectedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId],
    );
  }

  function handleSelectVisibleJobs() {
    if (allVisibleJobsSelected) {
      const visibleIds = new Set(visibleActionableJobs.map((job) => job.id));
      setSelectedJobIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }
    setSelectedJobIds((current) => Array.from(new Set([...current, ...visibleActionableJobs.map((job) => job.id)])));
  }

  function applyDownloadJobs(jobs: DownloadJob[]) {
    setDownloadJobs(jobs);
    const activeIds = new Set(jobs.filter(isSelectableQueueJob).map((job) => job.id));
    setSelectedJobIds((current) => current.filter((id) => activeIds.has(id)));
  }

  function applyGlobalDownloadJobs(jobs: DownloadJob[]) {
    setGlobalDownloadJobs(jobs);
    const activeIds = new Set(jobs.filter(isSelectableQueueJob).map((job) => job.id));
    setQueueConsoleSelectedJobIds((current) => current.filter((id) => activeIds.has(id)));
  }

  function applyDownloadTelemetryEvent(event: ArchiveEvent) {
    const status = downloadTelemetryStatusFromEvent(event.type);
    if (!status) return;
    const jobId = readEventNumber(event.data, "job_id");
    if (jobId === null) return;
    setDownloadTelemetry((current) => {
      const existing = current[jobId];
      const percent =
        status === "completed"
          ? 100
          : readEventNumber(event.data, "percent") ?? existing?.percent ?? (status === "running" ? 0 : 100);
      return {
        ...current,
        [jobId]: {
          jobId,
          videoId: readEventNumber(event.data, "video_id") ?? existing?.videoId ?? null,
          videoTitle: readEventString(event.data, "video_title") ?? existing?.videoTitle ?? `Job #${jobId}`,
          channelId: readEventNumber(event.data, "channel_id") ?? existing?.channelId ?? null,
          channelTitle: readEventString(event.data, "channel_title") ?? existing?.channelTitle ?? null,
          archiveDir: readEventString(event.data, "archive_dir") ?? existing?.archiveDir ?? null,
          quality: readEventString(event.data, "quality") ?? existing?.quality ?? null,
          percent: Math.max(0, Math.min(percent, 100)),
          speed: readEventString(event.data, "speed") ?? existing?.speed ?? null,
          eta: readEventString(event.data, "eta") ?? existing?.eta ?? null,
          status,
          error: readEventString(event.data, "error") ?? existing?.error ?? null,
          updatedAt: event.occurred_at,
        },
      };
    });
  }

  async function refreshChannelAfterEvent(channelId: number, eventType: string) {
    if (eventType === "download.progress" || eventType === "download.started" || eventType === "download.preflight") {
      const [jobs, workerSnapshot] = await Promise.all([
        getDownloadJobs(channelId),
        getDownloadWorkerPlan(channelId),
      ]);
      applyDownloadJobs(jobs);
      setWorkerPlan(workerSnapshot);
      return;
    }
    if (
      eventType.startsWith("download.") ||
      eventType === "library.rescan.applied" ||
      eventType === "sync.completed" ||
      eventType === "download.bulk"
    ) {
      await loadChannelState(channelId);
    }
  }

  async function refreshQueueConsoleState() {
    const [jobs, workerSnapshot, workerRunSnapshot] = await Promise.all([
      getDownloadJobs(undefined, { limit: 200 }),
      getDownloadWorkerPlan(undefined, 5),
      getDownloadWorkerRuns(undefined, 8),
    ]);
    applyGlobalDownloadJobs(jobs);
    setQueueConsoleWorkerPlan(workerSnapshot);
    setQueueConsoleWorkerRuns(workerRunSnapshot);
  }

  async function refreshOperationsReadiness() {
    const [readiness, mountDoctorSnapshot] = await Promise.all([getOperationsReadiness(), getMountDoctor()]);
    setOperationsReadiness(readiness);
    setMountDoctor(mountDoctorSnapshot);
  }

  async function handleRefreshMountDoctor() {
    setMountDoctorStatus("refreshing");
    try {
      const mountDoctorSnapshot = await getMountDoctor();
      setMountDoctor(mountDoctorSnapshot);
      setMountDoctorStatus("done");
      window.setTimeout(() => setMountDoctorStatus("idle"), 1400);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMountDoctorStatus("error");
      window.setTimeout(() => setMountDoctorStatus("idle"), 1800);
    }
  }

  function pushAppRoute(overrides: Partial<AppRoute>) {
    const nav = overrides.nav ?? activeNavId;
    const route: AppRoute = {
      nav,
      channelTab:
        nav === "channels"
          ? (overrides.channelTab ?? (activeChannelTab === "library" ? "overview" : activeChannelTab))
          : undefined,
      channelId: overrides.channelId ?? registeredChannelId ?? undefined,
      queueJobIds:
        nav === "queue"
          ? (overrides.queueJobIds ??
            (queueConsoleSelectedJobIds.length
              ? queueConsoleSelectedJobIds
              : expandedQueueConsoleJobId
                ? [expandedQueueConsoleJobId]
                : undefined))
          : undefined,
      runtimeGuide: overrides.runtimeGuide ?? (nav === "settings" && runtimeGuideOpen),
      eventLog: overrides.eventLog ?? eventLogOpen,
    };
    writeAppHash(route, "push");
  }

  function handleTopbarSearch() {
    if (!registeredChannelId) {
      setActiveNavId("channels");
      pushAppRoute({ nav: "channels", channelTab: "overview" });
      setWorkflowStatus("idle");
      setWorkflowMessage(t("channel.workbench.noChannel"));
      window.setTimeout(() => scrollToAppSection(".registration-panel"), 0);
      return;
    }
    setActiveNavId("library");
    setActiveChannelTab("library");
    pushAppRoute({ nav: "library" });
    window.setTimeout(() => {
      scrollToAppSection(".library-index-panel");
      librarySearchInputRef.current?.focus();
    }, 0);
  }

  function openCommandPalette() {
    setCommandPaletteOpen(true);
    setCommandPaletteQuery("");
    window.setTimeout(() => commandPaletteInputRef.current?.focus(), 0);
  }

  function closeCommandPalette() {
    setCommandPaletteOpen(false);
    setCommandPaletteQuery("");
  }

  function runCommandPaletteItem(item: CommandPaletteItem) {
    if (item.disabled) return;
    closeCommandPalette();
    item.run();
  }

  async function handleTopbarRefresh() {
    setTopbarRefreshStatus("refreshing");
    setWorkflowMessage("");
    try {
      const [snapshot, recentEvents, runtimeSnapshot, storageSnapshot, pressureTrend, readinessSnapshot, mountDoctorSnapshot] = await Promise.all([
        getDashboard(),
        getRecentEvents(100),
        getRuntimeSettings(),
        getStorageScan(),
        getStoragePressureTrend(),
        getOperationsReadiness(),
        getMountDoctor(),
      ]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setRuntimeSettings(runtimeSnapshot);
      setStorageScan(storageSnapshot);
      setStoragePressureTrend(pressureTrend);
      setOperationsReadiness(readinessSnapshot);
      setMountDoctor(mountDoctorSnapshot);
      await refreshQueueConsoleState();
      if (registeredChannelId) {
        await loadChannelState(registeredChannelId);
      }
      setTopbarRefreshStatus("done");
      setWorkflowStatus("idle");
      window.setTimeout(() => setTopbarRefreshStatus("idle"), 1400);
    } catch (error) {
      setTopbarRefreshStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
      window.setTimeout(() => setTopbarRefreshStatus("idle"), 1800);
    }
  }

  async function handleRefreshOperationsReadiness() {
    setOperationsStatus("refreshing");
    try {
      await refreshOperationsReadiness();
      setOperationsStatus("done");
      window.setTimeout(() => setOperationsStatus("idle"), 1400);
    } catch {
      setOperationsStatus("error");
      window.setTimeout(() => setOperationsStatus("idle"), 1800);
    }
  }

  async function handleSeedDemoWorkspace() {
    setDemoSeedStatus("loading");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    setDemoClearStatus("idle");
    try {
      const result = await seedDemoWorkspace();
      if (!result.channel_id) {
        setDemoSeedStatus("skipped");
        setWorkflowStatus("idle");
        setWorkflowMessage(t("firstRun.demo.blocked"));
        return;
      }
      const [snapshot, recentEvents, runtimeSnapshot, storageSnapshot, pressureTrend, readinessSnapshot, mountDoctorSnapshot] = await Promise.all([
        getDashboard(),
        getRecentEvents(100),
        getRuntimeSettings(),
        getStorageScan(),
        getStoragePressureTrend(),
        getOperationsReadiness(),
        getMountDoctor(),
      ]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setRuntimeSettings(runtimeSnapshot);
      setStorageScan(storageSnapshot);
      setStoragePressureTrend(pressureTrend);
      setOperationsReadiness(readinessSnapshot);
      setMountDoctor(mountDoctorSnapshot);
      await refreshQueueConsoleState();
      setSelectedChannelId(result.channel_id);
      setRegistration(null);
      setProbe(null);
      await loadChannelState(result.channel_id);
      setActiveNavId("channels");
      setActiveChannelTab("downloads");
      pushAppRoute({ nav: "channels", channelTab: "downloads", channelId: result.channel_id });
      window.setTimeout(() => scrollToAppSection(".channel-detail-panel"), 0);
      setDemoSeedStatus(result.created ? "done" : "skipped");
      setWorkflowStatus("idle");
      setWorkflowMessage(demoSeedMessage(result, t));
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setDemoSeedStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleClearDemoWorkspace() {
    setDemoClearStatus("loading");
    setWorkflowStatus("bulk");
    setWorkflowMessage("");
    try {
      const result = await clearDemoWorkspace();
      const [snapshot, recentEvents, runtimeSnapshot, storageSnapshot, pressureTrend, readinessSnapshot, mountDoctorSnapshot] = await Promise.all([
        getDashboard(),
        getRecentEvents(100),
        getRuntimeSettings(),
        getStorageScan(),
        getStoragePressureTrend(),
        getOperationsReadiness(),
        getMountDoctor(),
      ]);
      setDashboard(snapshot);
      setEvents(recentEvents);
      setRuntimeSettings(runtimeSnapshot);
      setStorageScan(storageSnapshot);
      setStoragePressureTrend(pressureTrend);
      setOperationsReadiness(readinessSnapshot);
      setMountDoctor(mountDoctorSnapshot);
      await refreshQueueConsoleState();
      if (result.cleared) {
        setSelectedChannelId(null);
        setRegistration(null);
        setProbe(null);
        setChannelDetail(null);
        setChannelPolicy(null);
        setChannelVideos([]);
        setChannelCoverage(null);
        setChannelMissingVideos([]);
        setChannelCadence(null);
        setSyncJobs([]);
        setDownloadJobs([]);
        setPreflightPlan(null);
        setSelectedJobIds([]);
        setSelectionSeedKey("");
        setLibrary(null);
        setWorkerPlan(null);
        setWorkerRuns([]);
        setStorageChannelPressureTrend(null);
        setActiveNavId("dashboard");
        setActiveChannelTab("overview");
        writeAppHash({ nav: "dashboard" }, "push");
      }
      setDemoClearStatus(result.cleared ? "done" : "skipped");
      setWorkflowStatus("idle");
      setWorkflowMessage(demoClearMessage(result, t));
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setDemoClearStatus("error");
      setWorkflowStatus("error");
      setWorkflowMessage(error instanceof Error ? error.message : t("workflow.error"));
    }
  }

  async function handleOperationsMissionAction(mission: OperationMission) {
    if (mission.action_kind === "snapshot") {
      await handleCaptureStoragePressureSnapshot();
      await refreshOperationsReadiness().catch(() => undefined);
      return;
    }
    if (mission.action_kind === "downloads") {
      if (mission.id === "clear_failed_downloads") {
        const jobId = Number(mission.target_id);
        setActiveNavId("queue");
        setQueueConsoleSearch("");
        setQueueConsoleStatusFilter("failed");
        setQueueConsolePreflightFilter("all");
        setQueueConsoleChannelFilter(mission.target_channel_id ? String(mission.target_channel_id) : "all");
        setQueueConsoleSelectedJobIds(Number.isFinite(jobId) ? [jobId] : []);
        setExpandedQueueConsoleJobId(Number.isFinite(jobId) ? jobId : null);
        await refreshQueueConsoleState().catch(() => undefined);
        scrollToAppSection(".queue-console-panel");
        return;
      }
      if (mission.id === "queue_missing_videos" && mission.target_channel_id) {
        setActiveNavId("channels");
        setSelectedChannelId(mission.target_channel_id);
        setActiveChannelTab("downloads");
        await loadChannelState(mission.target_channel_id).catch(() => undefined);
        scrollToAppSection(".channel-detail-panel");
        return;
      }
      setActiveNavId("queue");
      return;
    }
    if (mission.action_kind === "runtime") {
      if (mission.id === "resume_paused_channels" && mission.target_channel_id) {
        setActiveNavId("channels");
        setSelectedChannelId(mission.target_channel_id);
        setActiveChannelTab("policy");
        await loadChannelState(mission.target_channel_id).catch(() => undefined);
        scrollToAppSection(".channel-detail-panel");
        return;
      }
      if (mission.id === "resolve_runtime_restart") {
        setActiveNavId("settings");
        await handleOpenRuntimeGuide();
        await handleOpenRuntimeRestartMissionLog(mission);
        scrollToAppSection(".runtime-console");
        return;
      }
      setActiveNavId("settings");
      await handleOpenRuntimeGuide();
      scrollToAppSection(".runtime-console");
      return;
    }
    if (mission.action_kind === "security") {
      setActiveNavId("settings");
      await handleOpenRuntimeGuide();
      scrollToAppSection(".runtime-console");
      return;
    }
    if (mission.action_kind === "register") {
      setActiveNavId("channels");
      scrollToAppSection(".registration-panel");
      return;
    }
    if (mission.action_kind === "library") {
      setActiveNavId("library");
      scrollToAppSection(".library-index-panel");
      return;
    }
    if (mission.action_kind === "storage") {
      if (mission.id === "review_channel_growth" && mission.target_channel_id) {
        setActiveNavId("channels");
        setSelectedChannelId(mission.target_channel_id);
        setActiveChannelTab("library");
        setStorageFocusPath(mission.target_path);
        await loadChannelState(mission.target_channel_id).catch(() => undefined);
        scrollToAppSection(".channel-storage-lens");
        return;
      }
      setActiveNavId("insights");
      setStorageFocusPath(mission.target_path);
      const target =
        mission.id === "recover_storage_drift"
          ? ".storage-drift-list"
          : mission.id === "quarantine_sidecars"
            ? ".storage-orphan-list"
            : mission.id === "relieve_storage_pressure" || mission.id === "watch_storage_pressure"
              ? ".storage-pressure-trend"
              : ".storage-panel";
      scrollToAppSection(target);
      return;
    }
    await handleRefreshOperationsReadiness();
  }

  async function loadChannelState(channelId: number) {
    const [
      detail,
      policy,
      videos,
      coverage,
      missingVideos,
      cadence,
      syncJobSnapshot,
      jobs,
      snapshot,
      librarySnapshot,
      workerSnapshot,
      workerRunSnapshot,
    ] = await Promise.all([
      getChannel(channelId),
      getChannelPolicy(channelId),
      getChannelVideos(channelId),
      getChannelCoverage(channelId),
      getChannelMissingVideos(channelId),
      getChannelCadence(channelId),
      getSyncJobs(channelId, 4),
      getDownloadJobs(channelId),
      getDashboard(),
      getLibrary(channelId),
      getDownloadWorkerPlan(channelId),
      getDownloadWorkerRuns(channelId),
    ]);
    setChannelDetail(detail);
    setChannelPolicy(policy);
    setChannelVideos(videos);
    setChannelCoverage(coverage);
    setChannelMissingVideos(missingVideos);
    setChannelCadence(cadence);
    setSyncJobs(syncJobSnapshot);
    applyDownloadJobs(jobs);
    setSelectedJobIds(jobs.filter(isLaunchableJob).map((job) => job.id));
    setPreflightPlan(null);
    setDashboard(snapshot);
    setLibrary(librarySnapshot);
    setWorkerPlan(workerSnapshot);
    setWorkerRuns(workerRunSnapshot);
  }

  function handleSelectNav(id: NavId) {
    setActiveNavId(id);
    setActiveChannelTab((current) => {
      if (id === "library") return "library";
      if (id === "channels" && current === "library") return "overview";
      return current;
    });
    pushAppRoute({
      nav: id,
      channelTab: id === "channels" ? (activeChannelTab === "library" ? "overview" : activeChannelTab) : undefined,
      queueJobIds: id === "queue" ? queueConsoleSelectedJobIds : undefined,
    });
  }

  function handleSelectChannelContext(value: string) {
    const channelId = Number(value);
    if (!Number.isFinite(channelId)) return;
    setRegistration(null);
    setProbe(null);
    setSelectedChannelId(channelId);
    if (activeNavId === "queue") {
      setQueueConsoleChannelFilter(String(channelId));
    }
    pushAppRoute({ channelId });
    setWorkflowStatus("idle");
    setWorkflowMessage(t("channel.switcher.changed"));
  }

  function handleSelectChannelTab(tab: ChannelDetailTab) {
    setActiveChannelTab(tab);
    pushAppRoute({ nav: "channels", channelTab: tab });
  }

  function openChannelWorkspace(tab: ChannelDetailTab = "overview", selector = ".channel-detail-panel") {
    setActiveNavId("channels");
    setActiveChannelTab(tab);
    pushAppRoute({ nav: "channels", channelTab: tab });
    window.setTimeout(() => scrollToAppSection(selector), 0);
  }

  function openQueueWorkspace() {
    setActiveNavId("queue");
    pushAppRoute({ nav: "queue" });
    window.setTimeout(() => scrollToAppSection(".queue-console-panel"), 0);
  }

  const commandPaletteItems: CommandPaletteItem[] = [
    {
      id: "dashboard",
      icon: Gauge,
      titleKey: "nav.dashboard",
      detailKey: "commandPalette.dashboard.detail",
      groupKey: "commandPalette.group.navigation",
      keywords: ["dashboard", "cockpit", "home", "대시보드"],
      run: () => handleSelectNav("dashboard"),
    },
    {
      id: "register-source",
      icon: Link2,
      titleKey: "commandPalette.register.title",
      detailKey: "commandPalette.register.detail",
      groupKey: "commandPalette.group.channel",
      keywords: ["channel", "source", "register", "url", "채널", "등록"],
      run: () => openChannelWorkspace("overview", ".registration-panel"),
    },
    {
      id: "channel-overview",
      icon: ShieldCheck,
      titleKey: "commandPalette.channelOverview.title",
      detailKey: "commandPalette.channelOverview.detail",
      groupKey: "commandPalette.group.channel",
      keywords: ["channel", "overview", "detail", "sync", "채널", "상세"],
      disabled: !registeredChannelId,
      run: () => openChannelWorkspace("overview", ".channel-detail-panel"),
    },
    {
      id: "channel-downloads",
      icon: Download,
      titleKey: "detail.tabs.downloads",
      detailKey: "commandPalette.channelDownloads.detail",
      groupKey: "commandPalette.group.channel",
      keywords: ["download", "candidate", "launch", "worker", "다운로드", "후보"],
      disabled: !registeredChannelId,
      run: () => openChannelWorkspace("downloads", ".launch-control-panel"),
    },
    {
      id: "channel-policy",
      icon: SlidersHorizontal,
      titleKey: "detail.tabs.policy",
      detailKey: "commandPalette.channelPolicy.detail",
      groupKey: "commandPalette.group.channel",
      keywords: ["policy", "auto", "pause", "worker", "정책"],
      disabled: !registeredChannelId,
      run: () => openChannelWorkspace("policy", ".channel-detail-panel"),
    },
    {
      id: "archive-txt",
      icon: FileArchive,
      titleKey: "commandPalette.archiveTxt.title",
      detailKey: "commandPalette.archiveTxt.detail",
      groupKey: "commandPalette.group.operations",
      keywords: ["archive.txt", "import", "skip", "ledger", "가져오기", "스킵"],
      run: () => openChannelWorkspace("overview", ".archive-pathway"),
    },
    {
      id: "queue",
      icon: Rocket,
      titleKey: "queue.console.title",
      detailKey: "commandPalette.queue.detail",
      groupKey: "commandPalette.group.operations",
      keywords: ["queue", "worker", "progress", "run", "큐", "진행"],
      run: openQueueWorkspace,
    },
    {
      id: "library",
      icon: BookOpen,
      titleKey: "nav.library",
      detailKey: "commandPalette.library.detail",
      groupKey: "commandPalette.group.navigation",
      keywords: ["library", "media", "sidecar", "codec", "라이브러리"],
      run: () => handleSelectNav("library"),
    },
    {
      id: "storage",
      icon: FolderTree,
      titleKey: "nav.insights",
      detailKey: "commandPalette.storage.detail",
      groupKey: "commandPalette.group.operations",
      keywords: ["storage", "scan", "drift", "orphan", "스토리지", "스캔"],
      run: () => {
        setActiveNavId("insights");
        window.setTimeout(() => scrollToAppSection(".storage-panel"), 0);
      },
    },
    {
      id: "runtime",
      icon: Server,
      titleKey: "dashboard.route.runtime",
      detailKey: "commandPalette.runtime.detail",
      groupKey: "commandPalette.group.operations",
      keywords: ["runtime", "worker", "scheduler", "restart", "런타임"],
      run: () => {
        setActiveNavId("settings");
        window.setTimeout(() => scrollToAppSection(".runtime-console"), 0);
      },
    },
    {
      id: "runtime-guide",
      icon: Terminal,
      titleKey: "commandPalette.runtimeGuide.title",
      detailKey: "commandPalette.runtimeGuide.detail",
      groupKey: "commandPalette.group.operations",
      keywords: ["env", "manifest", "docker", "compose", "runtime", "환경"],
      run: () => {
        setActiveNavId("settings");
        window.setTimeout(() => {
          scrollToAppSection(".runtime-console");
          void handleOpenRuntimeGuide();
        }, 0);
      },
    },
    {
      id: "event-log",
      icon: History,
      titleKey: "commandPalette.events.title",
      detailKey: "commandPalette.events.detail",
      groupKey: "commandPalette.group.operations",
      keywords: ["event", "audit", "log", "runtime", "이벤트", "로그"],
      run: () => {
        setActiveNavId("settings");
        window.setTimeout(() => void handleOpenEventLog(), 0);
      },
    },
  ];
  const commandPaletteSearch = commandPaletteQuery.trim().toLowerCase();
  const commandPaletteResults = commandPaletteItems
    .filter((item) => commandPaletteItemMatches(item, commandPaletteSearch, t))
    .slice(0, 10);

  const activeNavItem = navItems.find((item) => item.id === activeNavId) ?? navItems[0];
  const activeNavTitle = activeNavId === "queue" ? t("queue.console.title") : t(activeNavItem.key);
  const activeChannelTabTitle = t(channelDetailTabs.find((tab) => tab.id === activeChannelTab)?.labelKey ?? "detail.tabs.overview");
  const appDocumentTitle = useMemo(() => {
    const baseTitle = "Channel Vault NAS";
    if ((activeNavId === "channels" || activeNavId === "library") && registeredChannelId) {
      const sectionTitle = activeNavId === "library" ? t("nav.library") : activeChannelTabTitle;
      return `${activeTitle} · ${sectionTitle} · ${baseTitle}`;
    }
    return `${activeNavTitle} · ${baseTitle}`;
  }, [activeChannelTabTitle, activeNavId, activeNavTitle, activeTitle, registeredChannelId, t]);
  useEffect(() => {
    document.title = appDocumentTitle;
    return () => {
      document.title = "Channel Vault NAS";
    };
  }, [appDocumentTitle]);
  const activeNavKicker =
    activeNavId === "queue"
      ? t("queue.console.kicker")
      : activeNavId === "dashboard"
        ? t("dashboard.kicker")
        : t("topbar.eyebrow");
  const showDashboardWorkspace = activeNavId === "dashboard";
  const showChannelWorkspace = activeNavId === "channels";
  const showLibraryWorkspace = activeNavId === "library";
  const showInsightsWorkspace = activeNavId === "insights";
  const showSettingsWorkspace = activeNavId === "settings";
  const showLibraryIndex = registeredChannelId && (showLibraryWorkspace || (showChannelWorkspace && activeChannelTab === "library"));
  const showLowerGrid = showChannelWorkspace || showInsightsWorkspace;
  const hasAnyRegisteredChannel = Boolean(registeredChannelId || dashboard?.channels.length);
  const cockpitStage = operationsReadiness?.stage ?? "setup";
  const cockpitScore = operationsReadiness?.score ?? 0;
  const cockpitMissions = operationsReadiness?.missions.filter((mission) => mission.action_kind !== "none").slice(0, 3) ?? [];
  const cockpitQueueWork = queueConsoleCounts.candidate + queueConsoleCounts.queued + queueConsoleCounts.running;
  const cockpitStorageIssues = storageDriftTotal + (storageScan?.orphan_sidecars.length ?? 0);
  const cockpitStorageTone = cockpitStorageIssues > 0 || storagePressureTrend?.warning ? "warn" : "good";
  const cockpitRuntimeTone = runtimeSettings?.pending_restart
    ? "warn"
    : runtimeSettings?.download_worker_enabled
      ? "good"
      : "active";
  const cockpitQueueTone = queueConsoleCounts.failed ? "bad" : cockpitQueueWork ? "active" : "good";
  const sidebarRuntimeTone = !runtimeSettings
    ? "checking"
    : runtimeSettings.pending_restart
      ? "warn"
      : runtimeSettings.download_worker_enabled
        ? "good"
        : "locked";
  const sidebarRuntimeTitle = !runtimeSettings
    ? t("sidebar.status.title")
    : runtimeSettings.pending_restart
      ? t("runtime.restart.pending")
      : `${t("runtime.worker")} ${workerRuntimeLabel}`;
  const sidebarRuntimeDetail = !runtimeSettings
    ? t("runtime.checking")
    : `${schedulerRuntimeLabel} · ${metadataSchedulerRuntimeLabel}`;
  const sidebarNavBadges = useMemo<Record<NavId, NavStatusBadge>>(
    () => ({
      dashboard: {
        value: String(cockpitScore),
        tone: cockpitScore >= 80 ? "good" : cockpitScore >= 50 ? "warn" : "active",
        label: `${t("ops.score")} ${cockpitScore}`,
      },
      channels: {
        value: String(activeChannels.length),
        tone: registeredChannelId ? "good" : "warn",
        label: registeredChannelId ? activeTitle : t("channel.workbench.noChannel"),
      },
      library: {
        value: `${activeArchivedCount}/${activeCounts?.video_count ?? activeTimeline.length}`,
        tone: activeMissingCount > 0 ? "active" : "good",
        label: t("detail.flow.skipSummary").replace("{archived}", String(activeArchivedCount)).replace("{fresh}", String(activeMissingCount)),
      },
      queue: {
        value: String(cockpitQueueWork),
        tone: queueConsoleCounts.failed ? "bad" : cockpitQueueWork ? "active" : "good",
        label: `${queueConsoleCounts.queued} ${t("queue.queued")} · ${queueConsoleCounts.running} ${t("queue.running")} · ${queueConsoleCounts.failed} ${t("queue.failed")}`,
      },
      insights: {
        value: String(cockpitStorageIssues),
        tone: cockpitStorageIssues > 0 || storagePressureTrend?.warning ? "warn" : "good",
        label: `${storageDriftTotal} drift · ${storageScan?.orphan_sidecars.length ?? 0} orphan`,
      },
      settings: {
        value: runtimeSettings?.pending_restart ? "!" : runtimeSettings?.download_worker_enabled ? "On" : "Off",
        tone: runtimeSettings?.pending_restart ? "warn" : runtimeSettings?.download_worker_enabled ? "good" : "neutral",
        label: sidebarRuntimeDetail,
      },
    }),
    [
      activeArchivedCount,
      activeChannels.length,
      activeCounts?.video_count,
      activeMissingCount,
      activeTimeline.length,
      activeTitle,
      cockpitQueueWork,
      cockpitScore,
      cockpitStorageIssues,
      queueConsoleCounts.failed,
      queueConsoleCounts.queued,
      queueConsoleCounts.running,
      registeredChannelId,
      runtimeSettings?.download_worker_enabled,
      runtimeSettings?.pending_restart,
      sidebarRuntimeDetail,
      storageDriftTotal,
      storagePressureTrend?.warning,
      storageScan?.orphan_sidecars.length,
      t,
    ],
  );
  const eventStreamLabel = eventStreamStatusLabel(eventStreamStatus, t);
  const eventStreamDetail =
    eventStreamStatus === "live"
      ? events[0]?.occurred_at
        ? t("topbar.live.last").replace("{time}", formatEventTime(events[0].occurred_at))
        : t("topbar.live.waiting")
      : eventStreamStatusDetail(eventStreamStatus, t);
  const launchRunwayCandidateCount = Math.max(launchableJobs.length, queueConsoleCounts.candidate);
  const launchRunwayQueuedCount = Math.max(simpleFlowStats.queued + simpleFlowStats.running, queueConsoleCounts.queued + queueConsoleCounts.running);
  const launchRunwayLibraryCount = library?.archived ?? activeArchivedCount;
  const launchRunwaySteps: {
    id: string;
    icon: typeof Link2;
    state: LaunchRunwayState;
    titleKey: TranslationKey;
    detailKey: TranslationKey;
    actionKey: TranslationKey;
    metric: string;
    disabled?: boolean;
    action: () => void;
  }[] = [
    {
      id: "source",
      icon: Link2,
      state: registeredChannelId ? "ready" : "active",
      titleKey: "launch.runway.source.title",
      detailKey: "launch.runway.source.detail",
      actionKey: "launch.runway.source.action",
      metric: registeredChannelId ? activeTitle : t("launch.runway.source.metric"),
      action: () => openChannelWorkspace("overview", ".registration-panel"),
    },
    {
      id: "sync",
      icon: RotateCcw,
      state: !registeredChannelId ? "locked" : channelDetail?.last_synced_at || channelVideos.length ? "ready" : "active",
      titleKey: "launch.runway.sync.title",
      detailKey: "launch.runway.sync.detail",
      actionKey: "launch.runway.sync.action",
      metric: String(simpleFlowStats.seen),
      disabled: !registeredChannelId || workflowStatus === "syncing",
      action: () => {
        openChannelWorkspace("overview");
        if (registeredChannelId) void handleManualSync();
      },
    },
    {
      id: "candidates",
      icon: ClipboardList,
      state: !registeredChannelId || !channelVideos.length ? "locked" : launchRunwayCandidateCount ? "ready" : "active",
      titleKey: "launch.runway.candidates.title",
      detailKey: "launch.runway.candidates.detail",
      actionKey: "launch.runway.candidates.action",
      metric: String(launchRunwayCandidateCount),
      disabled: !registeredChannelId || !channelVideos.length || workflowStatus === "candidates",
      action: () => {
        openChannelWorkspace("downloads", ".launch-control-panel");
        if (registeredChannelId && channelVideos.length) void handleBuildCandidates();
      },
    },
    {
      id: "download",
      icon: Download,
      state: !registeredChannelId || !launchRunwayCandidateCount ? "locked" : launchRunwayQueuedCount || queueConsoleCounts.completed ? "ready" : "active",
      titleKey: "launch.runway.download.title",
      detailKey: "launch.runway.download.detail",
      actionKey: "launch.runway.download.action",
      metric: String(Math.max(launchRunwayQueuedCount, queueConsoleCounts.completed)),
      disabled: !registeredChannelId || liveDownloadStatus === "running",
      action: () => {
        openChannelWorkspace("downloads", ".launch-control-panel");
        if (registeredChannelId) window.setTimeout(() => handleOpenLiveDownloadConfirm(), 0);
      },
    },
    {
      id: "library",
      icon: BookOpen,
      state: !registeredChannelId ? "locked" : launchRunwayLibraryCount > 0 ? "ready" : "active",
      titleKey: "launch.runway.library.title",
      detailKey: "launch.runway.library.detail",
      actionKey: "launch.runway.library.action",
      metric: String(launchRunwayLibraryCount),
      disabled: !registeredChannelId,
      action: () => handleSelectNav("library"),
    },
  ];
  const launchRunwayCompleted = launchRunwaySteps.filter((step) => step.state === "ready").length;
  const launchRunwayProgress = Math.round((launchRunwayCompleted / launchRunwaySteps.length) * 100);
  const launchRunwayCurrent = launchRunwaySteps.find((step) => step.state === "active") ?? launchRunwaySteps.find((step) => step.state === "locked") ?? launchRunwaySteps.at(-1);
  const securityReadinessReady = operationsReadiness ? !operationsReadiness.missions.some((mission) => mission.id === "enable_access_token") : false;
  const mountDoctorCriticalCount = mountDoctor?.issues.filter((issue) => issue.severity === "critical").length ?? 0;
  const mountDoctorWarningCount = mountDoctor?.issues.filter((issue) => issue.severity === "warning").length ?? 0;
  const mountDoctorIssueDetail = mountDoctor
    ? mountDoctor.issues.length
      ? t("mountDoctor.detailIssues")
          .replace("{critical}", String(mountDoctorCriticalCount))
          .replace("{warning}", String(mountDoctorWarningCount))
      : t("mountDoctor.detailHealthy")
    : t("runtime.checking");
  const mountDoctorTopIssue = mountDoctor?.issues.find((issue) => issue.severity === "critical") ?? mountDoctor?.issues.find((issue) => issue.severity === "warning") ?? null;
  const mountDoctorPathRows = mountDoctor?.paths.filter((path) => ["database", "metadata", "download", "runtime"].includes(path.id)) ?? [];
  const releaseReadinessItems: ReleaseReadinessItem[] = [
    {
      id: "source",
      icon: Link2,
      ready: hasAnyRegisteredChannel,
      titleKey: "release.readiness.source.title",
      detailKey: "release.readiness.source.detail",
      actionKey: "release.readiness.source.action",
      action: () => openChannelWorkspace("overview", registeredChannelId ? ".channel-detail-panel" : ".registration-panel"),
    },
    {
      id: "security",
      icon: ShieldCheck,
      ready: securityReadinessReady,
      titleKey: "release.readiness.security.title",
      detailKey: "release.readiness.security.detail",
      actionKey: "release.readiness.security.action",
      action: () => {
        setActiveNavId("settings");
        void handleOpenRuntimeGuide();
        scrollToAppSection(".runtime-console");
      },
    },
    {
      id: "sync",
      icon: RotateCcw,
      ready: Boolean(channelDetail?.last_synced_at || channelVideos.length || metadataSchedulerStatus),
      titleKey: "release.readiness.sync.title",
      detailKey: "release.readiness.sync.detail",
      actionKey: "release.readiness.sync.action",
      action: () => {
        if (registeredChannelId) void handleManualSync();
        else openChannelWorkspace("overview", ".registration-panel");
      },
    },
    {
      id: "queue",
      icon: Rocket,
      ready: Boolean(queueConsoleWorkerPlan),
      titleKey: "release.readiness.queue.title",
      detailKey: "release.readiness.queue.detail",
      actionKey: "release.readiness.queue.action",
      action: openQueueWorkspace,
    },
    {
      id: "library",
      icon: BookOpen,
      ready: (library?.total ?? activeArchivedCount) > 0,
      titleKey: "release.readiness.library.title",
      detailKey: "release.readiness.library.detail",
      actionKey: "release.readiness.library.action",
      action: () => handleSelectNav("library"),
    },
    {
      id: "storage",
      icon: FolderTree,
      ready: Boolean(storageScan),
      titleKey: "release.readiness.storage.title",
      detailKey: "release.readiness.storage.detail",
      actionKey: "release.readiness.storage.action",
      action: () => handleSelectNav("insights"),
    },
    {
      id: "backup",
      icon: FileArchive,
      ready: runtimeBackupRestoreReady,
      titleKey: "release.readiness.backup.title",
      detailKey: "release.readiness.backup.detail",
      actionKey: "release.readiness.backup.action",
      action: () => {
        setActiveNavId("settings");
        void handleOpenRuntimeGuide();
        scrollToAppSection(".runtime-console");
      },
    },
    {
      id: "audit",
      icon: History,
      ready: events.length > 0 || (runtimeSettings?.scheduler_ticks.length ?? 0) > 0 || (runtimeSettings?.metadata_sync_ticks.length ?? 0) > 0,
      titleKey: "release.readiness.audit.title",
      detailKey: "release.readiness.audit.detail",
      actionKey: "release.readiness.audit.action",
      action: () => handleSelectNav("settings"),
    },
  ];
  const releaseReadinessDone = releaseReadinessItems.filter((item) => item.ready).length;
  const releaseReadinessPendingItems = releaseReadinessItems.filter((item) => !item.ready);
  const releaseReadinessNextItem = releaseReadinessPendingItems[0] ?? null;
  const releaseReadinessBriefTone: ReleaseReadinessBriefTone =
    releaseReadinessDone === releaseReadinessItems.length
      ? "ready"
      : releaseReadinessDone >= Math.ceil(releaseReadinessItems.length * 0.75)
        ? "close"
        : "building";
  const releaseReadinessBriefStatusKey = `release.brief.status.${releaseReadinessBriefTone}` as TranslationKey;
  const releaseReadinessGapSummary = releaseReadinessPendingItems.length
    ? t("release.brief.gaps").replace("{count}", String(releaseReadinessPendingItems.length))
    : t("release.brief.nonePending");
  const cleanInstallMountState: CleanInstallGateStepState = mountDoctor
    ? mountDoctor.status === "critical"
      ? "warn"
      : "ready"
    : "active";
  const cleanInstallBackupState: CleanInstallGateStepState = runtimeBackupRestoreReady
    ? "ready"
    : mountDoctor?.status === "critical"
      ? "warn"
      : "active";
  const cleanInstallGateSteps: CleanInstallGateStep[] = [
    {
      id: "access",
      icon: KeyRound,
      state: securityReadinessReady ? "ready" : "active",
      titleKey: "firstRun.gate.access.title",
      detailKey: "firstRun.gate.access.detail",
      actionKey: "firstRun.gate.access.action",
      action: async () => {
        setActiveNavId("settings");
        await handleOpenRuntimeGuide();
        window.setTimeout(() => handleJumpToAccessGuard(), 40);
      },
    },
    {
      id: "mounts",
      icon: HardDrive,
      state: cleanInstallMountState,
      titleKey: "firstRun.gate.mounts.title",
      detailKey: "firstRun.gate.mounts.detail",
      actionKey: "firstRun.gate.mounts.action",
      action: async () => {
        setActiveNavId("settings");
        await handleOpenRuntimeGuide();
        window.setTimeout(() => scrollToAppSection(".runtime-volume-cookbook"), 40);
      },
    },
    {
      id: "backup",
      icon: FileArchive,
      state: cleanInstallBackupState,
      titleKey: "firstRun.gate.backup.title",
      detailKey: "firstRun.gate.backup.detail",
      actionKey: "firstRun.gate.backup.action",
      action: async () => {
        setActiveNavId("settings");
        await handleOpenRuntimeGuide();
        window.setTimeout(() => scrollToAppSection(".runtime-backup-restore"), 40);
      },
    },
    {
      id: "demo",
      icon: Database,
      state: hasAnyRegisteredChannel ? "ready" : "active",
      titleKey: "firstRun.gate.demo.title",
      detailKey: "firstRun.gate.demo.detail",
      actionKey: demoSeedStatus === "loading" ? "firstRun.demo.loading" : "firstRun.gate.demo.action",
      disabled: demoSeedStatus === "loading",
      action: handleSeedDemoWorkspace,
    },
    {
      id: "diagnostics",
      icon: ClipboardList,
      state: supportBundleSource === "server" || supportBundleSource === "fallback" ? "ready" : "active",
      titleKey: "firstRun.gate.diagnostics.title",
      detailKey: "firstRun.gate.diagnostics.detail",
      actionKey:
        supportBundleCopyStatus === "copied"
          ? "support.bundle.copied"
          : supportBundleCopyStatus === "error"
            ? "support.bundle.copyError"
            : "firstRun.gate.diagnostics.action",
      action: handleCopySupportBundle,
    },
  ];
  const cleanInstallGateReadyCount = cleanInstallGateSteps.filter((step) => step.state === "ready").length;
  const cleanInstallGateNextStep = cleanInstallGateSteps.find((step) => step.state !== "ready") ?? cleanInstallGateSteps.at(-1);
  const runtimeGuideRailItems: RuntimeGuideRailItem[] = [
    {
      id: "security",
      icon: KeyRound,
      labelKey: "runtime.rail.security",
      detail: securityReadinessReady ? t("runtime.token.stateProtected") : t("runtime.token.stateNeedsToken"),
      selector: ".runtime-token-setup",
      tone: securityReadinessReady ? "good" : "warn",
    },
    {
      id: "volumes",
      icon: FolderTree,
      labelKey: "runtime.rail.volumes",
      detail: mountDoctor ? t(`mountDoctor.status.${mountDoctor.status}` as TranslationKey) : t("runtime.checking"),
      selector: ".runtime-volume-cookbook",
      tone: mountDoctor?.status === "critical" ? "bad" : mountDoctor?.status === "warning" ? "warn" : mountDoctor ? "good" : "active",
    },
    {
      id: "backup",
      icon: FileArchive,
      labelKey: "runtime.rail.backup",
      detail: runtimeBackupRestoreReady ? t("runtime.backup.ready") : t("runtime.backup.warn"),
      selector: ".runtime-backup-restore",
      tone: runtimeBackupRestoreReady ? "good" : "warn",
    },
    {
      id: "exposure",
      icon: ShieldCheck,
      labelKey: "runtime.rail.exposure",
      detail: securityReadinessReady ? t("runtime.exposure.guardReady") : t("runtime.exposure.guardWarn"),
      selector: ".runtime-exposure-cookbook",
      tone: securityReadinessReady ? "good" : "warn",
    },
    {
      id: "restart",
      icon: RotateCcw,
      labelKey: "runtime.rail.restart",
      detail: runtimeSettings?.pending_restart ? t("runtime.restart.pending") : restartAdapterLabel,
      selector: ".runtime-restart-banner",
      tone: runtimeSettings?.pending_restart ? "warn" : restartAdapter?.executable ? "good" : "active",
    },
    {
      id: "scheduler",
      icon: History,
      labelKey: "runtime.rail.scheduler",
      detail: `${schedulerRuntimeLabel} · ${metadataSchedulerRuntimeLabel}`,
      selector: ".runtime-guide-state",
      tone: runtimeSettings ? "active" : "neutral",
    },
  ];

  if (authRequired) {
    return (
      <AuthGate
        authMessage={authMessageKey ? t(authMessageKey) : ""}
        authTokenDraft={authTokenDraft}
        onClear={handleAuthClear}
        onSubmit={handleAuthSubmit}
        onTokenChange={setAuthTokenDraft}
        t={t}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label={t("nav.dashboard")}>
        <div className="brand-block">
          <div className="brand-mark">
            <Archive size={21} strokeWidth={2.2} />
          </div>
          <div>
            <p className="brand-title">{t("brand.title")}</p>
            <p className="brand-subtitle">{t("brand.subtitle")}</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const navBadge = sidebarNavBadges[item.id];
            return (
              <button
                className={item.id === activeNavId ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                title={navBadge.label}
                type="button"
              >
                <span>{t(item.key)}</span>
                <em aria-hidden="true" className={`nav-badge ${navBadge.tone}`}>{navBadge.value}</em>
              </button>
            );
          })}
        </nav>

        <div className={`sidebar-status ${sidebarRuntimeTone}`}>
          <div className="status-dot" />
          <div>
            <strong>{sidebarRuntimeTitle}</strong>
            <span>{sidebarRuntimeDetail}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeNavKicker}</p>
            <h1>{showDashboardWorkspace ? t("dashboard.title") : activeNavTitle}</h1>
            <div className={`channel-switcher ${registeredChannelId ? "ready" : "empty"}`} aria-label={t("channel.switcher.label")}>
              <div className="channel-switcher-avatar">
                {registeredChannelId ? activeInitials : <Link2 size={16} />}
              </div>
              <label>
                <span>{t("channel.switcher.label")}</span>
                <select
                  aria-label={t("channel.switcher.label")}
                  disabled={channelSwitcherOptions.length === 0}
                  onChange={(event) => handleSelectChannelContext(event.target.value)}
                  value={registeredChannelId ? String(registeredChannelId) : ""}
                >
                  {!registeredChannelId ? <option value="">{t("channel.switcher.noChannel")}</option> : null}
                  {channelSwitcherOptions.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.title}
                    </option>
                  ))}
                </select>
              </label>
              <small>{activeChannelContextDetail}</small>
              <button
                aria-label={registeredChannelId ? t("channel.switcher.open") : t("channel.switcher.add")}
                onClick={() => openChannelWorkspace("overview", registeredChannelId ? ".channel-detail-panel" : ".registration-panel")}
                type="button"
              >
                {registeredChannelId ? <ExternalLink size={14} /> : <Link2 size={14} />}
                {registeredChannelId ? t("channel.switcher.open") : t("channel.switcher.add")}
              </button>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button command-palette-trigger"
              onClick={openCommandPalette}
              title={t("commandPalette.open")}
              aria-label={t("commandPalette.open")}
              type="button"
            >
              <Sparkles size={18} />
            </button>
            <button className="icon-button" onClick={handleTopbarSearch} title={t("actions.search")} aria-label={t("actions.search")} type="button">
              <Search size={18} />
            </button>
            <button
              className={`icon-button ${topbarRefreshStatus}`}
              disabled={topbarRefreshStatus === "refreshing"}
              onClick={() => void handleTopbarRefresh()}
              title={topbarRefreshStatus === "refreshing" ? t("actions.refreshing") : t("actions.refresh")}
              aria-label={topbarRefreshStatus === "refreshing" ? t("actions.refreshing") : t("actions.refresh")}
              type="button"
            >
              <RotateCcw size={18} />
            </button>
            <div className={`topbar-live ${eventStreamStatus}`} aria-label={t("topbar.live.aria")}>
              <span />
              <div>
                <strong>{eventStreamLabel}</strong>
                <small>{eventStreamDetail}</small>
              </div>
            </div>
            <label className="language-control" title={t("actions.language")}>
              <Languages size={16} />
              <select
                aria-label={t("actions.language")}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                {Object.entries(languages).map(([code, label]) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()} · {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="command-button" onClick={() => handleSelectNav("settings")} type="button">
              <Settings size={16} />
              {t("actions.policies")}
            </button>
          </div>
        </header>

        {commandPaletteOpen ? (
          <div className="command-palette-backdrop" onClick={closeCommandPalette} role="presentation">
            <aside
              aria-label={t("commandPalette.title")}
              className="command-palette"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="command-palette-head">
                <div>
                  <p className="panel-kicker">{t("commandPalette.kicker")}</p>
                  <h2>{t("commandPalette.title")}</h2>
                  <span>{t("commandPalette.subtitle")}</span>
                </div>
                <button
                  aria-label={t("actions.close")}
                  className="icon-button"
                  onClick={closeCommandPalette}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
              <label className="command-palette-search">
                <Search size={16} />
                <input
                  aria-label={t("commandPalette.placeholder")}
                  onChange={(event) => setCommandPaletteQuery(event.target.value)}
                  placeholder={t("commandPalette.placeholder")}
                  ref={commandPaletteInputRef}
                  value={commandPaletteQuery}
                />
              </label>
              <div className="command-palette-list">
                {commandPaletteResults.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      className={item.disabled ? "disabled" : ""}
                      disabled={item.disabled}
                      key={item.id}
                      onClick={() => runCommandPaletteItem(item)}
                      type="button"
                    >
                      <span className="command-palette-icon">
                        <ItemIcon size={16} />
                      </span>
                      <span>
                        <strong>{t(item.titleKey)}</strong>
                        <small>{t(item.detailKey)}</small>
                      </span>
                      <em>{item.disabled ? t("commandPalette.disabled") : t(item.groupKey)}</em>
                    </button>
                  );
                })}
                {!commandPaletteResults.length ? (
                  <p className="command-palette-empty">{t("commandPalette.empty")}</p>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {showDashboardWorkspace ? (
          <>
            <section className={`dashboard-cockpit ${cockpitStage}`} aria-label={t("dashboard.cockpit.aria")}>
              <div className="cockpit-hero">
                <div className="cockpit-copy">
                  <p className="panel-kicker">{t("dashboard.cockpit.kicker")}</p>
                  <h2>{t("dashboard.cockpit.title")}</h2>
                  <span>{t("dashboard.cockpit.subtitle")}</span>
                </div>
                <div className="cockpit-score-card">
                  <Gauge size={22} />
                  <div>
                    <span>{t("ops.score")}</span>
                    <strong>{operationsReadiness ? cockpitScore : "..."}</strong>
                    <em>{operationsReadiness ? operationStageLabel(cockpitStage, t) : t("runtime.checking")}</em>
                  </div>
                </div>
              </div>

              <div className="cockpit-route-grid" aria-label={t("dashboard.route.aria")}>
                <button
                  onClick={() => {
                    openChannelWorkspace("overview", ".channel-detail-panel");
                  }}
                  type="button"
                >
                  <RotateCcw size={16} />
                  <span>{t("dashboard.route.sync")}</span>
                  <strong>{simpleFlowStats.fresh}</strong>
                  <small>{t("dashboard.route.syncDetail")}</small>
                </button>
                <button onClick={() => handleSelectNav("queue")} type="button">
                  <Rocket size={16} />
                  <span>{t("dashboard.route.queue")}</span>
                  <strong>{cockpitQueueWork}</strong>
                  <small>{t("dashboard.route.queueDetail")}</small>
                </button>
                <button onClick={() => handleSelectNav("insights")} type="button">
                  <HardDrive size={16} />
                  <span>{t("dashboard.route.storage")}</span>
                  <strong>{cockpitStorageIssues}</strong>
                  <small>{t("dashboard.route.storageDetail")}</small>
                </button>
                <button onClick={() => handleSelectNav("settings")} type="button">
                  <Settings size={16} />
                  <span>{t("dashboard.route.runtime")}</span>
                  <strong>{runtimeSettings?.pending_restart ? "!" : workerRuntimeLabel}</strong>
                  <small>{t("dashboard.route.runtimeDetail")}</small>
                </button>
              </div>

              <div className="cockpit-system-rail" aria-label={t("dashboard.system.aria")}>
                <article className={cockpitRuntimeTone}>
                  <ShieldCheck size={16} />
                  <span>{t("runtime.worker")}</span>
                  <strong>{workerRuntimeLabel}</strong>
                  <small>{schedulerRuntimeLabel} · {metadataSchedulerRuntimeLabel}</small>
                </article>
                <article className={cockpitQueueTone}>
                  <Activity size={16} />
                  <span>{t("queue.console.title")}</span>
                  <strong>{cockpitQueueWork}</strong>
                  <small>
                    {queueConsoleCounts.queued} {t("queue.queued")} · {queueConsoleCounts.running} {t("queue.running")} ·{" "}
                    {queueConsoleCounts.failed} {t("queue.failed")}
                  </small>
                </article>
                <article className={cockpitStorageTone}>
                  <Database size={16} />
                  <span>{t("panel.storage.title")}</span>
                  <strong>{storageVolume?.archive_label ?? "0 MB"}</strong>
                  <small>
                    {storageVolume
                      ? t("storage.scan.free").replace("{free}", storageVolume.free_label).replace("{total}", storageVolume.total_label)
                      : t("runtime.checking")}
                  </small>
                </article>
                <article className={activeMissingCount > 0 ? "active" : "good"}>
                  <BookOpen size={16} />
                  <span>{t("nav.library")}</span>
                  <strong>{activeArchivedCount}/{activeCounts?.video_count ?? activeTimeline.length}</strong>
                  <small>{t("detail.flow.skipSummary").replace("{archived}", String(activeArchivedCount)).replace("{fresh}", String(activeMissingCount))}</small>
                </article>
              </div>
            </section>

            <section className="launch-runway" aria-label={t("launch.runway.aria")}>
              <div className="launch-runway-head">
                <div>
                  <p className="panel-kicker">{t("launch.runway.kicker")}</p>
                  <h2>{t("launch.runway.title")}</h2>
                  <span>{t("launch.runway.subtitle")}</span>
                </div>
                <div className="launch-runway-meter">
                  <span>{t("launch.runway.progress")}</span>
                  <strong>
                    {launchRunwayCompleted}/{launchRunwaySteps.length}
                  </strong>
                  <em>
                    {t("launch.runway.current")} · {launchRunwayCurrent ? t(launchRunwayCurrent.titleKey) : t("runtime.checking")}
                  </em>
                  <i>
                    <b style={{ width: `${launchRunwayProgress}%` }} />
                  </i>
                </div>
              </div>
              <div className="launch-runway-grid">
                {launchRunwaySteps.map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <article className={`launch-runway-step ${step.state}`} key={step.id}>
                      <div className="launch-runway-step-index">
                        <span>{index + 1}</span>
                        <StepIcon size={15} />
                      </div>
                      <div className="launch-runway-step-copy">
                        <em>{t(`launch.runway.status.${step.state}` as TranslationKey)}</em>
                        <strong>{t(step.titleKey)}</strong>
                        <small>{t(step.detailKey)}</small>
                      </div>
                      <div className="launch-runway-step-action">
                        <strong>{step.metric}</strong>
                        <button disabled={step.disabled} onClick={step.action} type="button">
                          {t(step.actionKey)}
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {!hasAnyRegisteredChannel ? (
              <section className="first-source-panel" aria-label={t("firstRun.empty.aria")}>
                <div className="first-source-head">
                  <div>
                    <p className="panel-kicker">{t("firstRun.empty.kicker")}</p>
                    <h2>{t("firstRun.empty.title")}</h2>
                    <span>{t("firstRun.empty.subtitle")}</span>
                  </div>
                  <button onClick={() => openChannelWorkspace("overview", ".registration-panel")} type="button">
                    <Link2 size={15} />
                    {t("firstRun.empty.primary")}
                  </button>
                </div>
                {workflowMessage ? (
                  <span className={`workflow-message first-source-message ${workflowStatus}`}>{workflowMessage}</span>
                ) : null}
                <div className="clean-install-gate" aria-label={t("firstRun.gate.aria")}>
                  <div className="clean-install-head">
                    <div>
                      <p className="panel-kicker">{t("firstRun.gate.kicker")}</p>
                      <h3>{t("firstRun.gate.title")}</h3>
                      <span>
                        {cleanInstallGateNextStep
                          ? t("firstRun.gate.subtitle").replace("{next}", t(cleanInstallGateNextStep.titleKey))
                          : t("firstRun.gate.done")}
                      </span>
                    </div>
                    <div className="clean-install-score">
                      <ShieldCheck size={15} />
                      <strong>
                        {cleanInstallGateReadyCount}/{cleanInstallGateSteps.length}
                      </strong>
                      <small>{t("firstRun.gate.score")}</small>
                    </div>
                  </div>
                  <div className="clean-install-steps">
                    {cleanInstallGateSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      return (
                        <article className={step.state} key={step.id}>
                          <div className="clean-install-step-index">
                            <span>{index + 1}</span>
                            <StepIcon size={14} />
                          </div>
                          <div className="clean-install-step-copy">
                            <em>{t(`firstRun.gate.status.${step.state}` as TranslationKey)}</em>
                            <strong>{t(step.titleKey)}</strong>
                            <small>{t(step.detailKey)}</small>
                          </div>
                          <button disabled={step.disabled} onClick={() => void step.action()} type="button">
                            {t(step.actionKey)}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <div className="first-source-grid">
                  <article>
                    <Link2 size={17} />
                    <strong>{t("firstRun.empty.sourceTitle")}</strong>
                    <span>{t("firstRun.empty.sourceDetail")}</span>
                    <button onClick={() => openChannelWorkspace("overview", ".registration-panel")} type="button">
                      {t("firstRun.empty.sourceAction")}
                    </button>
                  </article>
                  <article>
                    <FileArchive size={17} />
                    <strong>{t("firstRun.empty.archiveTitle")}</strong>
                    <span>{t("firstRun.empty.archiveDetail")}</span>
                    <button
                      onClick={() => {
                        openChannelWorkspace("overview", ".quick-panel");
                        window.setTimeout(() => scrollToAppSection(".quick-panel"), 0);
                      }}
                      type="button"
                    >
                      {t("firstRun.empty.archiveAction")}
                    </button>
                  </article>
                  <article>
                    <FolderTree size={17} />
                    <strong>{t("firstRun.empty.storageTitle")}</strong>
                    <span>{t("firstRun.empty.storageDetail")}</span>
                    <button
                      onClick={() => {
                        handleSelectNav("insights");
                        window.setTimeout(() => scrollToAppSection(".storage-panel"), 0);
                      }}
                      type="button"
                    >
                      {t("firstRun.empty.storageAction")}
                    </button>
                  </article>
                  <article className="demo-seed-card">
                    <Database size={17} />
                    <strong>{t("firstRun.demo.title")}</strong>
                    <span>{t("firstRun.demo.detail")}</span>
                    <button disabled={demoSeedStatus === "loading"} onClick={handleSeedDemoWorkspace} type="button">
                      {demoSeedStatus === "loading" ? t("firstRun.demo.loading") : t("firstRun.demo.action")}
                    </button>
                  </article>
                </div>
              </section>
            ) : null}

            <section className={`release-readiness ${releaseReadinessDone === releaseReadinessItems.length ? "ready" : "building"}`} aria-label={t("release.readiness.aria")}>
              <div className="release-readiness-head">
                <div>
                  <p className="panel-kicker">{t("release.readiness.kicker")}</p>
                  <h2>{t("release.readiness.title")}</h2>
                  <span>{t("release.readiness.subtitle")}</span>
                </div>
                <div className="release-readiness-score">
                  <ShieldCheck size={18} />
                  <strong>
                    {releaseReadinessDone}/{releaseReadinessItems.length}
                  </strong>
                  <span>
                    {releaseReadinessDone === releaseReadinessItems.length
                      ? t("release.readiness.scoreReady")
                      : t("release.readiness.scoreBuilding")}
                  </span>
                </div>
                <div className="release-readiness-actions">
                  <button onClick={() => void handleCopySupportBundle()} type="button">
                    <ClipboardList size={13} />
                    {supportBundleCopyStatus === "copied"
                      ? t("support.bundle.copied")
                      : supportBundleCopyStatus === "error"
                        ? t("support.bundle.copyError")
                        : t("support.bundle.copy")}
                  </button>
                  <button onClick={handleDownloadSupportBundle} type="button">
                    <Download size={13} />
                    {t("support.bundle.download")}
                  </button>
                </div>
              </div>
              <div className={`release-brief ${releaseReadinessBriefTone}`} aria-label={t("release.brief.aria")}>
                <div className="release-brief-state">
                  <Sparkles size={16} />
                  <div>
                    <span>{t("release.brief.kicker")}</span>
                    <strong>{t(releaseReadinessBriefStatusKey)}</strong>
                    <small>
                      {t("release.brief.score").replace("{done}", String(releaseReadinessDone)).replace("{total}", String(releaseReadinessItems.length))}
                    </small>
                  </div>
                </div>
                <div className="release-brief-next">
                  <span>{releaseReadinessNextItem ? t("release.brief.next") : t("release.brief.readyNext")}</span>
                  <strong>{releaseReadinessNextItem ? t(releaseReadinessNextItem.titleKey) : t("release.brief.allGreenTitle")}</strong>
                  <small>{releaseReadinessNextItem ? t(releaseReadinessNextItem.detailKey) : t("release.brief.allGreenDetail")}</small>
                </div>
                <div className="release-brief-pills">
                  <span className={releaseReadinessPendingItems.length ? "warn" : "good"}>
                    {releaseReadinessGapSummary}
                  </span>
                  <span>{mountDoctor ? t(`mountDoctor.status.${mountDoctor.status}` as TranslationKey) : t("runtime.checking")}</span>
                  <span>{runtimeBackupRestoreReady ? t("runtime.backup.ready") : t("runtime.backup.warn")}</span>
                </div>
                <div className="release-brief-actions">
                  {releaseReadinessNextItem ? (
                    <button onClick={() => releaseReadinessNextItem.action()} type="button">
                      <ChevronRight size={13} />
                      {t("release.brief.openNext")}
                    </button>
                  ) : null}
                  <button onClick={() => void handleCopyBetaReadinessBrief()} type="button">
                    <ClipboardList size={13} />
                    {betaBriefCopyStatus === "copied"
                      ? t("release.brief.copied")
                      : betaBriefCopyStatus === "error"
                        ? t("release.brief.copyError")
                        : t("release.brief.copy")}
                  </button>
                </div>
              </div>
              <div className="beta-proof-card" aria-label={t("beta.proof.aria")}>
                <div className="beta-proof-copy">
                  <p className="panel-kicker">{t("beta.proof.kicker")}</p>
                  <strong>{t("beta.proof.title")}</strong>
                  <span>{t("beta.proof.detail")}</span>
                </div>
                <div className="beta-proof-metrics">
                  <article>
                    <span>{t("beta.proof.readiness")}</span>
                    <strong>{releaseReadinessDone}/{releaseReadinessItems.length}</strong>
                  </article>
                  <article>
                    <span>{t("beta.proof.install")}</span>
                    <strong>{cleanInstallGateReadyCount}/{cleanInstallGateSteps.length}</strong>
                  </article>
                  <article>
                    <span>{t("beta.proof.privacy")}</span>
                    <strong>{t("beta.proof.redacted")}</strong>
                  </article>
                  <article>
                    <span>{t("beta.proof.source")}</span>
                    <strong>
                      {supportBundleSource === "server"
                        ? t("support.bundle.server")
                        : supportBundleSource === "fallback"
                          ? t("support.bundle.fallback")
                          : t("support.bundle.ready")}
                    </strong>
                  </article>
                </div>
                <div className="beta-proof-actions">
                  <button onClick={() => void handleCopyBetaProof()} type="button">
                    <ClipboardList size={13} />
                    {betaProofCopyStatus === "copied"
                      ? t("beta.proof.copied")
                      : betaProofCopyStatus === "error"
                        ? t("beta.proof.copyError")
                        : t("beta.proof.copy")}
                  </button>
                  <button onClick={handleDownloadBetaProof} type="button">
                    <Download size={13} />
                    {t("beta.proof.download")}
                  </button>
                </div>
              </div>
              <div className="support-bundle-strip">
                <ShieldCheck size={15} />
                <div>
                  <strong>{t("support.bundle.privacyTitle")}</strong>
                  <span>{t("support.bundle.privacyDetail")}</span>
                </div>
                <small className={`support-bundle-source ${supportBundleSource}`}>
                  {supportBundleSource === "server"
                    ? t("support.bundle.server")
                    : supportBundleSource === "fallback"
                      ? t("support.bundle.fallback")
                      : t("support.bundle.ready")}
                </small>
              </div>
              <div className={`mount-doctor-strip ${mountDoctor?.status ?? "checking"}`} aria-label={t("mountDoctor.aria")}>
                <div className="mount-doctor-score">
                  <HardDrive size={16} />
                  <strong>{mountDoctor ? mountDoctor.score : "..."}</strong>
                  <span>{mountDoctor ? t(`mountDoctor.status.${mountDoctor.status}` as TranslationKey) : t("runtime.checking")}</span>
                </div>
                <div className="mount-doctor-copy">
                  <strong>{t("mountDoctor.title")}</strong>
                  <span>{mountDoctorTopIssue ? mountDoctorTopIssue.title : mountDoctorIssueDetail}</span>
                  {mountDoctorTopIssue ? <small>{mountDoctorIssueDetail}</small> : null}
                </div>
                <div className="mount-doctor-paths">
                  {mountDoctorPathRows.map((path) => (
                    <span className={mountDoctorPathTone(path, mountDoctor?.running_in_container ?? false)} title={path.resolved} key={path.id}>
                      {mountDoctorPathLabel(path.id, t)}
                      <em>{mountDoctorPathState(path, t)}</em>
                    </span>
                  ))}
                </div>
                <div className="mount-doctor-actions">
                  <button disabled={mountDoctorStatus === "refreshing"} onClick={() => void handleRefreshMountDoctor()} type="button">
                    <RotateCcw size={13} />
                    {mountDoctorStatus === "refreshing" ? t("ops.refreshing") : t("ops.refresh")}
                  </button>
                  <button
                    onClick={() => {
                      handleSelectNav("settings");
                      window.setTimeout(() => scrollToAppSection(".runtime-console"), 0);
                    }}
                    type="button"
                  >
                    <Settings size={13} />
                    {t("mountDoctor.action")}
                  </button>
                </div>
              </div>
              <div className="release-readiness-grid">
                {releaseReadinessItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <article className={item.ready ? "ready" : "pending"} key={item.id}>
                      <div>
                        <ItemIcon size={16} />
                        <strong>{t(item.titleKey)}</strong>
                      </div>
                      <span>{t(item.detailKey)}</span>
                      <button onClick={item.action} type="button">
                        {item.ready ? <CheckCircle2 size={13} /> : <ChevronRight size={13} />}
                        {t(item.actionKey)}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="metric-grid" aria-label={t("metrics.aria")}>
              {activeMetrics.map((metric, index) => (
                <MetricTile metric={metric} index={index} key={metric.labelKey ?? metric.label ?? index} />
              ))}
            </section>

            <section className="ops-strip" aria-label={t("events.title")}>
              <div className="ops-orbit">
                <Waves size={18} />
                <div>
                  <span>{t("events.title")}</span>
                  <strong>{events[0] ? eventLabel(events[0], t) : t("events.idle")}</strong>
                </div>
              </div>
              <div className="event-rail">
                {events.slice(0, 5).map((event) => (
                  <article className={`event-chip ${eventTone(event.type)}`} key={`${event.type}-${event.occurred_at}`}>
                    <Bell size={14} />
                    <span>{eventLabel(event, t)}</span>
                    <time>{formatEventTime(event.occurred_at)}</time>
                  </article>
                ))}
                {events.length === 0 ? <span className="event-empty">{t("events.empty")}</span> : null}
              </div>
              <button className="event-log-button" onClick={() => void handleOpenEventLog()} type="button">
                <History size={14} />
                {t("events.openLog")}
              </button>
            </section>

            {operationsReadiness ? (
              <section className={`ops-readiness ${operationsReadiness.stage}`} aria-label={t("ops.title")}>
                <div className="ops-readiness-score">
                  <Gauge size={22} />
                  <div>
                    <span>{t("ops.score")}</span>
                    <strong>{operationsReadiness.score}</strong>
                    <em>{operationStageLabel(operationsReadiness.stage, t)}</em>
                  </div>
                </div>
                <div className="ops-readiness-main">
                  <div className="ops-readiness-head">
                    <div>
                      <p className="panel-kicker">{t("ops.kicker")}</p>
                      <h2>{t("ops.title")}</h2>
                      <span>{t("ops.subtitle")}</span>
                    </div>
                    <button
                      className="command-button"
                      disabled={operationsStatus === "refreshing"}
                      onClick={() => void handleRefreshOperationsReadiness()}
                      type="button"
                    >
                      <RotateCcw size={15} />
                      {operationsStatus === "refreshing"
                        ? t("ops.refreshing")
                        : operationsStatus === "done"
                          ? t("ops.refreshed")
                          : t("ops.refresh")}
                    </button>
                  </div>
                  <div className="ops-readiness-metrics">
                    {operationsReadiness.metrics.slice(0, 6).map((metric) => (
                      <article className={metric.tone} key={metric.key}>
                        <span>{operationMetricLabel(metric.key, t)}</span>
                        <strong>{metric.value}</strong>
                      </article>
                    ))}
                  </div>
                  <div className="ops-mission-list">
                    {operationsReadiness.missions.slice(0, 5).map((mission) => {
                      const MissionIcon = operationMissionIcon(mission.id);
                      return (
                        <article className={`ops-mission ${mission.severity} ${mission.status}`} key={mission.id}>
                          <div className="ops-mission-icon">
                            <MissionIcon size={17} />
                          </div>
                          <div>
                            <strong>{operationMissionTitle(mission.id, t)}</strong>
                            <small>{operationMissionDetail(mission, t)}</small>
                          </div>
                          <button
                            disabled={mission.action_kind === "none" || storagePressureStatus === "saving"}
                            onClick={() => void handleOperationsMissionAction(mission)}
                            type="button"
                          >
                            {operationMissionActionLabel(mission, t)}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {activeNavId === "queue" ? (
          <section className="panel queue-console-panel" aria-label={t("queue.console.title")}>
            <div className="queue-console-hero">
              <div>
                <p className="panel-kicker">{t("queue.console.kicker")}</p>
                <h2>{t("queue.console.title")}</h2>
                <span>{t("queue.console.subtitle")}</span>
              </div>
              <div className="queue-console-actions">
                <button className="command-button" disabled={queueConsoleStatus === "loading"} onClick={() => void handleRefreshQueueConsole()} type="button">
                  <RotateCcw size={16} />
                  {queueConsoleStatus === "loading" ? t("queue.console.refreshing") : t("queue.console.refresh")}
                </button>
                <button
                  className="primary-action"
                  disabled={
                    queueConsoleStatus === "worker" ||
                    queueConsoleStatus === "loading" ||
                    !queueConsoleWorkerPlan?.enabled ||
                    Boolean(queueConsoleWorkerPlan?.locked_reason) ||
                    (queueConsoleWorkerPlan?.claimable_count ?? 0) === 0
                  }
                  onClick={() => void handleOpenQueueConsoleRunConfirm()}
                  type="button"
                >
                  <Rocket size={16} />
                  {queueConsoleStatus === "worker" ? t("worker.liveRunning") : t("queue.console.runFive")}
                </button>
              </div>
            </div>

            <div className="queue-console-stats">
              <article>
                <span>{t("launch.jobs")}</span>
                <strong>{queueConsoleCounts.total}</strong>
              </article>
              <article>
                <span>{t("queue.queued")}</span>
                <strong>{queueConsoleCounts.queued}</strong>
              </article>
              <article>
                <span>{t("queue.running")}</span>
                <strong>{queueConsoleCounts.running}</strong>
              </article>
              <article>
                <span>{t("job.status.completed")}</span>
                <strong>{queueConsoleCounts.completed}</strong>
              </article>
              <article className={queueConsoleCounts.failed ? "warn" : ""}>
                <span>{t("queue.failed")}</span>
                <strong>{queueConsoleCounts.failed}</strong>
              </article>
              <article>
                <span>{t("worker.claimable")}</span>
                <strong>{queueConsoleWorkerPlan?.claimable_count ?? 0}</strong>
              </article>
            </div>

            {queueConsoleLatestTelemetry ? (
              <div className={`queue-console-live ${queueConsoleLatestTelemetry.status}`}>
                <div>
                  <span>{t("worker.liveProgress")}</span>
                  <strong>{queueConsoleLatestTelemetry.videoTitle}</strong>
                  <small>
                    {downloadTelemetrySummary(queueConsoleLatestTelemetry)}
                    {queueConsoleLatestTelemetry.archiveDir ? ` · ${queueConsoleLatestTelemetry.archiveDir}` : ""}
                  </small>
                </div>
                <em>{downloadTelemetryStatusLabel(queueConsoleLatestTelemetry.status, t)}</em>
                <div aria-label={t("job.progress")}>
                  <span style={{ width: `${Math.max(0, Math.min(queueConsoleLatestTelemetry.percent, 100))}%` }} />
                </div>
              </div>
            ) : null}

            <div className="queue-console-toolbar">
              <label className="queue-search">
                <Search size={15} />
                <input
                  aria-label={t("queue.console.search")}
                  onChange={(event) => setQueueConsoleSearch(event.target.value)}
                  placeholder={t("queue.console.search")}
                  value={queueConsoleSearch}
                />
              </label>
              <label className="queue-console-select">
                <ListFilter size={14} />
                <select
                  aria-label={t("queue.console.channel")}
                  onChange={(event) => setQueueConsoleChannelFilter(event.target.value)}
                  value={queueConsoleChannelFilter}
                >
                  <option value="all">{t("queue.console.allChannels")}</option>
                  {queueConsoleChannelOptions.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="queue-console-filters" aria-label={t("queue.console.filters")}>
              {queueStatusFilters.map((filter) => (
                <button
                  className={queueConsoleStatusFilter === filter.id ? "active" : ""}
                  key={filter.id}
                  onClick={() => setQueueConsoleStatusFilter(filter.id)}
                  type="button"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>
            <div className="queue-console-filters compact" aria-label={t("launch.preflightFilter.label")}>
              {queuePreflightFilters.map((filter) => (
                <button
                  className={queueConsolePreflightFilter === filter.id ? "active" : ""}
                  key={filter.id}
                  onClick={() => setQueueConsolePreflightFilter(filter.id)}
                  type="button"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>

            {queueConsoleClaimBlocked ? (
              <div className="queue-console-state blocked" aria-live="polite">
                <div className="queue-console-state-icon">
                  <CirclePause size={19} />
                </div>
                <div>
                  <strong>{t("queue.console.blocked.title")}</strong>
                  <span>{queueConsoleWorkerPlan?.locked_reason ?? t("queue.console.blocked.detail")}</span>
                  <small>
                    {(queueConsoleWorkerPlan?.queued_count ?? queueConsoleCounts.queued)} {t("queue.queued")} ·{" "}
                    {queueConsoleSkippedCount} {t("queue.console.confirmSkipped")}
                  </small>
                </div>
                <div className="queue-console-state-actions">
                  <button
                    className="command-button"
                    onClick={() => {
                      setActiveNavId("settings");
                      window.setTimeout(() => scrollToAppSection(".runtime-console"), 0);
                    }}
                    type="button"
                  >
                    <Settings size={15} />
                    {t("queue.console.blocked.settings")}
                  </button>
                  <button className="command-button" disabled={queueConsoleStatus === "loading"} onClick={() => void handleRefreshQueueConsole()} type="button">
                    <RotateCcw size={15} />
                    {t("queue.console.empty.refresh")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="queue-console-bulk">
              <div>
                <span>{t("launch.selected")}</span>
                <strong>{queueConsoleSelectedJobs.length}</strong>
                <small>{queueConsoleSelectedBytesLabel}</small>
              </div>
              <button className="command-button" disabled={visibleQueueConsoleActionableJobs.length === 0} onClick={handleSelectVisibleQueueConsoleJobs} type="button">
                {allVisibleQueueConsoleJobsSelected ? <CheckCircle2 size={16} /> : <Square size={16} />}
                {allVisibleQueueConsoleJobsSelected ? t("launch.clearVisible") : t("launch.selectVisible")}
              </button>
              <button className="command-button" disabled={queueConsoleStatus === "bulk" || queueConsoleSelectedJobs.length === 0} onClick={() => void handleQueueConsoleBulkAction("prioritize", 95)} type="button">
                <Zap size={16} />
                {t("launch.prioritize")}
              </button>
              <button className="command-button" disabled={queueConsoleStatus === "bulk" || queueConsoleSelectedJobs.length === 0} onClick={() => void handleQueueConsoleBulkAction("retry", 75)} type="button">
                <RotateCcw size={16} />
                {t("launch.retrySelected")}
              </button>
              <button className="primary-action" disabled={queueConsoleStatus === "bulk" || queueConsoleSelectedJobs.length === 0} onClick={() => void handleQueueConsoleBulkAction("queue", 85)} type="button">
                <Rocket size={16} />
                {t("launch.queueSelected")}
              </button>
              <button className="command-button danger-outline" disabled={queueConsoleStatus === "bulk" || queueConsoleSelectedJobs.length === 0} onClick={() => void handleQueueConsoleBulkAction("cancel")} type="button">
                <XCircle size={16} />
                {t("launch.cancelSelected")}
              </button>
            </div>

            <div className="queue-console-layout">
              <div className="queue-console-list">
                {filteredQueueConsoleJobs.slice(0, 80).map((job) => {
                  const selected = queueConsoleSelectedJobIds.includes(job.id);
                  const actionable = isSelectableQueueJob(job);
                  const telemetry = telemetryByJobId.get(job.id);
                  const pausedLocked = job.status === "queued" && !queueConsoleClaimableIds.has(job.id);
                  const expanded = expandedQueueConsoleJobId === job.id;
                  const workerPlanItem = queueConsoleWorkerPlanByJobId.get(job.id);
                  const files = queueConsoleFileMap[job.video_id] ?? [];
                  const fileStatus = queueConsoleFileStatus[job.video_id] ?? "idle";
                  const existingFileCount = files.filter((file) => file.exists).length;
                  const jobEvents = events
                    .filter((event) => {
                      if (!event.type.startsWith("download.")) return false;
                      return (
                        readEventNumber(event.data, "job_id") === job.id ||
                        readEventNumber(event.data, "video_id") === job.video_id
                      );
                    })
                    .slice(0, 5);
                  return (
                    <article className={`queue-console-row ${job.status} ${selected ? "selected" : ""} ${expanded ? "expanded" : ""}`} key={job.id}>
                      <button
                        aria-label={selected ? t("launch.deselectJob") : t("launch.selectJob")}
                        className="select-job"
                        disabled={!actionable}
                        onClick={() => handleToggleQueueConsoleJobSelection(job.id)}
                        type="button"
                      >
                        {selected ? <CheckCircle2 size={16} /> : <Square size={16} />}
                      </button>
                      <div className="queue-console-main">
                        <div>
                          <strong>{job.video_title}</strong>
                          <small>{job.channel_title} · {job.video_external_id} · {job.quality}</small>
                        </div>
                        {job.archive_path ? <code>{compactArchivePath(job.archive_path)}</code> : null}
                        {telemetry || job.progress > 0 ? (
                          <div className="queue-console-progress" aria-label={t("job.progress")}>
                            <span style={{ width: `${Math.max(0, Math.min(telemetry?.percent ?? job.progress, 100))}%` }} />
                            <em>{telemetry ? downloadTelemetrySummary(telemetry) : `${Math.round(job.progress)}%`}</em>
                          </div>
                        ) : null}
                        {pausedLocked ? (
                          <small className="queue-console-lock">
                            <CirclePause size={12} />
                            {t("queue.console.pausedLocked")}
                          </small>
                        ) : null}
                      </div>
                      <div className="queue-console-meta">
                        <em className={`queue-status-pill ${telemetry?.status ?? job.status}`}>
                          {telemetry ? downloadTelemetryStatusLabel(telemetry.status, t) : queueJobStatusLabel(job.status, t)}
                        </em>
                        <em className={`preflight-pill ${job.preflight_status}`}>{preflightLabel(job.preflight_status, t)}</em>
                        <small>{formatBytes(job.estimated_bytes ?? 0)}</small>
                      </div>
                      <div className="queue-console-row-actions">
                        <button
                          aria-label={expanded ? t("queue.console.collapse") : t("queue.console.expand")}
                          className={expanded ? "active" : ""}
                          onClick={() => void handleToggleQueueConsoleDetails(job)}
                          type="button"
                        >
                          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        <button
                          aria-label={t("job.retry")}
                          disabled={job.status === "running" || job.status === "completed"}
                          onClick={() => void handleQueueConsoleJobAction(job, "retry")}
                          type="button"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          aria-label={job.status === "running" ? t("job.stop") : t("job.cancel")}
                          disabled={job.status !== "candidate" && job.status !== "queued" && job.status !== "running"}
                          onClick={() => void handleQueueConsoleJobAction(job, job.status === "running" ? "stop" : "cancel")}
                          type="button"
                        >
                          {job.status === "running" ? <Square size={13} /> : <XCircle size={13} />}
                        </button>
                      </div>
                      {expanded ? (
                        <div className="queue-console-detail">
                          <section className="queue-console-detail-card">
                            <h3>
                              <Terminal size={14} />
                              {t("queue.console.workerPlan")}
                            </h3>
                            <dl>
                              <div>
                                <dt>{t("queue.console.archive")}</dt>
                                <dd>{workerPlanItem?.archive_dir ?? job.archive_path ?? "-"}</dd>
                              </div>
                              <div>
                                <dt>{t("queue.console.output")}</dt>
                                <dd>{workerPlanItem?.output_template ?? "video.%(ext)s"}</dd>
                              </div>
                              <div>
                                <dt>{t("queue.console.reason")}</dt>
                                <dd>{workerPlanItem?.status_note ?? (pausedLocked ? t("queue.console.pausedLocked") : queueJobStatusLabel(job.status, t))}</dd>
                              </div>
                            </dl>
                            <code className="queue-console-command">
                              {workerPlanItem?.command_preview ?? t("launch.commandEmpty")}
                            </code>
                          </section>
                          <section className="queue-console-detail-card">
                            <h3>
                              <FileCheck2 size={14} />
                              {t("queue.console.files")}
                            </h3>
                            <div className="queue-console-file-summary">
                              <span>
                                {existingFileCount}/{files.length} {t("library.detail.files")}
                              </span>
                              <span>{formatBytes(files.reduce((sum, file) => sum + (file.size_bytes ?? 0), 0))}</span>
                            </div>
                            {fileStatus === "loading" ? <p className="empty-copy">{t("queue.console.loadingFiles")}</p> : null}
                            {fileStatus === "error" ? <p className="empty-copy">{t("queue.console.fileLoadError")}</p> : null}
                            {fileStatus === "idle" && files.length === 0 ? <p className="empty-copy">{t("queue.console.noFiles")}</p> : null}
                            <div className="queue-console-file-list">
                              {files.slice(0, 4).map((file) => (
                                <article className={file.exists ? "present" : "missing"} key={file.relative_path}>
                                  <strong>{file.filename}</strong>
                                  <small>{mediaFileProfileLabel(file) || integrityLabel(file.integrity_state, t)}</small>
                                  <span>{file.size_label}</span>
                                </article>
                              ))}
                            </div>
                          </section>
                          <section className="queue-console-detail-card">
                            <h3>
                              <Activity size={14} />
                              {t("queue.console.telemetry")}
                            </h3>
                            <dl>
                              <div>
                                <dt>{t("job.progress")}</dt>
                                <dd>{telemetry ? downloadTelemetrySummary(telemetry) : `${Math.round(job.progress)}%`}</dd>
                              </div>
                              <div>
                                <dt>{t("queue.console.attempts")}</dt>
                                <dd>{job.attempt_count}</dd>
                              </div>
                              <div>
                                <dt>{t("queue.console.started")}</dt>
                                <dd>{job.started_at ? formatEventTime(job.started_at) : "-"}</dd>
                              </div>
                              <div>
                                <dt>{t("queue.console.completed")}</dt>
                                <dd>{job.completed_at ? formatEventTime(job.completed_at) : "-"}</dd>
                              </div>
                            </dl>
                            {telemetry?.error || job.error_message ? (
                              <code className="queue-console-error">{telemetry?.error ?? job.error_message}</code>
                            ) : null}
                            <div className="queue-console-event-list" aria-label={t("queue.console.events")}>
                              <div className="queue-console-event-head">
                                <strong>{t("queue.console.events")}</strong>
                                <button onClick={() => void handleOpenQueueJobEventLog(job)} type="button">
                                  <History size={12} />
                                  {t("queue.console.openJobLog")}
                                </button>
                              </div>
                              {jobEvents.map((event) => (
                                <article className={eventTone(event.type)} key={`${event.type}-${event.occurred_at}`}>
                                  <span>{eventLabel(event, t)}</span>
                                  <time>{formatEventTime(event.occurred_at)}</time>
                                </article>
                              ))}
                              {jobEvents.length === 0 ? <p className="empty-copy">{t("queue.console.noEvents")}</p> : null}
                            </div>
                          </section>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {filteredQueueConsoleJobs.length === 0 ? (
                  <div className={`queue-console-empty-state ${globalDownloadJobs.length === 0 ? "empty" : "filtered"}`}>
                    <div className="queue-console-empty-icon">
                      {globalDownloadJobs.length === 0 ? <ClipboardList size={20} /> : <Search size={20} />}
                    </div>
                    <strong>
                      {globalDownloadJobs.length === 0
                        ? t("queue.console.empty.noJobsTitle")
                        : t("queue.console.empty.filteredTitle")}
                    </strong>
                    <span>
                      {globalDownloadJobs.length === 0
                        ? t("queue.console.empty.noJobsDetail")
                        : t("queue.console.empty.filteredDetail")}
                    </span>
                    <div className="queue-console-empty-actions">
                      {globalDownloadJobs.length === 0 ? (
                        <>
                          <button className="primary-action" onClick={() => openChannelWorkspace("overview", ".registration-panel")} type="button">
                            <Link2 size={15} />
                            {t("queue.console.empty.noJobsPrimary")}
                          </button>
                          <button
                            className="command-button"
                            onClick={() => {
                              setActiveNavId("channels");
                              window.setTimeout(() => scrollToAppSection(".quick-panel"), 0);
                            }}
                            type="button"
                          >
                            <FileArchive size={15} />
                            {t("queue.console.empty.noJobsSecondary")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="primary-action" disabled={!queueConsoleHasActiveFilters} onClick={handleResetQueueConsoleFilters} type="button">
                            <ListFilter size={15} />
                            {t("queue.console.empty.clear")}
                          </button>
                          <button className="command-button" disabled={queueConsoleStatus === "loading"} onClick={() => void handleRefreshQueueConsole()} type="button">
                            <RotateCcw size={15} />
                            {t("queue.console.empty.refresh")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="queue-console-side">
                <div>
                  <span>{t("worker.title")}</span>
                  <strong>{queueConsoleWorkerPlan?.enabled ? t("worker.enabled") : t("worker.locked")}</strong>
                  <small>
                    {queueConsoleWorkerPlan?.queued_count ?? 0} {t("queue.queued")} · {queueConsoleWorkerPlan?.running_count ?? 0} {t("queue.running")}
                  </small>
                  {queueConsoleWorkerPlan?.locked_reason ? <code>{queueConsoleWorkerPlan.locked_reason}</code> : null}
                </div>
                <div>
                  <span>{t("worker.history")}</span>
                  {queueConsoleWorkerRuns.slice(0, 5).map((run) => (
                    <article key={run.id}>
                      <strong>{run.status}</strong>
                      <small>
                        {run.channel_title ?? t("queue.console.allChannels")} · {run.dry_run ? t("worker.dryRun") : t("worker.live")} · {formatEventTime(run.created_at)}
                      </small>
                      <code>{run.started_count}/{run.completed_count}/{run.failed_count}</code>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {activeNavId !== "queue" ? (
          <>
        {showSettingsWorkspace ? (
        <section className="runtime-console" aria-label={t("runtime.title")}>
          <div className="runtime-header">
            <div>
              <p className="panel-kicker">{t("runtime.kicker")}</p>
              <h2>{t("runtime.title")}</h2>
            </div>
            <div className="runtime-actions">
                <button
                  className="runtime-guide-button"
                  onClick={() => void handleOpenRuntimeGuide()}
                  type="button"
                >
                <FileText size={14} />
                {t("runtime.guide.open")}
              </button>
              <span className={`runtime-heartbeat ${runtimeSettings?.pending_restart ? "warn" : runtimeSettings ? "good" : "warn"}`}>
                <span />
                {runtimeSettings?.pending_restart
                  ? t("runtime.restart.pending")
                  : runtimeSettings
                    ? t("runtime.snapshot")
                    : t("runtime.checking")}
              </span>
            </div>
          </div>
          <div className="runtime-grid">
            <article className={`runtime-card ${runtimeSettings?.download_worker_enabled ? "good" : "warn"}`}>
              <div className="runtime-card-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <span>{t("runtime.worker")}</span>
                <strong>{workerRuntimeLabel}</strong>
                <small>
                  {runtimeSettings?.download_worker_enabled
                    ? t("runtime.worker.liveDetail")
                    : t("runtime.worker.lockedDetail")}
                </small>
              </div>
            </article>
            <article className={`runtime-card ${schedulerTone(schedulerStatus?.state)}`}>
              <div className="runtime-card-icon">
                <Clock3 size={18} />
              </div>
              <div>
                <span>{t("runtime.scheduler")}</span>
                <strong>{schedulerRuntimeLabel}</strong>
                <small>
                  {schedulerDetailLabel} · {schedulerCadenceLabel} · {schedulerLimitLabel}
                </small>
                <div className="runtime-tick-row">
                  <em>{t("runtime.scheduler.next")} · {schedulerNextTickLabel}</em>
                  <em>{t("runtime.scheduler.last")} · {schedulerLastTickLabel}</em>
                </div>
              </div>
            </article>
            <article className={`runtime-card ${schedulerTone(metadataSchedulerStatus?.state)}`}>
              <div className="runtime-card-icon">
                <Activity size={18} />
              </div>
              <div>
                <span>{t("runtime.metadataScheduler")}</span>
                <strong>{metadataSchedulerRuntimeLabel}</strong>
                <small>
                  {metadataSchedulerDetailLabel} · {metadataSchedulerCadenceLabel} · {metadataSchedulerLimitLabel}
                </small>
                <div className="runtime-tick-row">
                  <em>{t("runtime.scheduler.next")} · {metadataSchedulerNextTickLabel}</em>
                  <em>{t("runtime.scheduler.last")} · {metadataSchedulerLastTickLabel}</em>
                </div>
                <div className="metadata-due-strip" aria-label={t("runtime.metadataScheduler.dueLabel")}>
                  <span>
                    <Zap size={12} />
                    {metadataSchedulerDueLabel}
                  </span>
                  <em>{t("runtime.metadataScheduler.nextDue")} · {metadataSchedulerNextDueLabel}</em>
                </div>
                {metadataDueChannels.length ? (
                  <div className="metadata-due-channel-list" aria-label={t("runtime.metadataScheduler.dueChannels")}>
                    {metadataDueChannels.slice(0, 3).map((channel) => (
                      <button
                        aria-label={`${t("runtime.metadataScheduler.focusChannel")} ${channel.handle ?? channel.title}`}
                        className={channel.is_due ? "due" : ""}
                        key={channel.id}
                        onClick={() => handleFocusMetadataDueChannel(channel.id)}
                        type="button"
                      >
                        <strong>{channel.handle ?? channel.title}</strong>
                        <em>{channel.is_due ? t("runtime.scheduler.due") : `${channel.sync_interval_minutes}m`}</em>
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  className="runtime-inline-action"
                  disabled={metadataRunStatus === "running" || metadataSchedulerStatus?.state === "running"}
                  onClick={() => void handleRunMetadataSchedulerOnce()}
                  type="button"
                >
                  <TimerReset size={13} />
                  {metadataRunStatus === "running"
                    ? t("runtime.metadataScheduler.runRunning")
                    : t("runtime.metadataScheduler.runNow")}
                </button>
              </div>
            </article>
            <article className={`runtime-card ${ytdlpBinary?.available ? "good" : "warn"}`}>
              <div className="runtime-card-icon">
                <Rocket size={18} />
              </div>
              <div>
                <span>yt-dlp</span>
                <strong>{binaryStateLabel(ytdlpBinary)}</strong>
                <small>{binaryDetailLabel(ytdlpBinary)}</small>
              </div>
            </article>
            <article className={`runtime-card ${ffprobeBinary?.available ? "good" : "warn"}`}>
              <div className="runtime-card-icon">
                <Database size={18} />
              </div>
              <div>
                <span>ffprobe</span>
                <strong>{binaryStateLabel(ffprobeBinary)}</strong>
                <small>{binaryDetailLabel(ffprobeBinary)}</small>
              </div>
            </article>
          </div>
        </section>
        ) : null}

        {showChannelWorkspace ? (
        <section className="channel-workbench" aria-label={t("channel.workbench.aria")}>
          <article className="channel-workbench-intro">
            <p className="panel-kicker">{t("channel.workbench.kicker")}</p>
            <h2>{t("channel.workbench.title")}</h2>
            <span>{registeredChannelId ? `${activeTitle} · ${activeHandle}` : t("channel.workbench.noChannel")}</span>
          </article>
          <button
            onClick={() => {
              scrollToAppSection(".registration-panel");
            }}
            type="button"
          >
            <Link2 size={16} />
            <span>{t("channel.workbench.register")}</span>
            <strong>{registeredChannelId ? t("registration.already") : t("registration.probe")}</strong>
            <small>{t("channel.workbench.registerDetail")}</small>
          </button>
          <button
            disabled={!registeredChannelId}
            onClick={() => {
              handleSelectChannelTab("overview");
              scrollToAppSection(".channel-detail-panel");
            }}
            type="button"
          >
            <RotateCcw size={16} />
            <span>{t("channel.workbench.sync")}</span>
            <strong>{simpleFlowStats.fresh}</strong>
            <small>{t("channel.workbench.syncDetail")}</small>
          </button>
          <button
            disabled={!registeredChannelId}
            onClick={() => {
              handleSelectChannelTab("downloads");
              scrollToAppSection(".launch-control-panel");
            }}
            type="button"
          >
            <Rocket size={16} />
            <span>{t("channel.workbench.downloads")}</span>
            <strong>{simpleFlowStats.queued || simpleFlowStats.running}</strong>
            <small>{t("channel.workbench.downloadsDetail")}</small>
          </button>
          <button
            onClick={() => {
              scrollToAppSection(".quick-panel");
            }}
            type="button"
          >
            <FileArchive size={16} />
            <span>{t("channel.workbench.archiveTxt")}</span>
            <strong>{archiveTxtDraftLineCount}</strong>
            <small>{t("channel.workbench.archiveTxtDetail")}</small>
          </button>
        </section>
        ) : null}

        {showChannelWorkspace ? (
        <section className="panel registration-panel">
          <div className="registration-copy">
            <p className="panel-kicker">{t("registration.kicker")}</p>
            <h2>{t("registration.title")}</h2>
          </div>
          <form className="registration-command" onSubmit={handleProbe}>
            <div className="source-input-shell">
              <Link2 size={18} />
              <input
                aria-label={t("registration.input.aria")}
                value={sourceValue}
                onChange={(event) => setSourceValue(event.target.value)}
                placeholder={t("registration.input.placeholder")}
              />
            </div>
            <div className="registration-actions">
              <div className="quality-segment" aria-label={t("registration.quality")}>
                {qualityOptions.map((quality) => (
                  <button
                    className={quality === maxQuality ? "active" : ""}
                    key={quality}
                    type="button"
                    onClick={() => setMaxQuality(quality)}
                  >
                    {quality}
                  </button>
                ))}
              </div>
              <label className="registration-toggle">
                <input
                  type="checkbox"
                  checked={audioOnly}
                  onChange={(event) => setAudioOnly(event.target.checked)}
                />
                {t("registration.audioOnly")}
              </label>
              <label className="registration-toggle">
                <input
                  type="checkbox"
                  checked={subtitlesEnabled}
                  onChange={(event) => setSubtitlesEnabled(event.target.checked)}
                />
                {t("registration.subtitles")}
              </label>
              <button className="command-button registration-probe" disabled={registrationStatus === "probing"} type="submit">
                <Sparkles size={16} />
                {registrationStatus === "probing" ? t("registration.probing") : t("registration.probe")}
              </button>
            </div>
          </form>

          {registrationError ? (
            <div className="registration-error">
              <AlertTriangle size={16} />
              {registrationError}
            </div>
          ) : null}

          {activeProbe ? (
            <motion.div
              className="probe-preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
            >
              <div className="probe-identity">
                <div className="probe-avatar">{getInitials(activeProbe.title)}</div>
                <div>
                  <p>{activeProbe.handle ?? activeProbe.normalized.identifier}</p>
                  <h3>{activeProbe.title}</h3>
                  <span>{activeProbe.external_id ?? activeProbe.source_url}</span>
                </div>
              </div>
              <div className="probe-stats">
                <span><Zap size={15} /> {activeProbe.video_count} {t("registration.videos")}</span>
                <span><HardDrive size={15} /> {activeProbe.storage_forecast.estimated_label}</span>
                <span><FolderTree size={15} /> {activeProbe.folder_preview.channel_dir}</span>
                {activeProbe.already_registered ? <span><CheckCircle2 size={15} /> {t("registration.already")}</span> : null}
              </div>
              <div className="probe-videos">
                {activeProbe.videos.slice(0, 3).map((video) => (
                  <a href={video.url} key={video.external_id} rel="noreferrer" target="_blank">
                    <strong>{video.title}</strong>
                    <span>{video.external_id}</span>
                  </a>
                ))}
              </div>
              <button
                className="primary-action ignite-action"
                disabled={registrationStatus === "committing" || registrationStatus === "registered"}
                onClick={handleCommit}
                type="button"
              >
                {registrationStatus === "committing" ? <RotateCcw size={16} /> : registrationStatus === "registered" ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                {registrationStatus === "committing"
                  ? t("registration.committing")
                  : registrationStatus === "registered"
                    ? t("registration.registered")
                    : t("registration.commit")}
              </button>
              {registeredChannelId ? (
                <div className="post-registration-actions">
                  <button
                    className="command-button"
                    disabled={workflowStatus === "syncing"}
                    onClick={handleManualSync}
                    type="button"
                  >
                    <RotateCcw size={16} />
                    {workflowStatus === "syncing" ? t("sync.running") : t("sync.now")}
                  </button>
                  <button
                    className="command-button"
                    disabled={workflowStatus === "candidates" || channelVideos.length === 0}
                    onClick={handleBuildCandidates}
                    type="button"
                  >
                    <Download size={16} />
                    {workflowStatus === "candidates" ? t("queue.candidates.running") : t("queue.candidates.action")}
                  </button>
                  <button
                    className="command-button"
                    disabled={workflowStatus === "queueing" || channelVideos.length === 0}
                    onClick={handleQueueOne}
                    type="button"
                  >
                    <Zap size={16} />
                    {workflowStatus === "queueing" ? t("queue.one.running") : t("queue.one.action")}
                  </button>
                  {workflowMessage ? <span className={`workflow-message ${workflowStatus}`}>{workflowMessage}</span> : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </section>
        ) : null}

        {showChannelWorkspace && registeredChannelId ? (
          <section className="panel channel-detail-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("detail.kicker")}</p>
                <h2>{activeTitle}</h2>
              </div>
              <span className="detail-sync-stamp">
                <Clock3 size={15} />
                {formatDateLabel(channelDetail?.last_synced_at)}
              </span>
            </div>
            {workflowMessage && !activeProbe ? (
              <span className={`workflow-message channel-workflow-message ${workflowStatus}`}>{workflowMessage}</span>
            ) : null}
            {isDemoWorkspace ? (
              <div className="demo-workspace-banner" role="status">
                <div>
                  <Database size={17} />
                  <span>
                    <strong>{t("demo.workspace.banner.title")}</strong>
                    <small>{t("demo.workspace.banner.detail")}</small>
                  </span>
                </div>
                <button disabled={demoClearStatus === "loading"} onClick={handleClearDemoWorkspace} type="button">
                  <Trash2 size={13} />
                  {demoClearStatus === "loading" ? t("demo.workspace.clear.loading") : t("demo.workspace.clear.action")}
                </button>
              </div>
            ) : null}
            <div className="channel-start-flow" aria-label={t("detail.flow.title")}>
              <article>
                <span>{t("detail.flow.check")}</span>
                <strong>{simpleFlowStats.seen}</strong>
                <small>{formatDateTimeLabel(channelDetail?.last_synced_at, t("detail.syncOps.autoNoRun"))}</small>
                <button
                  disabled={workflowStatus === "syncing"}
                  onClick={() => {
                    setActiveChannelTab("overview");
                    void handleManualSync();
                  }}
                  type="button"
                >
                  <RotateCcw size={13} />
                  {workflowStatus === "syncing" ? t("detail.flow.checking") : t("detail.flow.check")}
                </button>
              </article>
              <article className="primary">
                <span>{t("detail.flow.download")}</span>
                <strong>{simpleFlowStats.queued || simpleFlowStats.fresh}</strong>
                <small>
                  {t("detail.flow.skipSummary")
                    .replace("{archived}", String(simpleFlowStats.archived))
                    .replace("{fresh}", String(simpleFlowStats.fresh))}
                </small>
                <button
                  disabled={liveDownloadStatus === "running" || workflowStatus === "downloading"}
                  onClick={handleOpenLiveDownloadConfirm}
                  type="button"
                >
                  <Download size={13} />
                  {workflowStatus === "downloading" ? t("detail.flow.downloading") : t("detail.flow.download")}
                </button>
              </article>
              <article>
                <span>{t("detail.flow.progress")}</span>
                <strong>{liveActiveJobCount}</strong>
                <small>
                  {latestDownloadTelemetry && latestDownloadTelemetry.status === "running"
                    ? downloadTelemetrySummary(latestDownloadTelemetry)
                    : t("detail.flow.queueSummary").replace("{queued}", String(simpleFlowStats.queued))}
                </small>
                <button onClick={() => handleSelectChannelTab("downloads")} type="button">
                  <History size={13} />
                  {t("detail.flow.progress")}
                </button>
              </article>
            </div>
            <div className="channel-tab-rail" aria-label={t("detail.tabs.aria")}>
              {channelDetailTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    className={activeChannelTab === tab.id ? "active" : ""}
                    key={tab.id}
                    onClick={() => handleSelectChannelTab(tab.id)}
                    type="button"
                  >
                    <TabIcon size={14} />
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
            {activeChannelTab === "overview" ? (
              <div className="channel-tab-content">
            <div className="sync-ops-grid">
              <article>
                <span>{t("detail.syncOps.next")}</span>
                <strong>{formatDateTimeLabel(channelDetail?.next_sync_due_at, t("runtime.scheduler.none"))}</strong>
                <small>
                  {t("detail.syncOps.syncInterval").replace(
                    "{minutes}",
                    String(channelDetail?.sync_interval_minutes ?? 0),
                  )}
                </small>
                <div className="sync-cadence-control">
                  <input
                    aria-label={t("detail.syncOps.intervalInput")}
                    max={10080}
                    min={5}
                    onChange={(event) => setSyncIntervalDraft(event.target.value)}
                    type="number"
                    value={syncIntervalDraft}
                  />
                  <button
                    disabled={!syncIntervalValid || syncIntervalStatus === "saving"}
                    onClick={() => void handleUpdateSyncInterval()}
                    type="button"
                  >
                    <TimerReset size={13} />
                    {syncIntervalStatus === "saving" ? t("detail.syncOps.intervalSaving") : t("detail.syncOps.intervalSave")}
                  </button>
                </div>
              </article>
              <article>
                <span>{t("detail.syncOps.lastAuto")}</span>
                <strong>{autoSyncStatusLabel(channelDetail, t)}</strong>
                <small>{formatDateTimeLabel(channelDetail?.last_auto_synced_at, t("detail.syncOps.autoNoRun"))}</small>
              </article>
              <article className={channelPolicy?.auto_download ? "good" : "idle"}>
                <span>{t("detail.syncOps.autoCandidates")}</span>
                <strong>{channelDetail?.last_auto_candidates_created ?? 0}</strong>
                <small>{channelPolicy?.auto_download ? t("detail.syncOps.policyOn") : t("detail.syncOps.policyOff")}</small>
              </article>
            </div>
              </div>
            ) : null}
            {activeChannelTab === "logs" && syncJobs.length ? (
              <div className="sync-job-ledger" aria-label={t("detail.syncJobs.title")}>
                <div className="sync-job-ledger-head">
                  <span>
                    <History size={13} />
                    {t("detail.syncJobs.title")}
                  </span>
                  <em>{t("detail.syncJobs.count").replace("{count}", String(syncJobs.length))}</em>
                </div>
                <div className="sync-job-ledger-list">
                  {syncJobs.slice(0, 4).map((job) => (
                    <article className={job.status} key={job.id}>
                      <div>
                        <strong>{syncJobStatusLabel(job.status, t)}</strong>
                        <span>{job.trigger} · {formatEventTime(job.completed_at ?? job.started_at)}</span>
                      </div>
                      <dl>
                        <div>
                          <dt>{t("detail.syncJobs.seen")}</dt>
                          <dd>{job.videos_seen}</dd>
                        </div>
                        <div>
                          <dt>{t("detail.syncJobs.new")}</dt>
                          <dd>{job.videos_created}</dd>
                        </div>
                        <div>
                          <dt>{t("detail.syncJobs.enriched")}</dt>
                          <dd>{job.videos_enriched}</dd>
                        </div>
                        <div>
                          <dt>{t("detail.syncJobs.candidates")}</dt>
                          <dd>{job.candidates_created}</dd>
                        </div>
                      </dl>
                      {job.error_message ? <code>{job.error_message}</code> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : activeChannelTab === "logs" ? (
              <p className="empty-copy">{t("detail.syncJobs.empty")}</p>
            ) : null}
            {activeChannelTab === "library" || activeChannelTab === "logs" ? (
              <div className="channel-storage-lens" aria-label={t("detail.storageLens.title")}>
                <div className="channel-storage-lens-head">
                  <span>
                    <HardDrive size={14} />
                    {t("detail.storageLens.title")}
                  </span>
                  <div>
                    <strong>{activeStorageChannel?.label ?? "0 MB"}</strong>
                    <button
                      aria-label={t("detail.storageLens.copyPath")}
                      disabled={!activeStoragePath}
                      onClick={() => void handleCopyStorageLensPath()}
                      type="button"
                    >
                      <Folder size={13} />
                      {storageLensCopyStatus === "copied"
                        ? t("detail.storageLens.copied")
                        : storageLensCopyStatus === "error"
                          ? t("detail.storageLens.copyFailed")
                          : t("detail.storageLens.copyPath")}
                    </button>
                  </div>
                </div>
                <div className="channel-storage-lens-grid">
                  <article>
                    <span>{t("detail.storageLens.share")}</span>
                    <strong>{activeStorageShare}%</strong>
                  </article>
                  <article>
                    <span>{t("detail.storageLens.media")}</span>
                    <strong>{activeStorageChannel?.media_count ?? 0}</strong>
                  </article>
                  <article>
                    <span>{t("detail.storageLens.sidecars")}</span>
                    <strong>{activeStorageChannel?.sidecar_count ?? 0}</strong>
                  </article>
                  <article className={activeStorageDriftRows.length ? "warn" : "good"}>
                    <span>{t("detail.storageLens.drift")}</span>
                    <strong>{activeStorageDriftRows.length}</strong>
                  </article>
                </div>
                <div className="channel-storage-meter" aria-label={t("detail.storageLens.share")}>
                  <span style={{ width: `${activeStorageShare}%` }} />
                </div>
                {storageChannelPressureTrend?.snapshots.length ? (
                  <div className="channel-storage-history" aria-label={t("detail.storageLens.history")}>
                    <div>
                      <span>{t("detail.storageLens.history")}</span>
                      <strong>
                        {t("detail.storageLens.delta")} {storageChannelPressureTrend.delta_label} · {t("detail.storageLens.peak")}{" "}
                        {storageChannelPressureTrend.peak_label}
                      </strong>
                    </div>
                    <div className="channel-storage-history-bars">
                      {storageChannelPressureTrend.snapshots.map((snapshot) => (
                        <span
                          key={snapshot.id}
                          title={`${formatDateTimeLabel(snapshot.scanned_at, t("storage.quarantine.unknownTime"))} · ${snapshot.label}`}
                        >
                          <i style={{ height: `${Math.max(8, Math.round((snapshot.bytes / activeStorageHistoryPeakBytes) * 100))}%` }} />
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <small className="channel-storage-clean">{t("detail.storageLens.noHistory")}</small>
                )}
                {activeStorageGrowthComparisons.length ? (
                  <div
                    className={`channel-storage-growth ${activeStorageGrowthWarning ? "warn" : "stable"}`}
                    aria-label={t("detail.storageLens.growthTitle")}
                  >
                    <div className="channel-storage-growth-head">
                      <span>
                        <Activity size={13} />
                        {t("detail.storageLens.growthTitle")}
                      </span>
                      <strong>
                        {activeStorageGrowthWarning
                          ? storageChannelPressureWarningLabel(activeStorageGrowthWarning, t)
                          : t("detail.storageLens.growthStable")}
                      </strong>
                    </div>
                    <div className="channel-storage-growth-grid">
                      {activeStorageGrowthComparisons.map((comparison) => (
                        <article className={comparison.warning ? "warn" : "stable"} key={comparison.window_days}>
                          <span>{comparison.label}</span>
                          <strong>{comparison.delta_label}</strong>
                          <small>
                            {t("detail.storageLens.dailyGrowth")} {comparison.daily_growth_label} ·{" "}
                            {formatSignedPercent(comparison.growth_percent)}
                          </small>
                          <em>
                            {comparison.warning
                              ? storageChannelPressureWarningLabel(comparison.warning, t)
                              : t("detail.storageLens.growthStable")}
                          </em>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="channel-storage-command">
                  <div>
                    <span>
                      <Terminal size={13} />
                      {t("detail.storageLens.openCommand")}
                    </span>
                    <small>
                      {activeStorageOpenCommand.label} · {activeStorageOpenCommand.note}
                    </small>
                  </div>
                  <code>{activeStorageOpenCommand.command || activeStoragePath || t("detail.storageLens.noPath")}</code>
                  <button
                    aria-label={t("detail.storageLens.copyCommand")}
                    disabled={!activeStorageOpenCommand.command}
                    onClick={() => void handleCopyStorageLensOpenCommand()}
                    type="button"
                  >
                    <ClipboardList size={13} />
                    {storageLensCommandCopyStatus === "copied"
                      ? t("detail.storageLens.copied")
                      : storageLensCommandCopyStatus === "error"
                        ? t("detail.storageLens.copyFailed")
                        : t("detail.storageLens.copyCommand")}
                  </button>
                </div>
                {activeStorageDriftRows.length ? (
                  <div className="channel-storage-drift">
                    {activeStorageDriftRows.slice(0, 3).map((item) => {
                      const isRecover = item.kind === "unindexed_media";
                      const actionStatus = storageDriftActionStatus[storageDriftActionKey(item)] ?? "idle";
                      return (
                        <article key={`${item.kind}-${item.relative_path}`}>
                          <span>{isRecover ? t("storage.scan.unindexed") : t("storage.scan.indexedMissing")}</span>
                          <code>{item.relative_path}</code>
                          <em>{item.label}</em>
                          <button disabled={actionStatus === "running"} onClick={() => void handlePreviewStorageDrift(item)} type="button">
                            {isRecover ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                            {actionStatus === "running"
                              ? t("storage.drift.running")
                              : isRecover
                                ? t("detail.storageLens.recover")
                                : t("detail.storageLens.prune")}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <small className="channel-storage-clean">{t("detail.storageLens.clean")}</small>
                )}
              </div>
            ) : null}
            {activeChannelTab === "policy" ? (
            <div className="policy-console">
              <div className="policy-signal">
                <SlidersHorizontal size={17} />
                <div>
                  <span>{t("policy.console")}</span>
                  <strong>
                    {channelPolicy?.max_quality ?? maxQuality} · {channelPolicy?.audio_only ? t("registration.audioOnly") : t("policy.videoMode")} · {policySubtitleLabel} · {workerPolicyLabel}
                  </strong>
                </div>
              </div>
              <div className="policy-actions">
                {qualityOptions.map((quality) => (
                  <button
                    className={quality === (channelPolicy?.max_quality ?? maxQuality) ? "active" : ""}
                    key={quality}
                    onClick={() => handlePolicyQuality(quality)}
                    type="button"
                  >
                    {quality}
                  </button>
                ))}
                <button
                  className={channelPolicy?.auto_download ? "active danger" : ""}
                  onClick={handleToggleAutoDownload}
                  type="button"
                >
                  {channelPolicy?.auto_download ? t("policy.auto.on") : t("policy.auto.off")}
                </button>
                <button
                  className={channelPolicy?.worker_paused ? "active danger" : "worker-live"}
                  onClick={handleToggleWorkerPause}
                  type="button"
                >
                  <CirclePause size={13} />
                  {channelPolicy?.worker_paused ? t("policy.worker.resume") : t("policy.worker.pause")}
                </button>
              </div>
            </div>
            ) : null}
            {activeChannelTab === "overview" ? (
            <div className="detail-grid">
              <div className="timeline-panel">
                <div className="section-title">
                  <Film size={16} />
                  <strong>{t("detail.timeline")}</strong>
                </div>
                <div className="video-timeline">
                  {activeTimeline.slice(0, 6).map((video) => (
                    <a className={`timeline-row ${video.archive_state}`} href={video.url} key={video.external_id} rel="noreferrer" target="_blank">
                      <time>{formatVideoDate(video)}</time>
                      <div>
                        <strong>{video.title}</strong>
                        <span>{video.external_id} · {formatDuration(video.duration_seconds)}</span>
                      </div>
                      <em>{archiveStateLabel(video.archive_state, t)}</em>
                    </a>
                  ))}
                </div>
              </div>
              <div className="coverage-panel">
                <div className="section-title">
                  <ShieldCheck size={16} />
                  <strong>{t("detail.coverage")}</strong>
                </div>
                <div className="coverage-rings">
                  <span>
                    <strong>{activeCounts?.video_count ?? activeProbe?.video_count ?? 0}</strong>
                    {t("backup.total.label")}
                  </span>
                  <span>
                    <strong>{activeCounts ? activeMissingCount : activeProbe?.video_count ?? 0}</strong>
                    {t("backup.missing.label")}
                  </span>
                  <span>
                    <strong>{downloadJobs.length}</strong>
                    {t("detail.queue")}
                  </span>
                </div>
                <div className="coverage-inspector" aria-label={t("detail.coverageApi.title")}>
                  <div className="coverage-meter">
                    <div>
                      <strong>{channelCoveragePercent}%</strong>
                      <span>{t("detail.coverageApi.title")}</span>
                    </div>
                    <i>
                      <b style={{ width: `${Math.max(0, Math.min(channelCoveragePercent, 100))}%` }} />
                    </i>
                    <small>
                      {t("detail.coverageApi.summary")
                        .replace("{archived}", String(channelCoverage?.archived ?? activeArchivedCount))
                        .replace("{source}", String(channelCoverage?.source ?? activeCounts?.video_count ?? 0))
                        .replace("{missing}", String(channelCoverage?.missing ?? activeMissingCount))}
                    </small>
                  </div>
                  {channelCadence ? (
                    <div className="cadence-mini-rail" aria-label={t("detail.coverageApi.cadence")}>
                      {channelCadence.buckets.map((bucket) => (
                        <span key={bucket.dow} title={`${bucket.label} ${bucket.count}`}>
                          <i style={{ height: `${Math.max(10, Math.round((bucket.count / channelCadenceMax) * 100))}%` }} />
                          <em>{bucket.label.slice(0, 1)}</em>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {channelMissingVideos.length ? (
                    <div className="missing-mini-card">
                      <span>{t("detail.coverageApi.nextMissing")}</span>
                      <strong>{channelMissingVideos[0].title}</strong>
                      <small>{channelMissingVideos[0].id}</small>
                    </div>
                  ) : null}
                </div>
                <div className="job-list">
                  {downloadJobs.slice(0, 4).map((job) => {
                    const telemetry = telemetryByJobId.get(job.id);
                    return (
                      <article className={`job-row ${job.status}`} key={job.id}>
                        <span />
                        <div className="job-main">
                          <strong>{job.video_title}</strong>
                          <small>{job.video_external_id} · {job.quality}</small>
                          {job.status === "running" || job.progress > 0 ? (
                            <div aria-label={t("job.progress")} className="job-progress">
                              <span style={{ width: `${Math.max(0, Math.min(telemetry?.percent ?? job.progress, 100))}%` }} />
                            </div>
                          ) : null}
                          {telemetry ? (
                            <small className="job-telemetry-line">
                              {downloadTelemetrySummary(telemetry)}
                            </small>
                          ) : null}
                        </div>
                        <div className="job-actions">
                          <em>{telemetry ? downloadTelemetryStatusLabel(telemetry.status, t) : jobStatusLabel(job.status, t)}</em>
                          <button
                            aria-label={t("job.retry")}
                            disabled={job.status === "running" || job.status === "completed"}
                            onClick={() => handleRetryJob(job.id)}
                            title={t("job.retry")}
                            type="button"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            aria-label={job.status === "running" ? t("job.stop") : t("job.cancel")}
                            disabled={job.status !== "candidate" && job.status !== "queued" && job.status !== "running"}
                            onClick={() => (job.status === "running" ? handleStopJob(job.id) : handleCancelJob(job.id))}
                            title={job.status === "running" ? t("job.stop") : t("job.cancel")}
                            type="button"
                          >
                            {job.status === "running" ? <Square size={13} /> : <XCircle size={13} />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {downloadJobs.length === 0 ? <p className="empty-copy">{t("queue.empty")}</p> : null}
                </div>
              </div>
            </div>
            ) : null}
          </section>
        ) : null}

        {showChannelWorkspace && registeredChannelId && activeChannelTab === "downloads" ? (
          <section className="panel launch-control-panel">
            <div className="launch-hero">
              <div>
                <p className="panel-kicker">{t("launch.kicker")}</p>
                <h2>{t("launch.title")}</h2>
                <span>{t("launch.subtitle")}</span>
              </div>
              <div className="launch-readiness">
                <Gauge size={18} />
                <div>
                  <strong>{preflightPlan?.estimated_label ?? launchEstimateLabel}</strong>
                  <span>{t("launch.estimate")}</span>
                </div>
              </div>
            </div>

            <div className="launch-grid">
              <article>
                <span>{t("launch.jobs")}</span>
                <strong>{preflightPlan?.job_count ?? launchableJobs.length}</strong>
              </article>
              <article>
                <span>{t("launch.candidates")}</span>
                <strong>{preflightPlan?.candidate_count ?? launchableJobs.filter((job) => job.status === "candidate").length}</strong>
              </article>
              <article>
                <span>{t("launch.queued")}</span>
                <strong>{preflightPlan?.queued_count ?? launchableJobs.filter((job) => job.status === "queued").length}</strong>
              </article>
              <article>
                <span>{t("launch.selected")}</span>
                <strong>{selectedJobIds.length}</strong>
              </article>
            </div>

            <div className="queue-radar-strip" aria-label={t("launch.signal.title")}>
              <div>
                <ListFilter size={16} />
                <div>
                  <strong>{t("launch.signal.title")}</strong>
                  <span>{t("launch.signal.subtitle")}</span>
                </div>
              </div>
              <article>
                <span>{t("launch.signal.total")}</span>
                <strong>{queueRadar.total}</strong>
              </article>
              <article>
                <span>{t("launch.signal.review")}</span>
                <strong>{queueRadar.review}</strong>
              </article>
              <article>
                <span>{t("launch.signal.retry")}</span>
                <strong>{queueRadar.retry}</strong>
              </article>
              <article>
                <span>{t("launch.signal.running")}</span>
                <strong>{queueRadar.running}</strong>
              </article>
            </div>

            <div className="launch-filter-rail" aria-label={t("launch.filter.label")}>
              {queueStatusFilters.map((filter) => (
                <button
                  className={queueStatusFilter === filter.id ? "active" : ""}
                  key={filter.id}
                  onClick={() => setQueueStatusFilter(filter.id)}
                  type="button"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>

            <div className="preflight-filter-rail" aria-label={t("launch.preflightFilter.label")}>
              <span>
                <ShieldCheck size={14} />
                {t("launch.preflightFilter.label")}
              </span>
              {queuePreflightFilters.map((filter) => (
                <button
                  className={queuePreflightFilter === filter.id ? "active" : ""}
                  key={filter.id}
                  onClick={() => setQueuePreflightFilter(filter.id)}
                  type="button"
                >
                  <strong>{t(filter.labelKey)}</strong>
                  <em>{preflightFilterCounts[filter.id]}</em>
                </button>
              ))}
            </div>

            <div className="launch-toolbar">
              <label className="queue-search">
                <Search size={15} />
                <input
                  aria-label={t("launch.search")}
                  onChange={(event) => setQueueSearch(event.target.value)}
                  placeholder={t("launch.search")}
                  value={queueSearch}
                />
              </label>
              <div className="launch-actions">
                <button
                  className="command-button"
                  disabled={workflowStatus === "preflight" || launchableJobs.length === 0}
                  onClick={handleRunPreflight}
                  type="button"
                >
                  <ClipboardList size={16} />
                  {workflowStatus === "preflight" ? t("launch.preflight.running") : t("launch.preflight")}
                </button>
                <button
                  className="command-button"
                  disabled={visibleActionableJobs.length === 0}
                  onClick={handleSelectVisibleJobs}
                  type="button"
                >
                  {allVisibleJobsSelected ? <CheckCircle2 size={16} /> : <Square size={16} />}
                  {allVisibleJobsSelected ? t("launch.clearVisible") : t("launch.selectVisible")}
                </button>
                <button
                  className="command-button"
                  disabled={workflowStatus === "bulk" || selectedJobIds.length === 0}
                  onClick={() => handleBulkQueueAction("prioritize", 95)}
                  type="button"
                >
                  <Zap size={16} />
                  {t("launch.prioritize")}
                </button>
                <button
                  className="command-button"
                  disabled={workflowStatus === "bulk" || selectedRetryableCount === 0}
                  onClick={() => handleBulkQueueAction("retry", 75)}
                  type="button"
                >
                  <RotateCcw size={16} />
                  {t("launch.retrySelected")}
                </button>
                <button
                  className="primary-action"
                  disabled={workflowStatus === "bulk" || selectedJobIds.length === 0}
                  onClick={() => handleBulkQueueAction("queue", 85)}
                  type="button"
                >
                  <Rocket size={16} />
                  {t("launch.queueSelected")}
                </button>
                <button
                  className="command-button danger-outline"
                  disabled={workflowStatus === "bulk" || selectedJobIds.length === 0}
                  onClick={() => handleBulkQueueAction("cancel")}
                  type="button"
                >
                  <XCircle size={16} />
                  {t("launch.cancelSelected")}
                </button>
              </div>
            </div>

            {preflightPlan?.warnings.length ? (
              <div className="launch-warnings">
                {preflightPlan.warnings.map((warning) => (
                  <span key={warning}>
                    <AlertTriangle size={14} />
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}

            {preflightPlan ? (
              <div className="launch-preflight-runway" aria-label={t("launch.preflightRunway.title")}>
                <div>
                  <ClipboardList size={15} />
                  <span>{t("launch.preflightRunway.title")}</span>
                  <strong>{preflightPlan.estimated_label}</strong>
                </div>
                <article>
                  <span>{t("launch.preflightRunway.ready")}</span>
                  <strong>{preflightReadyCount}</strong>
                </article>
                <article>
                  <span>{t("launch.preflightRunway.review")}</span>
                  <strong>{preflightReviewCount}</strong>
                </article>
                <article>
                  <span>{t("launch.preflightRunway.free")}</span>
                  <strong>{launchRunwayFreeLabel}</strong>
                </article>
                <article>
                  <span>{t("launch.preflightRunway.mode")}</span>
                  <strong>{t("launch.preflightRunway.dbOnly")}</strong>
                </article>
              </div>
            ) : null}

            <div className="launch-board">
              <div className="launch-job-stack">
                {filteredLaunchJobs.slice(0, 8).map((job) => {
                  const selected = selectedJobIds.includes(job.id);
                  const actionable = isSelectableQueueJob(job);
                  const signals = launchJobSignals(job, t);
                  const telemetry = telemetryByJobId.get(job.id);
                  const preflightStatus = effectivePreflightStatus(job, preflightPlanStatusByJobId);
                  return (
                    <article className={`launch-job ${job.status} ${selected ? "selected" : ""} ${actionable ? "" : "locked"}`} key={job.id}>
                      <button
                        aria-label={actionable ? (selected ? t("launch.deselectJob") : t("launch.selectJob")) : t("launch.jobLocked")}
                        className="select-job"
                        disabled={!actionable}
                        onClick={() => handleToggleJobSelection(job.id)}
                        type="button"
                      >
                        {actionable ? selected ? <CheckCircle2 size={16} /> : <Square size={16} /> : <CirclePause size={16} />}
                      </button>
                      <div className="launch-job-main">
                        <strong>{job.video_title}</strong>
                        <span>{job.video_external_id} · {job.quality} · P{job.priority}</span>
                        {job.archive_path ? <small>{compactArchivePath(job.archive_path)}</small> : null}
                        {telemetry ? (
                          <div className="launch-job-progress" aria-label={t("job.progress")}>
                            <span style={{ width: `${Math.max(0, Math.min(telemetry.percent, 100))}%` }} />
                            <em>{downloadTelemetrySummary(telemetry)}</em>
                          </div>
                        ) : null}
                        {signals.length ? (
                          <div className="launch-job-signals" aria-label={t("launch.signal.title")}>
                            {signals.map((signal) => (
                              <em className={`launch-job-signal ${signal.tone}`} key={signal.key}>
                                {signal.label}
                              </em>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="launch-job-meta">
                        <em className={`queue-status-pill ${telemetry?.status ?? job.status}`}>
                          {telemetry ? downloadTelemetryStatusLabel(telemetry.status, t) : queueJobStatusLabel(job.status, t)}
                        </em>
                        <em className={`preflight-pill ${preflightStatus}`}>{preflightLabel(preflightStatus, t)}</em>
                        <small>{formatBytes(job.estimated_bytes ?? 0)}</small>
                      </div>
                    </article>
                  );
                })}
                {filteredLaunchJobs.length === 0 ? <p className="empty-copy">{t("launch.empty")}</p> : null}
              </div>

              <div className="launch-side-stack">
                <div className="launch-selection-panel" aria-label={t("launch.selection.title")}>
                  <div className="section-title">
                    <CheckCircle2 size={16} />
                    <strong>{t("launch.selection.title")}</strong>
                  </div>
                  <div className="launch-selection-grid">
                    <article>
                      <span>{t("launch.selected")}</span>
                      <strong>{selectedJobIds.length}</strong>
                    </article>
                    <article>
                      <span>{t("launch.selection.bytes")}</span>
                      <strong>{selectedBytesLabel}</strong>
                    </article>
                    <article>
                      <span>{t("launch.candidates")}</span>
                      <strong>{selectedCandidateCount}</strong>
                    </article>
                    <article>
                      <span>{t("launch.queued")}</span>
                      <strong>{selectedQueuedCount}</strong>
                    </article>
                    <article>
                      <span>{t("launch.signal.retry")}</span>
                      <strong>{selectedRetryableCount}</strong>
                    </article>
                    <article>
                      <span>{t("launch.signal.review")}</span>
                      <strong>{selectedReviewCount}</strong>
                    </article>
                  </div>
                </div>

                <div className="command-preview">
                  <div className="section-title command-preview-head">
                    <span>
                      <Rocket size={16} />
                      <strong>{t("launch.commandPreview")}</strong>
                    </span>
                    <button
                      disabled={!launchCommandManifest}
                      onClick={() => void handleCopyLaunchCommands()}
                      type="button"
                    >
                      <ClipboardList size={13} />
                      {launchCommandCopyStatus === "copied"
                        ? t("launch.commandCopied")
                        : launchCommandCopyStatus === "error"
                          ? t("launch.commandCopyError")
                          : t("launch.commandCopy")}
                    </button>
                  </div>
                  <div className="command-lines">
                    {(preflightPlan?.command_preview.length ? preflightPlan.command_preview : [t("launch.commandEmpty")]).map((line) => (
                      <code key={line}>{line}</code>
                    ))}
                  </div>
                </div>

                <div className="worker-dock">
                  <div className="section-title worker-title">
                    {workerPlan?.enabled ? <Rocket size={16} /> : <CirclePause size={16} />}
                    <strong>{t("worker.title")}</strong>
                    <button className="worker-run-button" onClick={handleWorkerDryRun} type="button">
                      <TimerReset size={13} />
                      {t("worker.runDry")}
                    </button>
                    <button
                      className="worker-run-button live-run-button"
                      disabled={!workerPlan?.enabled || liveDownloadStatus === "running"}
                      onClick={handleOpenLiveDownloadConfirm}
                      type="button"
                    >
                      <Rocket size={13} />
                      {liveDownloadStatus === "running" ? t("worker.liveRunning") : t("worker.runLive")}
                    </button>
                    <span className={`worker-status ${workerPlan?.enabled ? "enabled" : "locked"}`}>
                      {workerPlan?.enabled ? t("worker.enabled") : t("worker.locked")}
                    </span>
                  </div>
                  <p className="worker-guardrails">
                    <ShieldCheck size={13} />
                    <span>{t("worker.guardrails")}</span>
                  </p>
                  {latestDownloadTelemetry ? (
                    <div className={`live-progress-strip ${latestDownloadTelemetry.status}`}>
                      <div>
                        <span>{t("worker.liveProgress")}</span>
                        <strong>{latestDownloadTelemetry.videoTitle}</strong>
                        <small>
                          {downloadTelemetrySummary(latestDownloadTelemetry)}
                          {latestDownloadTelemetry.archiveDir ? ` · ${latestDownloadTelemetry.archiveDir}` : ""}
                        </small>
                      </div>
                      <div className="live-progress-readout">
                        <strong>{Math.round(latestDownloadTelemetry.percent)}%</strong>
                        <em>{downloadTelemetryStatusLabel(latestDownloadTelemetry.status, t)}</em>
                      </div>
                      <div className="live-progress-meter" aria-label={t("job.progress")}>
                        <span style={{ width: `${Math.max(0, Math.min(latestDownloadTelemetry.percent, 100))}%` }} />
                      </div>
                    </div>
                  ) : null}
                  <div className="worker-stats">
                    <article>
                      <span>{t("worker.queued")}</span>
                      <strong>{workerPlan?.queued_count ?? 0}</strong>
                    </article>
                    <article>
                      <span>{t("worker.claimable")}</span>
                      <strong>{workerPlan?.claimable_count ?? 0}</strong>
                    </article>
                    <article>
                      <span>{t("worker.running")}</span>
                      <strong>{workerPlan?.running_count ?? runningWorkerJobs.length}</strong>
                    </article>
                    <article>
                      <span>{t("worker.mode")}</span>
                      <strong>{workerPlan?.dry_run ? t("worker.dryRun") : t("worker.live")}</strong>
                    </article>
                  </div>
                  {runningWorkerJobs.length ? (
                    <div className="worker-running-stack">
                      {runningWorkerJobs.slice(0, 2).map((job) => (
                        <article className="worker-running-job" key={job.id}>
                          <div>
                            <span>{t("worker.active")}</span>
                            <strong>{job.video_title}</strong>
                            <small>
                              {job.quality} · {Math.round(job.progress)}% · {job.video_external_id}
                            </small>
                          </div>
                          <div className="worker-running-meter" aria-label={t("job.progress")}>
                            <span style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }} />
                          </div>
                          <button onClick={() => handleStopJob(job.id)} title={t("job.stop")} type="button">
                            <Square size={13} />
                            {t("job.stop")}
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {workerRuns.length ? (
                    <div className="worker-run-ledger">
                      <div className="worker-run-ledger-head">
                        <span>{t("worker.history")}</span>
                        <div>
                          <button
                            onClick={() => {
                              setDownloadRunSummaryCopyStatus("idle");
                              setDownloadRunSummaryOpen(true);
                            }}
                            type="button"
                          >
                            <ClipboardList size={12} />
                            {t("worker.summary.open")}
                          </button>
                          <button onClick={() => void handleOpenWorkerHistory()} type="button">
                            <History size={12} />
                            {t("worker.history.open")}
                          </button>
                        </div>
                      </div>
                      {workerRuns.slice(0, 3).map((run) => (
                        <article key={run.id}>
                          <div>
                            <strong>{run.status}</strong>
                            <small>
                              {run.dry_run ? t("worker.dryRun") : t("worker.live")} · {formatEventTime(run.created_at)}
                            </small>
                          </div>
                          <code>
                            {run.started_count}/{run.completed_count}/{run.failed_count}
                          </code>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {workerPlan?.locked_reason ? <code className="worker-lock">{workerPlan.locked_reason}</code> : null}
                  <div className="worker-job-stack">
                    {(workerPlan?.jobs ?? []).slice(0, 3).map((item) => (
                      <article className="worker-job" key={item.job.id}>
                        <div>
                          <strong>{item.job.video_title}</strong>
                          <span>{t("worker.archive")} · {item.archive_dir}</span>
                        </div>
                        <code>{item.command_preview}</code>
                      </article>
                    ))}
                    {workerPlan && workerPlan.jobs.length === 0 ? <p className="empty-copy">{t("worker.empty")}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {showLibraryIndex ? (
          <section className="panel library-index-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("library.kicker")}</p>
                <h2>{t("library.title")}</h2>
              </div>
              <label className="library-search">
                <Search size={15} />
                <input
                  ref={librarySearchInputRef}
                  aria-label={t("library.search")}
                  onChange={(event) => {
                    setActiveSavedLibraryViewId(null);
                    setLibraryQuery(event.target.value);
                  }}
                  placeholder={t("library.search")}
                  value={libraryQuery}
                />
              </label>
            </div>

            <div className="library-toolbelt" aria-label={t("library.filter.title")}>
              <div className="library-preset-group">
                <span>
                  <Sparkles size={13} />
                  {t("library.preset.title")}
                </span>
                {libraryPresetFilters.map((preset) => {
                  const PresetIcon = preset.icon;
                  return (
                    <button
                      className={activeLibraryPreset === preset.id ? "active" : ""}
                      key={preset.id}
                      onClick={() => handleApplyLibraryPreset(preset.id)}
                      type="button"
                    >
                      <PresetIcon size={13} />
                      {t(preset.labelKey)}
                    </button>
                  );
                })}
              </div>
              <div className="library-filter-group">
                <span>
                  <ListFilter size={13} />
                  {t("library.filter.integrity")}
                </span>
                {libraryIntegrityFilters.map((filter) => (
                  <button
                    className={libraryIntegrityFilter === filter.id ? "active" : ""}
                    key={filter.id}
                    onClick={() => handleLibraryIntegrityFilter(filter.id)}
                    type="button"
                  >
                    {t(filter.labelKey)}
                  </button>
                ))}
              </div>
              <div className="library-filter-group">
                <span>
                  <FileCheck2 size={13} />
                  {t("library.filter.sidecar")}
                </span>
                {librarySidecarFilters.map((filter) => (
                  <button
                    className={librarySidecarFilter === filter.id ? "active" : ""}
                    key={filter.id}
                    onClick={() => handleLibrarySidecarFilter(filter.id)}
                    type="button"
                  >
                    {t(filter.labelKey)}
                  </button>
                ))}
              </div>
              <label className="library-codec-filter">
                <SlidersHorizontal size={14} />
                <input
                  aria-label={t("library.filter.codec")}
                  onChange={(event) => {
                    setActiveLibraryPreset(null);
                    setActiveSavedLibraryViewId(null);
                    setLibraryCodecFilter(event.target.value);
                  }}
                  placeholder={t("library.filter.codecPlaceholder")}
                  value={libraryCodecFilter}
                />
              </label>
            </div>

            <div className="library-saved-views" aria-label={t("library.saved.title")}>
              <span>
                <Bookmark size={13} />
                {t("library.saved.title")}
              </span>
              <label>
                <input
                  aria-label={t("library.saved.name")}
                  onChange={(event) => setLibraryViewNameDraft(event.target.value)}
                  placeholder={savedLibraryViewName}
                  value={libraryViewNameDraft}
                />
              </label>
              <button className="library-save-view" onClick={() => void handleSaveLibraryView()} type="button">
                <Save size={13} />
                {t("library.saved.save")}
              </button>
              <button
                className="library-overwrite-view"
                disabled={!activeSavedLibraryView}
                onClick={() => void handleOverwriteSavedLibraryView()}
                type="button"
              >
                <Bookmark size={13} />
                {t("library.saved.overwrite")}
              </button>
              {savedLibraryViews.map((view) => (
                <div className={`saved-view-pill ${activeSavedLibraryViewId === view.id ? "active" : ""}`} key={view.id}>
                  <button onClick={() => handleApplySavedLibraryView(view)} type="button">
                    {view.name}
                  </button>
                  <button
                    aria-label={t("library.saved.delete")}
                    onClick={() => void handleDeleteSavedLibraryView(view.id)}
                    title={t("library.saved.delete")}
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="library-active-view" aria-label={t("library.active.title")}>
              <div className="library-active-main">
                <span>
                  <SlidersHorizontal size={13} />
                  {t("library.active.title")}
                </span>
                <strong>{libraryActiveSummary}</strong>
              </div>
              <div className="library-active-chips">
                {libraryActiveViewChips.length ? (
                  libraryActiveViewChips.map((chip) => (
                    <span key={`${chip.label}-${chip.value}`}>
                      <em>{chip.label}</em>
                      {chip.value}
                    </span>
                  ))
                ) : (
                  <em>{t("library.active.empty")}</em>
                )}
              </div>
              <button disabled={libraryActiveViewChips.length === 0} onClick={handleResetLibraryFilters} type="button">
                <RotateCcw size={13} />
                {t("library.active.reset")}
              </button>
            </div>

            <div className="library-summary">
              <article>
                <span>{t("library.total")}</span>
                <strong>{library?.total ?? activeTimeline.length}</strong>
              </article>
              <article>
                <span>{t("library.archived")}</span>
                <strong>{library?.archived ?? 0}</strong>
              </article>
              <article>
                <span>{t("library.missing")}</span>
                <strong>{library?.missing ?? activeTimeline.filter((video) => video.archive_state !== "archived").length}</strong>
              </article>
              <article>
                <span>{t("library.bytes")}</span>
                <strong>{library?.total_label ?? "0 MB"}</strong>
              </article>
            </div>

            <div className="library-shelf">
              {visibleLibraryItems.slice(0, 6).map((item) => (
                <button
                  className={`library-card ${item.archive_state}`}
                  key={item.id}
                  onClick={() => void handleOpenLibraryDetail(item)}
                  type="button"
                >
                  <div className="library-thumb">
                    {item.thumbnail_url ? <img alt="" src={item.thumbnail_url} /> : <BookOpen size={18} />}
                    <span>{libraryStateLabel(item, t)}</span>
                  </div>
                  <div className="library-copy">
                    <strong>{item.title}</strong>
                    <span>{item.video_external_id}</span>
                    <div className="library-fidelity">
                      {item.duration_seconds ? <em className="media-duration-chip">{formatDuration(item.duration_seconds)}</em> : null}
                      <em className={`integrity-chip ${item.integrity_state}`}>{integrityLabel(item.integrity_state, t)}</em>
                      <em>{t("library.fidelity").replace("{count}", String(fidelityCount(item)))}</em>
                      {mediaProfileLabel(item) ? <em className="media-profile-chip">{mediaProfileLabel(item)}</em> : null}
                      {item.queue_status ? <em>{jobStatusLabel(item.queue_status, t)}</em> : null}
                      {item.total_bytes > 0 ? <em>{item.total_label}</em> : null}
                    </div>
                  </div>
                </button>
              ))}
              {visibleLibraryItems.length === 0 ? (
                <div className={`library-empty-state ${librarySourceItemCount === 0 ? "empty" : "filtered"}`}>
                  <div className="library-empty-icon">
                    {librarySourceItemCount === 0 ? <BookOpen size={20} /> : <ListFilter size={20} />}
                  </div>
                  <strong>
                    {librarySourceItemCount === 0
                      ? t("library.empty.noItemsTitle")
                      : t("library.empty.filteredTitle")}
                  </strong>
                  <span>
                    {librarySourceItemCount === 0
                      ? t("library.empty.noItemsDetail")
                      : t("library.empty.filteredDetail")}
                  </span>
                  <div className="library-empty-actions">
                    {librarySourceItemCount === 0 ? (
                      <>
                        <button
                          className="primary-action"
                          disabled={!registeredChannelId || workflowStatus === "syncing"}
                          onClick={() => void handleManualSync()}
                          type="button"
                        >
                          <RotateCcw size={15} />
                          {t("library.empty.sync")}
                        </button>
                        <button className="command-button" onClick={openQueueWorkspace} type="button">
                          <Rocket size={15} />
                          {t("library.empty.queue")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="primary-action" disabled={!libraryHasActiveFilters} onClick={handleResetLibraryFilters} type="button">
                          <ListFilter size={15} />
                          {t("library.empty.clear")}
                        </button>
                        <button
                          className="command-button"
                          onClick={() => {
                            setActiveNavId("insights");
                            window.setTimeout(() => scrollToAppSection(".storage-panel"), 0);
                          }}
                          type="button"
                        >
                          <FolderTree size={15} />
                          {t("library.empty.storage")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {showLowerGrid ? (
        <section className={`lower-grid ${showChannelWorkspace ? "channel-lower-grid" : ""}`}>
          {showDashboardWorkspace ? (
          <motion.div
            className="panel activity-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.recent.kicker")}</p>
                <h2>{t("panel.recent.title")}</h2>
              </div>
              <Clock3 size={20} className="panel-icon" />
            </div>
            <div className="activity-list">
              {renderedActivity.map((item) => (
                <article className={`activity-row ${item.status}`} key={`${item.title}-${item.time}`}>
                  <span className="activity-state" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.channel}</span>
                  </div>
                  <time>{item.time}</time>
                </article>
              ))}
            </div>
          </motion.div>
          ) : null}

          {showDashboardWorkspace || showInsightsWorkspace ? (
          <motion.div
            className="panel storage-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.storage.kicker")}</p>
                <h2>{t("panel.storage.title")}</h2>
              </div>
              <Database size={20} className="panel-icon" />
            </div>
            {storageVolume ? (
              <div className="storage-volume">
                <div>
                  <span>{t("storage.scan.root")}</span>
                  <code>{storageVolume.root}</code>
                  {storageScan ? (
                    <small>
                      {t("storage.scan.scanned").replace("{time}", formatEventTime(storageScan.scanned_at))} ·{" "}
                      {t("storage.scan.hostPressure").replace("{percent}", String(storageVolume.pressure_percent))}
                    </small>
                  ) : null}
                </div>
                <strong>{storageVolume.archive_label}</strong>
                <div className="storage-volume-bar" aria-label={t("storage.scan.pressure")}>
                  <span style={{ width: `${storageArchivePercent}%` }} />
                </div>
                <small>
                  {t("storage.scan.free")
                    .replace("{free}", storageVolume.free_label)
                    .replace("{total}", storageVolume.total_label)}
                </small>
              </div>
            ) : null}
            {storagePressureTrend ? (
              <div className="storage-pressure-trend" aria-label={t("storage.pressure.title")}>
                <div className="storage-pressure-head">
                  <div>
                    <span>
                      <Waves size={14} />
                      {t("storage.pressure.title")}
                    </span>
                    <small>
                      {storagePressureSnapshotCount
                        ? t("storage.pressure.subtitle").replace("{count}", String(storagePressureSnapshotCount))
                        : t("storage.pressure.empty")}
                    </small>
                  </div>
                  <button
                    disabled={storagePressureStatus === "saving" || !storageScan}
                    onClick={() => void handleCaptureStoragePressureSnapshot()}
                    type="button"
                  >
                    <Save size={13} />
                    {storagePressureStatus === "saving"
                      ? t("storage.pressure.capturing")
                      : storagePressureStatus === "done"
                        ? t("storage.pressure.captured")
                        : t("storage.pressure.capture")}
                  </button>
                </div>
                <div className="storage-pressure-kpis">
                  <article>
                    <span>{t("storage.pressure.latest")}</span>
                    <strong>{storagePressureLatest?.archive_label ?? storageVolume?.archive_label ?? "0 MB"}</strong>
                  </article>
                  <article>
                    <span>{t("storage.pressure.delta")}</span>
                    <strong>{storagePressureTrend.delta_archive_label}</strong>
                  </article>
                  <article>
                    <span>{t("storage.pressure.daily")}</span>
                    <strong>{storagePressureTrend.daily_growth_label}</strong>
                  </article>
                  <article>
                    <span>{t("storage.pressure.runway")}</span>
                    <strong>{storagePressureTrend.runway_label}</strong>
                  </article>
                </div>
                {storagePressureTrend.snapshots.length ? (
                  <div className="storage-pressure-bars" aria-label={t("storage.pressure.bars")}>
                    {storagePressureTrend.snapshots.slice(-12).map((snapshot) => (
                      <span
                        key={snapshot.id}
                        style={{ height: `${Math.max(12, Math.round((snapshot.archive_bytes / storagePressurePeakBytes) * 100))}%` }}
                        title={`${formatDateTimeLabel(snapshot.scanned_at, t("storage.quarantine.unknownTime"))} · ${snapshot.archive_label}`}
                      >
                        <i />
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="storage-pressure-foot">
                  <span>
                    <Gauge size={13} />
                    {t("storage.pressure.pressure").replace(
                      "{percent}",
                      String(storagePressureLatest?.pressure_percent ?? storageVolume?.pressure_percent ?? 0),
                    )}
                  </span>
                  {storagePressureTrend.warning ? (
                    <em>{storagePressureWarningLabel(storagePressureTrend.warning, t)}</em>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="storage-map">
              {storageMapChannels.map((channel) => (
                <div
                  className={`storage-cell ${channel.warn ? "warn" : ""}`}
                  key={channel.id}
                  style={{ flexGrow: channel.storageGb }}
                  title={`${channel.title}: ${channel.label}`}
                >
                  <span>{channel.title}</span>
                  <strong>{channel.label}</strong>
                  {storageScan ? (
                    <small>
                      {channel.mediaCount} {t("storage.scan.media")} · {channel.orphanSidecars} {t("storage.scan.orphan")}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>
            {storageScan ? (
              <div className="storage-scan-grid">
                <article>
                  <span>{t("storage.scan.files")}</span>
                  <strong>{storageScan.volume.file_count}</strong>
                </article>
                <article>
                  <span>{t("storage.scan.folders")}</span>
                  <strong>{storageScan.volume.dir_count}</strong>
                </article>
                <article>
                  <span>{t("storage.scan.orphans")}</span>
                  <strong>{storageScan.orphan_sidecars.length}</strong>
                </article>
                <article>
                  <span>{t("storage.scan.unindexed")}</span>
                  <strong>{storageDrift.unindexed_media_count}</strong>
                </article>
                <article>
                  <span>{t("storage.scan.indexedMissing")}</span>
                  <strong>{storageDrift.indexed_missing_count}</strong>
                </article>
              </div>
            ) : null}
            {storageScan ? (
              <div className={`storage-recovery-strip ${storageDriftTotal ? "needs-action" : "clean"}`}>
                <div>
                  <HardDrive size={16} />
                  <div>
                    <strong>{t("storage.recovery.title")}</strong>
                    <span>
                      {storageDriftTotal
                        ? t("storage.recovery.drift")
                            .replace("{unindexed}", String(storageDrift.unindexed_media_count))
                            .replace("{missing}", String(storageDrift.indexed_missing_count))
                        : t("storage.recovery.clean")}
                    </span>
                  </div>
                </div>
                <button disabled={workflowStatus === "bulk"} onClick={handleApplyRescan} type="button">
                  <Download size={14} />
                  {workflowStatus === "bulk" ? t("import.rescan.running") : t("storage.recovery.action")}
                </button>
              </div>
            ) : null}
            {storageScan ? (
              <div className="storage-triage-console" aria-label={t("storage.triage.title")}>
                <div className="storage-triage-head">
                  <span>
                    <SlidersHorizontal size={13} />
                    {t("storage.triage.title")}
                  </span>
                  <strong>{storageTriageMode}</strong>
                </div>
                <div className="storage-triage-grid">
                  <article>
                    <span>{t("storage.triage.orphans")}</span>
                    <strong>{storageScan.orphan_sidecars.length}</strong>
                    <small>{storageOrphanBytesLabel} · {storageOrphanKindSummary}</small>
                  </article>
                  <article>
                    <span>{t("storage.triage.pressure")}</span>
                    <strong>{storagePressureLeader?.pressure_score ?? 0}</strong>
                    <small>{storagePressureLeader?.title ?? t("storage.triage.none")}</small>
                  </article>
                  <article>
                    <span>{t("storage.triage.drift")}</span>
                    <strong>{storageDriftTotal}</strong>
                    <small>
                      {storageDrift.unindexed_media_count} {t("storage.scan.unindexed")} ·{" "}
                      {storageDrift.indexed_missing_count} {t("storage.scan.indexedMissing")}
                    </small>
                  </article>
                </div>
                <div className="storage-triage-actions">
                  <button onClick={() => handleOpenStorageTriageView("missing_media")} type="button">
                    <AlertTriangle size={13} />
                    {t("storage.triage.actionMissing")}
                  </button>
                  <button onClick={() => handleOpenStorageTriageView("partial_sidecars")} type="button">
                    <FileCheck2 size={13} />
                    {t("storage.triage.actionSidecar")}
                  </button>
                  <button disabled={!storageReportRows.length} onClick={() => void handleCopyStorageReport()} type="button">
                    <ClipboardList size={13} />
                    {storageReportCopyStatus === "copied"
                      ? t("storage.triage.copyCopied")
                      : storageReportCopyStatus === "error"
                        ? t("runtime.ticks.copyError")
                        : t("storage.triage.copyReport")}
                  </button>
                  <button disabled={!storageReportRows.length} onClick={() => handleDownloadStorageReport("csv")} type="button">
                    <Download size={13} />
                    {t("storage.triage.exportCsv")}
                  </button>
                  <button onClick={() => void handleOpenStorageQuarantine()} type="button">
                    <FileArchive size={13} />
                    {storageQuarantine?.count
                      ? t("storage.quarantine.openWithCount").replace("{count}", String(storageQuarantine.count))
                      : t("storage.quarantine.open")}
                  </button>
                </div>
                {storageScan.orphan_sidecars.length ? (
                  <div className="storage-orphan-kind-filter" aria-label={t("storage.triage.kindFilter")}>
                    {storageOrphanKinds.map((kind) => (
                      <button
                        className={storageOrphanKindFilter === kind ? "active" : ""}
                        key={kind}
                        onClick={() => setStorageOrphanKindFilter(kind)}
                        type="button"
                      >
                        {kind === "all" ? t("storage.triage.allKinds") : kind}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {storageScan?.folder_tree.length ? (
              <div className="storage-tree-panel" aria-label={t("storage.scan.tree")}>
                <div className="storage-tree-head">
                  <span>
                    <FolderTree size={13} />
                    {t("storage.scan.tree")}
                  </span>
                  <code>{storageScan.folder_tree.length}</code>
                </div>
                {storageScan.folder_tree.slice(0, 7).map((node) => (
                  <article key={node.relative_path}>
                    <div className="storage-tree-copy" style={{ paddingLeft: `${Math.min(node.depth, 4) * 10}px` }}>
                      <Folder size={13} />
                      <div>
                        <strong>{node.name}</strong>
                        <small>
                          {node.file_count} {t("storage.scan.files")} · {node.relative_path}
                        </small>
                      </div>
                      <em>{node.label}</em>
                    </div>
                    <i style={{ width: `${Math.max(5, Math.round((node.bytes / storageFolderMaxBytes) * 100))}%` }} />
                  </article>
                ))}
              </div>
            ) : null}
            {storageScan?.top_extensions.length ? (
              <div className="storage-extension-rail" aria-label={t("storage.scan.extensions")}>
                <div className="storage-extension-head">
                  <span>{t("storage.scan.extensions")}</span>
                  <strong>{storageScan.top_extensions[0].extension}</strong>
                </div>
                {storageScan.top_extensions.slice(0, 5).map((extension) => (
                  <article key={extension.extension}>
                    <div>
                      <code>{extension.extension}</code>
                      <span>
                        {extension.count} · {extension.label}
                      </span>
                    </div>
                    <i style={{ width: `${Math.max(8, Math.round((extension.bytes / storageExtensionMaxBytes) * 100))}%` }} />
                  </article>
                ))}
              </div>
            ) : null}
            {storageScan && (storageDrift.unindexed_media.length || storageDrift.indexed_missing.length) ? (
              <div className="storage-drift-list" aria-label={t("storage.scan.drift")}>
                {[...storageDrift.unindexed_media, ...storageDrift.indexed_missing].slice(0, 4).map((item) => {
                  const actionStatus = storageDriftActionStatus[storageDriftActionKey(item)] ?? "idle";
                  const isRecover = item.kind === "unindexed_media";
                  const DriftActionIcon = isRecover ? RotateCcw : Trash2;
                  return (
                    <article
                      className={`${item.kind} ${storageFocusPath === item.relative_path ? "focused" : ""}`}
                      key={`${item.kind}-${item.relative_path}`}
                    >
                      <span>
                        {isRecover ? t("storage.scan.unindexed") : t("storage.scan.indexedMissing")}
                      </span>
                      <code>{item.relative_path}</code>
                      <div className="storage-drift-actions">
                        <em>{item.label}</em>
                        <button
                          disabled={actionStatus === "running" || workflowStatus === "bulk"}
                          onClick={() => void handlePreviewStorageDrift(item)}
                          type="button"
                        >
                          <DriftActionIcon size={12} />
                          {actionStatus === "running"
                            ? t("storage.drift.running")
                            : isRecover
                              ? t("storage.drift.recover")
                              : t("storage.drift.pruneIndex")}
                        </button>
                        {actionStatus === "done" || actionStatus === "error" ? (
                          <small className={actionStatus}>{actionStatus === "done" ? t("storage.drift.done") : t("workflow.error")}</small>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
            {storageScan?.warnings.length ? (
              <div className="storage-warning-list" aria-label={t("storage.scan.warnings")}>
                {storageScan.warnings.slice(0, 3).map((warning) => (
                  <span key={warning}>
                    <AlertTriangle size={13} />
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}
            {storageScan?.orphan_sidecars.length ? (
              <div className="storage-orphan-list" aria-label={t("storage.triage.orphanList")}>
                <div className="storage-orphan-list-head">
                  <span>{t("storage.triage.orphanList")}</span>
                  <strong>
                    {filteredStorageOrphans.length}/{storageScan.orphan_sidecars.length}
                  </strong>
                </div>
                {filteredStorageOrphans.slice(0, 5).map((sidecar) => (
                  <article className="storage-orphan-row" key={sidecar.relative_path}>
                    <code>
                      {sidecar.kind} · {sidecar.relative_path}
                    </code>
                    <button
                      disabled={storageOrphanQuarantineStatus === "planning" || storageOrphanQuarantineStatus === "running"}
                      onClick={() => void handlePreviewOrphanQuarantine(sidecar)}
                      type="button"
                    >
                      <Archive size={12} />
                      {t("storage.orphan.quarantinePlan")}
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </motion.div>

          ) : null}

          {showDashboardWorkspace || showChannelWorkspace ? (
          <motion.div
            className="panel quick-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.import.kicker")}</p>
                <h2>{t("panel.import.title")}</h2>
              </div>
              <FileArchive size={20} className="panel-icon violet" />
            </div>
            <div className="import-list">
              {importOptions.map((item) => (
                <article className={`import-row ${item.tone}`} key={item.labelKey}>
                  <span className="import-state" />
                  <div>
                    <strong>{t(item.labelKey)}</strong>
                    <small>{t(item.detailKey)}</small>
                  </div>
                  <em>{t(item.statusKey)}</em>
                </article>
              ))}
            </div>
            <div className="archive-pathway" aria-label={t("archiveTxt.path.title")}>
              <div className="archive-pathway-head">
                <span>
                  <Sparkles size={14} />
                  {t("archiveTxt.path.kicker")}
                </span>
                <strong>{t("archiveTxt.path.title")}</strong>
              </div>
              <div className="archive-pathway-steps">
                <article className={registeredChannelId ? "ready" : ""}>
                  <span>{t("archiveTxt.path.source")}</span>
                  <strong>{registeredChannelId ? activeTitle : t("archiveTxt.path.noSource")}</strong>
                  <button
                    onClick={() => {
                      openChannelWorkspace("overview", ".registration-panel");
                    }}
                    type="button"
                  >
                    <Link2 size={12} />
                    {t("archiveTxt.path.register")}
                  </button>
                </article>
                <article className={archiveTxtPreview ? "ready" : ""}>
                  <span>{t("archiveTxt.path.ledger")}</span>
                  <strong>
                    {archiveTxtPreview
                      ? t("archiveTxt.path.ledgerCount")
                          .replace("{archived}", String(archiveTxtPreview.archived_count))
                          .replace("{missing}", String(archiveTxtPreview.known_missing_count))
                      : t("archiveTxt.path.ledgerIdle")}
                  </strong>
                  <button
                    disabled={archiveTxtStatus === "previewing" || !archiveTxtDraft.trim()}
                    onClick={() => void handlePreviewArchiveTxt()}
                    type="button"
                  >
                    <ClipboardList size={12} />
                    {archiveTxtStatus === "previewing" ? t("archiveTxt.previewing") : t("archiveTxt.preview")}
                  </button>
                </article>
                <article className={simpleFlowStats.queued || simpleFlowStats.running ? "ready" : ""}>
                  <span>{t("archiveTxt.path.queue")}</span>
                  <strong>
                    {t("archiveTxt.path.queueCount")
                      .replace("{fresh}", String(simpleFlowStats.fresh))
                      .replace("{queued}", String(simpleFlowStats.queued))}
                  </strong>
                  <button
                    disabled={!registeredChannelId}
                    onClick={() => {
                      openChannelWorkspace("downloads", ".launch-control-panel");
                    }}
                    type="button"
                  >
                    <History size={12} />
                    {t("archiveTxt.path.progress")}
                  </button>
                </article>
              </div>
            </div>
            <div className="archive-txt-console" aria-label={t("archiveTxt.title")}>
              <div className="archive-txt-head">
                <div>
                  <strong>{t("archiveTxt.title")}</strong>
                  <small>{t("archiveTxt.subtitle")}</small>
                </div>
                <button
                  disabled={archiveTxtStatus === "previewing" || !archiveTxtDraft.trim()}
                  onClick={() => void handlePreviewArchiveTxt()}
                  type="button"
                >
                  <ClipboardList size={13} />
                  {archiveTxtStatus === "previewing" ? t("archiveTxt.previewing") : t("archiveTxt.preview")}
                </button>
              </div>
              <div className="archive-txt-wizard" aria-label={t("archiveTxt.wizard.title")}>
                {[
                  {
                    label: t("archiveTxt.wizard.source"),
                    detail: archiveTxtDraft.trim()
                      ? t("archiveTxt.wizard.sourceReady").replace("{count}", String(archiveTxtDraftLineCount))
                      : t("archiveTxt.wizard.sourceIdle"),
                  },
                  {
                    label: t("archiveTxt.wizard.preview"),
                    detail: archiveTxtPreview
                      ? t("archiveTxt.wizard.previewReady")
                          .replace("{archived}", String(archiveTxtPreview.archived_count))
                          .replace("{missing}", String(archiveTxtPreview.known_missing_count))
                          .replace("{unknown}", String(archiveTxtPreview.unknown_count))
                      : t("archiveTxt.wizard.previewIdle"),
                  },
                  {
                    label: t("archiveTxt.wizard.stage"),
                    detail: archiveTxtStageResult
                      ? t("archiveTxt.wizard.stageReady")
                          .replace("{videos}", String(archiveTxtStageResult.videos_created))
                          .replace("{candidates}", String(archiveTxtStageResult.candidates_created))
                      : t("archiveTxt.wizard.stageIdle").replace("{count}", String(archiveTxtStageableCount)),
                  },
                  {
                    label: t("archiveTxt.wizard.queue"),
                    detail: archiveTxtStageResult
                      ? t("archiveTxt.wizard.queueReady").replace("{count}", String(archiveTxtStageResult.candidates_created))
                      : t("archiveTxt.wizard.queueIdle").replace("{queued}", String(simpleFlowStats.queued)),
                  },
                ].map((step, index) => (
                  <article
                    className={`${index < archiveTxtWizardStepIndex ? "ready" : ""} ${index === archiveTxtWizardStepIndex ? "active" : ""}`.trim()}
                    key={step.label}
                  >
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </div>
                  </article>
                ))}
              </div>
              <div
                className="archive-txt-file-tools"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleArchiveTxtDrop}
              >
                <div>
                  <strong>{t("archiveTxt.dropTitle")}</strong>
                  <small>{t("archiveTxt.dropDetail")}</small>
                </div>
                <div className="archive-txt-file-actions">
                  <label className="archive-txt-file-button">
                    <input
                      accept=".txt,text/plain"
                      aria-label={t("archiveTxt.fileSelect")}
                      onChange={handleArchiveTxtFileChange}
                      type="file"
                    />
                    <FileText size={13} />
                    {t("archiveTxt.fileSelect")}
                  </label>
                  <button disabled={!archiveTxtDraft.trim()} onClick={() => replaceArchiveTxtDraft("")} type="button">
                    <Trash2 size={13} />
                    {t("archiveTxt.clear")}
                  </button>
                </div>
              </div>
              {archiveTxtDraft.trim() ? <p className="archive-txt-autosave">{t("archiveTxt.autosaved")}</p> : null}
              <textarea
                aria-label={t("archiveTxt.input")}
                onChange={(event) => {
                  replaceArchiveTxtDraft(event.target.value);
                }}
                placeholder={t("archiveTxt.placeholder")}
                spellCheck={false}
                value={archiveTxtDraft}
              />
              {archiveTxtPreview ? (
                <div className="archive-txt-preview">
                  <div className="archive-txt-stats">
                    <span>
                      <strong>{archiveTxtPreview.archived_count}</strong>
                      {t("archiveTxt.archived")}
                    </span>
                    <span>
                      <strong>{archiveTxtPreview.known_missing_count}</strong>
                      {t("archiveTxt.missing")}
                    </span>
                    <span>
                      <strong>{archiveTxtPreview.unknown_count}</strong>
                      {t("archiveTxt.unknown")}
                    </span>
                    <span>
                      <strong>{archiveTxtPreview.duplicate_count + archiveTxtPreview.invalid_count}</strong>
                      {t("archiveTxt.review")}
                    </span>
                  </div>
                  <div className="archive-txt-stage">
                    <div>
                      <strong>{t("archiveTxt.stageTitle")}</strong>
                      <small>
                        {registeredChannelId
                          ? t("archiveTxt.stageSubtitle")
                              .replace("{count}", String(archiveTxtStageableCount))
                              .replace("{quality}", channelPolicy?.max_quality ?? maxQuality)
                          : t("archiveTxt.stageNeedsChannel")}
                      </small>
                    </div>
                    <button
                      disabled={!registeredChannelId || archiveTxtStageStatus === "staging" || archiveTxtStageableCount <= 0}
                      onClick={() => void handleStageArchiveTxt()}
                      type="button"
                    >
                      <Rocket size={13} />
                      {archiveTxtStageStatus === "staging" ? t("archiveTxt.staging") : t("archiveTxt.stage")}
                    </button>
                  </div>
                  {archiveTxtStageResult ? (
                    <>
                      <div className="archive-txt-stage-result">
                        <span>
                          <strong>{archiveTxtStageResult.videos_created}</strong>
                          {t("archiveTxt.stageVideos")}
                        </span>
                        <span>
                          <strong>{archiveTxtStageResult.candidates_created}</strong>
                          {t("archiveTxt.stageCandidates")}
                        </span>
                        <span>
                          <strong>{archiveTxtStageResult.skipped_count}</strong>
                          {t("archiveTxt.stageSkipped")}
                        </span>
                      </div>
                      {archiveTxtStageResult.videos_created > 0 ? (
                        <div className={`archive-txt-sync-handoff ${archiveTxtSyncStatus}`}>
                          <div>
                            <strong>{t("archiveTxt.syncTitle")}</strong>
                            <small>{t("archiveTxt.syncSubtitle")}</small>
                          </div>
                          <button
                            disabled={archiveTxtSyncStatus === "syncing" || !registeredChannelId}
                            onClick={() => void handleArchiveTxtMetadataSync()}
                            type="button"
                          >
                            <Sparkles size={13} />
                            {archiveTxtSyncStatus === "syncing" ? t("archiveTxt.syncing") : t("archiveTxt.sync")}
                          </button>
                          {archiveTxtSyncResult ? (
                            <div className="archive-txt-sync-metrics">
                              <span>
                                <strong>{archiveTxtSyncResult.videos_enriched}</strong>
                                {t("archiveTxt.syncEnriched")}
                              </span>
                              <span>
                                <strong>{archiveTxtSyncResult.videos_created}</strong>
                                {t("archiveTxt.syncCreated")}
                              </span>
                              <span>
                                <strong>{archiveTxtSyncResult.videos_seen}</strong>
                                {t("archiveTxt.syncSeen")}
                              </span>
                            </div>
                          ) : null}
                          {archiveTxtStageResult.video_ids.length > 0 ? (
                            <div className="archive-txt-enrichment-review">
                              <div className="archive-txt-enrichment-counts">
                                <span>
                                  <strong>{archiveTxtStagedVideoRows.enriched.length}</strong>
                                  {t("archiveTxt.enrichmentUpgraded")}
                                </span>
                                <span>
                                  <strong>{archiveTxtStagedVideoRows.pending.length}</strong>
                                  {t("archiveTxt.enrichmentPending")}
                                </span>
                              </div>
                              <div className="archive-txt-enrichment-rows">
                                {archiveTxtStagedVideoRows.rows.slice(0, 4).map((video) => {
                                  const pending = video.title.startsWith(archiveTxtPlaceholderPrefix);
                                  return (
                                    <article className={pending ? "pending" : "ready"} key={video.id}>
                                      <span>{pending ? t("archiveTxt.enrichmentPendingLabel") : t("archiveTxt.enrichmentReadyLabel")}</span>
                                      <strong>{pending ? video.external_id : video.title}</strong>
                                      <small>{video.upload_date ?? video.published_at ?? video.external_id}</small>
                                    </article>
                                  );
                                })}
                                {archiveTxtStagedVideoRows.rows.length === 0 ? (
                                  <p className="empty-copy">{t("archiveTxt.enrichmentEmpty")}</p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {archiveTxtStageResult.candidates_created > 0 ? (
                        <div className={`archive-txt-queue-handoff ${archiveTxtQueueStatus}`}>
                          <div>
                            <strong>{t("archiveTxt.queueTitle")}</strong>
                            <small>
                              {t("archiveTxt.queueSubtitle").replace(
                                "{count}",
                                String(Math.min(5, archiveTxtStageResult.job_ids.length)),
                              )}
                            </small>
                          </div>
                          <div className="archive-txt-queue-actions">
                            <button disabled={queueConsoleStatus === "loading"} onClick={() => void handleArchiveTxtOpenQueue()} type="button">
                              <History size={13} />
                              {t("archiveTxt.queueOpen")}
                            </button>
                            <button disabled={archiveTxtQueueStatus === "preparing"} onClick={() => void handleArchiveTxtPrepareQueue()} type="button">
                              <Rocket size={13} />
                              {archiveTxtQueueStatus === "preparing" ? t("archiveTxt.queuePreparing") : t("archiveTxt.queuePrepare")}
                            </button>
                            <button
                              disabled={archiveTxtRunStatus === "running" || archiveTxtQueueStatus === "preparing"}
                              onClick={() => void handleArchiveTxtOpenRunConfirm()}
                              type="button"
                            >
                              <Zap size={13} />
                              {archiveTxtRunStatus === "running" ? t("archiveTxt.runRunning") : t("archiveTxt.runPrepare")}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div className="archive-txt-rows">
                    {archiveTxtPreview.items.slice(0, 5).map((item) => (
                      <article className={item.state} key={`${item.line_number}-${item.video_external_id ?? item.raw}`}>
                        <span>{archiveTxtStateLabel(item.state, t)}</span>
                        <strong>{item.title ?? item.video_external_id ?? t("archiveTxt.invalid")}</strong>
                        <small>{item.reason}</small>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {rescanResult ? (
              <div className="rescan-result">
                <span>
                  <strong>{rescanResult.candidates_seen}</strong>
                  {t("import.rescan.candidates")}
                </span>
                <span>
                  <strong>{rescanResult.media_files_indexed}</strong>
                  {t("import.rescan.files")}
                </span>
                <span>
                  <strong>{rescanResult.warnings.length}</strong>
                  {t("import.rescan.warnings")}
                </span>
              </div>
            ) : null}
            <button className="primary-action" disabled={workflowStatus === "bulk"} onClick={handleApplyRescan} type="button">
              <Download size={16} />
              {workflowStatus === "bulk" ? t("import.rescan.running") : t("import.review")}
            </button>
          </motion.div>
          ) : null}
        </section>
        ) : null}
          </>
        ) : null}
      </section>
      {selectedStorageDriftItem ? (
        <div
          className="download-confirm-backdrop"
          onClick={() => {
            setSelectedStorageDriftItem(null);
            setStorageDriftPreview(null);
            setStorageDriftPreviewStatus("idle");
          }}
          role="presentation"
        >
          <section
            aria-label={t("storage.drift.previewTitle")}
            className="download-confirm-modal storage-drift-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-confirm-head">
              <div>
                <p className="panel-kicker">{t("storage.recovery.title")}</p>
                <h2>{t("storage.drift.previewTitle")}</h2>
                <span>
                  {selectedStorageDriftItem.kind === "unindexed_media"
                    ? t("storage.drift.previewRecoverSubtitle")
                    : t("storage.drift.previewPruneSubtitle")}
                </span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => {
                  setSelectedStorageDriftItem(null);
                  setStorageDriftPreview(null);
                  setStorageDriftPreviewStatus("idle");
                }}
                title={t("actions.close")}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="download-confirm-list storage-drift-preview">
              <span>
                <strong>{t("storage.drift.previewAction")}</strong>
                <em>
                  {selectedStorageDriftItem.kind === "unindexed_media"
                    ? t("storage.drift.recover")
                    : t("storage.drift.pruneIndex")}
                </em>
              </span>
              <span>
                <strong>{t("storage.orphan.source")}</strong>
                <em>{selectedStorageDriftItem.relative_path}</em>
              </span>
              <span>
                <strong>{t("storage.drift.previewCount")}</strong>
                <em>
                  {storageDriftPreviewStatus === "planning"
                    ? t("events.refreshing")
                    : selectedStorageDriftItem.kind === "unindexed_media"
                      ? t("storage.drift.previewRecoverCount").replace("{count}", "1")
                      : t("storage.drift.previewPruneCount").replace(
                          "{count}",
                          String(storageDriftPreview?.deleted_media_files ?? 0),
                        )}
                </em>
              </span>
              {selectedStorageDriftItem.kind === "unindexed_media" ? (
                <span>
                  <strong>{t("storage.drift.previewSidecars")}</strong>
                  <em>
                    {t("storage.drift.sidecarBreakdown")
                      .replace("{json}", String(storageDriftPreview?.planned_info_json ?? 0))
                      .replace("{subtitles}", String(storageDriftPreview?.planned_subtitles ?? 0))
                      .replace("{thumbnails}", String(storageDriftPreview?.planned_thumbnails ?? 0))
                      .replace("{nfo}", String(storageDriftPreview?.planned_nfo ?? 0))}
                  </em>
                </span>
              ) : null}
              <span>
                <strong>{t("storage.orphan.size")}</strong>
                <em>{selectedStorageDriftItem.label}</em>
              </span>
              {storageDriftPreview?.warnings.length ? (
                <span className="warning">
                  <strong>{t("storage.scan.warnings")}</strong>
                  <em>{storageDriftPreview.warnings.join(" · ")}</em>
                </span>
              ) : null}
            </div>
            <div className="download-confirm-actions">
              <button
                onClick={() => {
                  setSelectedStorageDriftItem(null);
                  setStorageDriftPreview(null);
                  setStorageDriftPreviewStatus("idle");
                }}
                type="button"
              >
                {t("actions.cancel")}
              </button>
              <button
                className="primary-action"
                disabled={
                  !storageDriftPreview ||
                  storageDriftPreview.warnings.length > 0 ||
                  storageDriftPreviewStatus === "planning" ||
                  storageDriftPreviewStatus === "running"
                }
                onClick={() => void handleApplyStorageDriftPreview()}
                type="button"
              >
                {selectedStorageDriftItem.kind === "unindexed_media" ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                {storageDriftPreviewStatus === "running"
                  ? t("storage.drift.running")
                  : selectedStorageDriftItem.kind === "unindexed_media"
                    ? t("storage.drift.recoverApply")
                    : t("storage.drift.pruneApply")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {selectedStorageOrphan ? (
        <div className="download-confirm-backdrop" onClick={() => setSelectedStorageOrphan(null)} role="presentation">
          <section
            aria-label={t("storage.orphan.quarantineTitle")}
            className="download-confirm-modal storage-orphan-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-confirm-head">
              <div>
                <p className="panel-kicker">{t("storage.triage.title")}</p>
                <h2>{t("storage.orphan.quarantineTitle")}</h2>
                <span>{t("storage.orphan.quarantineSubtitle")}</span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => setSelectedStorageOrphan(null)}
                title={t("actions.close")}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="download-confirm-list storage-orphan-preview">
              <span>
                <strong>{t("storage.orphan.source")}</strong>
                <em>{selectedStorageOrphan.relative_path}</em>
              </span>
              <span>
                <strong>{t("storage.orphan.destination")}</strong>
                <em>
                  {storageOrphanQuarantinePlan?.destination_relative_path ??
                    (storageOrphanQuarantineStatus === "planning" ? t("events.refreshing") : t("storage.triage.none"))}
                </em>
              </span>
              <span>
                <strong>{t("storage.orphan.size")}</strong>
                <em>{selectedStorageOrphan.label}</em>
              </span>
              {storageOrphanQuarantinePlan?.warnings.length ? (
                <span className="warning">
                  <strong>{t("storage.scan.warnings")}</strong>
                  <em>{storageOrphanQuarantinePlan.warnings.join(" · ")}</em>
                </span>
              ) : null}
            </div>
            <div className="download-confirm-actions">
              <button onClick={() => setSelectedStorageOrphan(null)} type="button">
                {t("actions.cancel")}
              </button>
              <button
                className="primary-action"
                disabled={
                  !storageOrphanQuarantinePlan ||
                  storageOrphanQuarantinePlan.warnings.length > 0 ||
                  storageOrphanQuarantineStatus === "planning" ||
                  storageOrphanQuarantineStatus === "running"
                }
                onClick={() => void handleApplyOrphanQuarantine()}
                type="button"
              >
                <Archive size={14} />
                {storageOrphanQuarantineStatus === "running"
                  ? t("storage.orphan.quarantining")
                  : t("storage.orphan.quarantineApply")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {storageQuarantineOpen ? (
        <div
          className="download-confirm-backdrop"
          onClick={() => {
            setStorageQuarantineOpen(false);
            setSelectedStorageQuarantineItem(null);
            setStorageQuarantineRestorePlan(null);
            setStorageQuarantinePurgePlan(null);
          }}
          role="presentation"
        >
          <section
            aria-label={t("storage.quarantine.title")}
            className="download-confirm-modal storage-quarantine-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-confirm-head">
              <div>
                <p className="panel-kicker">{t("storage.triage.title")}</p>
                <h2>{t("storage.quarantine.title")}</h2>
                <span>{t("storage.quarantine.subtitle")}</span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => {
                  setStorageQuarantineOpen(false);
                  setSelectedStorageQuarantineItem(null);
                  setStorageQuarantineRestorePlan(null);
                  setStorageQuarantinePurgePlan(null);
                }}
                title={t("actions.close")}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="storage-quarantine-summary">
              <article>
                <span>{t("storage.quarantine.files")}</span>
                <strong>{storageQuarantine?.count ?? 0}</strong>
              </article>
              <article>
                <span>{t("storage.quarantine.bytes")}</span>
                <strong>{storageQuarantine?.total_label ?? "0 MB"}</strong>
              </article>
              <article>
                <span>{t("storage.quarantine.age")}</span>
                <strong>{storageQuarantineAgeSummary}</strong>
              </article>
              <button
                disabled={storageQuarantineStatus === "loading" || storageQuarantineStatus === "running"}
                onClick={() => void handleOpenStorageQuarantine()}
                type="button"
              >
                <RotateCcw size={13} />
                {storageQuarantineStatus === "loading" ? t("events.refreshing") : t("storage.quarantine.refresh")}
              </button>
              <button disabled={!storageQuarantineRows.length} onClick={() => handleDownloadStorageQuarantine("csv")} type="button">
                <Download size={13} />
                {t("runtime.ticks.exportCsv")}
              </button>
              <button disabled={!storageQuarantineRows.length} onClick={() => handleDownloadStorageQuarantine("ndjson")} type="button">
                <FileText size={13} />
                {t("runtime.ticks.exportNdjson")}
              </button>
            </div>
            <div className="storage-quarantine-purge" aria-label={t("storage.quarantine.purgeTitle")}>
              <div className="storage-quarantine-purge-head">
                <div>
                  <span>
                    <Trash2 size={14} />
                    {t("storage.quarantine.purgeTitle")}
                  </span>
                  <small>{t("storage.quarantine.purgeSubtitle")}</small>
                </div>
                <label>
                  <span>{t("storage.quarantine.purgeAgeLabel")}</span>
                  <input
                    min="1"
                    max="3650"
                    onChange={(event) => {
                      setStorageQuarantinePurgeAge(event.target.value);
                      setStorageQuarantinePurgePlan(null);
                    }}
                    type="number"
                    value={storageQuarantinePurgeAge}
                  />
                </label>
                <button
                  disabled={storageQuarantineStatus === "planning" || storageQuarantineStatus === "running"}
                  onClick={() => void handlePreviewStorageQuarantinePurge()}
                  type="button"
                >
                  <ShieldCheck size={13} />
                  {storageQuarantineStatus === "planning" ? t("storage.quarantine.purgePlanning") : t("storage.quarantine.purgePlan")}
                </button>
              </div>
              {storageQuarantinePurgePlan ? (
                <div className="storage-quarantine-purge-plan">
                  <span>
                    <strong>{t("storage.quarantine.purgeCandidate")}</strong>
                    <em>
                      {storageQuarantinePurgePlan.candidate_count} · {storageQuarantinePurgePlan.planned_label}
                    </em>
                  </span>
                  <span>
                    <strong>{t("storage.quarantine.purgeRetained")}</strong>
                    <em>{storageQuarantinePurgePlan.retained_count}</em>
                  </span>
                  <span>
                    <strong>{t("storage.quarantine.purgeCutoff")}</strong>
                    <em>{formatDateTimeLabel(storageQuarantinePurgePlan.cutoff_at, t("storage.quarantine.unknownTime"))}</em>
                  </span>
                  {storageQuarantinePurgePlan.warnings.length ? (
                    <span className="warning">
                      <strong>{t("storage.scan.warnings")}</strong>
                      <em>{storageQuarantinePurgePlan.warnings.join(" · ")}</em>
                    </span>
                  ) : null}
                  <label className="storage-quarantine-confirm">
                    <span>{t("storage.quarantine.purgeConfirmLabel")}</span>
                    <input
                      onChange={(event) => setStorageQuarantinePurgeConfirm(event.target.value)}
                      placeholder={storageQuarantinePurgePlan.required_confirmation}
                      value={storageQuarantinePurgeConfirm}
                    />
                  </label>
                  <button
                    className="danger-action"
                    disabled={
                      storageQuarantinePurgePlan.candidate_count === 0 ||
                      storageQuarantinePurgePlan.warnings.length > 0 ||
                      storageQuarantinePurgeConfirm !== storageQuarantinePurgePlan.required_confirmation ||
                      storageQuarantineStatus === "planning" ||
                      storageQuarantineStatus === "running"
                    }
                    onClick={() => void handleApplyStorageQuarantinePurge()}
                    type="button"
                  >
                    <Trash2 size={13} />
                    {storageQuarantineStatus === "running" ? t("storage.quarantine.purging") : t("storage.quarantine.purgeApply")}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="storage-quarantine-list">
              {storageQuarantineStatus === "loading" ? (
                <span className="empty-copy">{t("events.refreshing")}</span>
              ) : storageQuarantine?.items.length ? (
                storageQuarantine.items.slice(0, 8).map((item) => (
                  <article className={item.restore_blocked_reason ? "blocked" : ""} key={item.relative_path}>
                    <div>
                      <code>{item.kind} · {item.original_relative_path}</code>
                      <small>
                        {formatDateTimeLabel(item.quarantined_at, t("storage.quarantine.unknownTime"))} · {item.label}
                      </small>
                    </div>
                    <button
                      disabled={storageQuarantineStatus === "planning" || storageQuarantineStatus === "running"}
                      onClick={() => void handlePreviewStorageQuarantineRestore(item)}
                      type="button"
                    >
                      <RotateCcw size={12} />
                      {t("storage.quarantine.restorePlan")}
                    </button>
                  </article>
                ))
              ) : (
                <span className="empty-copy">{t("storage.quarantine.empty")}</span>
              )}
            </div>
            {selectedStorageQuarantineItem ? (
              <div className="download-confirm-list storage-orphan-preview">
                <span>
                  <strong>{t("storage.quarantine.heldFile")}</strong>
                  <em>{selectedStorageQuarantineItem.relative_path}</em>
                </span>
                <span>
                  <strong>{t("storage.orphan.destination")}</strong>
                  <em>
                    {storageQuarantineRestorePlan?.destination_relative_path ??
                      (storageQuarantineStatus === "planning"
                        ? t("events.refreshing")
                        : selectedStorageQuarantineItem.original_relative_path)}
                  </em>
                </span>
                <span>
                  <strong>{t("storage.orphan.size")}</strong>
                  <em>{selectedStorageQuarantineItem.label}</em>
                </span>
                {storageQuarantineRestorePlan?.warnings.length || selectedStorageQuarantineItem.restore_blocked_reason ? (
                  <span className="warning">
                    <strong>{t("storage.scan.warnings")}</strong>
                    <em>
                      {storageQuarantineRestorePlan?.warnings.join(" · ") ||
                        selectedStorageQuarantineItem.restore_blocked_reason}
                    </em>
                  </span>
                ) : null}
              </div>
            ) : null}
            {storageQuarantine?.warnings.length ? (
              <div className="storage-warning-list">
                {storageQuarantine.warnings.slice(0, 3).map((warning) => (
                  <span key={warning}>
                    <AlertTriangle size={13} />
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="download-confirm-actions">
              <button
                onClick={() => {
                  setStorageQuarantineOpen(false);
                  setSelectedStorageQuarantineItem(null);
                  setStorageQuarantineRestorePlan(null);
                  setStorageQuarantinePurgePlan(null);
                }}
                type="button"
              >
                {t("actions.close")}
              </button>
              <button
                className="primary-action"
                disabled={
                  !selectedStorageQuarantineItem ||
                  !storageQuarantineRestorePlan ||
                  storageQuarantineRestorePlan.warnings.length > 0 ||
                  storageQuarantineStatus === "planning" ||
                  storageQuarantineStatus === "running"
                }
                onClick={() => void handleApplyStorageQuarantineRestore()}
                type="button"
              >
                <RotateCcw size={14} />
                {storageQuarantineStatus === "running"
                  ? t("storage.quarantine.restoring")
                  : t("storage.quarantine.restoreApply")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {queueConsoleConfirmOpen ? (
        <div className="download-confirm-backdrop" onClick={() => setQueueConsoleConfirmOpen(false)} role="presentation">
          <aside
            aria-label={t("queue.console.confirmTitle")}
            className="download-confirm-modal queue-confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-confirm-head">
              <div>
                <p className="panel-kicker">{t("queue.console.kicker")}</p>
                <h2>{t("queue.console.confirmTitle")}</h2>
                <span>{t("queue.console.confirmSubtitle")}</span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => setQueueConsoleConfirmOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="download-confirm-grid">
              <article>
                <span>{t("worker.liveConfirm.limit")}</span>
                <strong>5</strong>
              </article>
              <article>
                <span>{t("queue.console.confirmClaimable")}</span>
                <strong>{queueConsoleWorkerPlan?.claimable_count ?? 0}</strong>
              </article>
              <article>
                <span>{t("queue.console.confirmSkipped")}</span>
                <strong>{queueConsoleSkippedCount}</strong>
              </article>
            </div>
            <div className="download-confirm-list">
              {queueConsoleConfirmJobs.map((item) => (
                <span key={item.job.id}>
                  <CheckCircle2 size={13} />
                  <strong>{item.job.video_title}</strong>
                  <em>{item.job.channel_title}</em>
                </span>
              ))}
              {queueConsoleConfirmJobs.length === 0 ? <p className="empty-copy">{t("queue.console.confirmEmpty")}</p> : null}
            </div>
            {queueConsoleConfirmJobs.length ? (
              <div className="queue-confirm-command-list" aria-label={t("queue.console.confirmCommandPreview")}>
                <strong>
                  <Terminal size={13} />
                  {t("queue.console.confirmCommandPreview")}
                </strong>
                {queueConsoleConfirmJobs.slice(0, 3).map((item) => (
                  <code key={item.job.id}>{item.command_preview}</code>
                ))}
              </div>
            ) : null}
            {queueConsoleWorkerPlan?.locked_reason ? <code className="worker-lock">{queueConsoleWorkerPlan.locked_reason}</code> : null}
            <div className="download-confirm-actions">
              <button className="command-button" onClick={() => setQueueConsoleConfirmOpen(false)} type="button">
                {t("worker.liveCancel")}
              </button>
              <button
                className="primary-action"
                disabled={
                  queueConsoleStatus === "worker" ||
                  !queueConsoleWorkerPlan?.enabled ||
                  Boolean(queueConsoleWorkerPlan?.locked_reason) ||
                  queueConsoleConfirmJobs.length === 0
                }
                onClick={() => void handleQueueConsoleRunWorker()}
                type="button"
              >
                <Rocket size={16} />
                {queueConsoleStatus === "worker" ? t("worker.liveRunning") : t("queue.console.confirmStart")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      {archiveTxtRunConfirmOpen ? (
        <div
          className="download-confirm-backdrop"
          onClick={() => {
            if (archiveTxtRunStatus !== "running") setArchiveTxtRunConfirmOpen(false);
          }}
          role="presentation"
        >
          <aside
            aria-label={t("archiveTxt.runConfirmTitle")}
            className="download-confirm-modal archive-txt-run-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-confirm-head">
              <div>
                <p className="panel-kicker">archive.txt</p>
                <h2>{t("archiveTxt.runConfirmTitle")}</h2>
                <span>{t("archiveTxt.runConfirmSubtitle")}</span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                disabled={archiveTxtRunStatus === "running"}
                onClick={() => setArchiveTxtRunConfirmOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="download-confirm-grid">
              <article>
                <span>{t("worker.liveConfirm.limit")}</span>
                <strong>{archiveTxtRunLimit}</strong>
              </article>
              <article>
                <span>{t("worker.liveConfirm.skipped")}</span>
                <strong>{archiveTxtPreview?.archived_count ?? 0}</strong>
              </article>
              <article>
                <span>{t("archiveTxt.runCandidates")}</span>
                <strong>{archiveTxtStageResult?.candidates_created ?? 0}</strong>
              </article>
            </div>
            <div className="download-confirm-list">
              {archiveTxtRunJobs.map((job) => (
                <span key={job.id}>
                  <CheckCircle2 size={13} />
                  <strong>{job.video_title}</strong>
                  <em>{jobStatusLabel(job.status, t)}</em>
                </span>
              ))}
              {archiveTxtRunJobs.length === 0
                ? archiveTxtRunJobIds.map((jobId) => (
                    <span key={jobId}>
                      <CheckCircle2 size={13} />
                      <strong>job #{jobId}</strong>
                      <em>{t("archiveTxt.runQueuedAfterConfirm")}</em>
                    </span>
                  ))
                : null}
              {archiveTxtRunJobIds.length === 0 ? <p className="empty-copy">{t("archiveTxt.queuePreparedEmpty")}</p> : null}
            </div>
            {workerPlan?.locked_reason ? (
              <code className="worker-lock">{workerPlan.locked_reason}</code>
            ) : !workerPlan?.enabled ? (
              <code className="worker-lock">{t("archiveTxt.runWorkerDisabled")}</code>
            ) : null}
            <div className="download-confirm-actions">
              <button
                className="command-button"
                disabled={archiveTxtRunStatus === "running"}
                onClick={() => setArchiveTxtRunConfirmOpen(false)}
                type="button"
              >
                {t("worker.liveCancel")}
              </button>
              <button
                className="primary-action"
                disabled={archiveTxtRunBlocked}
                onClick={() => void handleArchiveTxtPrepareAndRun()}
                type="button"
              >
                <Rocket size={16} />
                {archiveTxtRunStatus === "running" ? t("archiveTxt.runRunning") : t("archiveTxt.runStart")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      {liveDownloadConfirmOpen ? (
        <div className="download-confirm-backdrop" onClick={() => setLiveDownloadConfirmOpen(false)} role="presentation">
          <aside
            aria-label={t("worker.liveConfirmTitle")}
            className="download-confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-confirm-head">
              <div>
                <p className="panel-kicker">archive.txt</p>
                <h2>{t("worker.liveConfirmTitle")}</h2>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => setLiveDownloadConfirmOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="download-confirm-grid">
              <article>
                <span>{t("worker.liveConfirm.limit")}</span>
                <strong>{liveRunLimit}</strong>
              </article>
              <article>
                <span>{t("worker.liveConfirm.skipped")}</span>
                <strong>{archiveSkipCount}</strong>
              </article>
              <article>
                <span>{t("worker.liveConfirm.queued")}</span>
                <strong>{simpleFlowStats.queued}</strong>
              </article>
            </div>
            <div className="download-confirm-list">
              {nextDownloadJobs.map((job) => (
                <span key={job.id}>
                  <CheckCircle2 size={13} />
                  {job.video_title}
                </span>
              ))}
              {nextDownloadJobs.length === 0 ? <p className="empty-copy">{t("worker.liveConfirm.empty")}</p> : null}
            </div>
            {workerPlan?.locked_reason ? <code className="worker-lock">{workerPlan.locked_reason}</code> : null}
            <div className="download-confirm-actions">
              <button className="command-button" onClick={() => setLiveDownloadConfirmOpen(false)} type="button">
                {t("worker.liveCancel")}
              </button>
              <button
                className="primary-action"
                disabled={liveDownloadBlocked}
                onClick={() => void handleRunLiveDownloadPass()}
                type="button"
              >
                <Rocket size={16} />
                {liveDownloadStatus === "running" ? t("worker.liveRunning") : t("worker.liveStart")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      {runtimeGuideOpen ? (
        <div className="runtime-guide-backdrop" onClick={() => setRuntimeGuideOpen(false)} role="presentation">
          <aside
            aria-label={t("runtime.guide.title")}
            className="runtime-guide-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="runtime-guide-header">
              <div>
                <p className="panel-kicker">{t("runtime.kicker")}</p>
                <h2>{t("runtime.guide.title")}</h2>
                <span>{t("runtime.guide.subtitle")}</span>
              </div>
              <div className="runtime-guide-header-actions">
                <button className="runtime-copy-button" onClick={() => void handleCopyRuntimeEnv()} type="button">
                  <ClipboardList size={14} />
                  {t("runtime.guide.copy")}
                </button>
                <button
                  aria-label={t("actions.close")}
                  className="icon-button"
                  onClick={() => setRuntimeGuideOpen(false)}
                  title={t("actions.close")}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {runtimeGuideCopyStatus !== "idle" ? (
              <div className={`runtime-copy-status ${runtimeGuideCopyStatus}`}>
                {runtimeGuideCopyStatus === "copied" ? t("runtime.guide.copied") : t("runtime.guide.copyError")}
              </div>
            ) : null}

            <nav className="runtime-guide-rail" aria-label={t("runtime.rail.aria")}>
              {runtimeGuideRailItems.map((item) => {
                const RailIcon = item.icon;
                return (
                  <button className={item.tone} key={item.id} onClick={() => handleRuntimeGuideRailClick(item.selector)} type="button">
                    <RailIcon size={14} />
                    <span>{t(item.labelKey)}</span>
                    <small>{item.detail}</small>
                  </button>
                );
              })}
            </nav>

            <div
              className={`runtime-secure-jump ${securityReadinessReady ? "good" : "warn"}`}
              aria-label={t("runtime.secure.aria")}
            >
              {securityReadinessReady ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              <div>
                <strong>{securityReadinessReady ? t("runtime.secure.protected") : t("runtime.secure.needsToken")}</strong>
                <span>{t("runtime.secure.subtitle")}</span>
              </div>
              <button className="runtime-copy-button" onClick={() => handleJumpToAccessGuard()} type="button">
                <KeyRound size={14} />
                {t("runtime.secure.action")}
              </button>
            </div>

            <div className={`runtime-restart-banner ${runtimeSettings?.pending_restart ? "warn" : "good"}`}>
              {runtimeSettings?.pending_restart ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              <div>
                <strong>{runtimeSettings?.pending_restart ? t("runtime.restart.pending") : t("runtime.restart.clean")}</strong>
                <span>{runtimeSettings?.managed_env_file ?? ".env.runtime"}</span>
              </div>
              {runtimeSettings?.pending_restart ? (
                <div className="runtime-restart-actions">
                  <button className="runtime-copy-button" onClick={() => void handleCopyRestartCommand()} type="button">
                    <ClipboardList size={14} />
                    {runtimeRestartCopyStatus === "copied" ? t("runtime.restart.copied") : t("runtime.restart.copy")}
                  </button>
                </div>
              ) : null}
            </div>
            {runtimeRestartCopyStatus === "error" ? (
              <div className="runtime-copy-status error">{t("runtime.restart.copyError")}</div>
            ) : null}
            <div className={`runtime-adapter-panel ${restartAdapter?.executable ? "good" : "warn"}`}>
              <Server size={16} />
              <div>
                <strong>{restartAdapterLabel}</strong>
                <span>
                  {restartAdapter?.environment ?? t("runtime.checking")} · {restartAdapterDetail}
                </span>
                <code>{restartAdapter?.command ?? runtimeSettings?.restart_command ?? ""}</code>
                {restartAdapter?.setup_hints.length ? (
                  <div className="runtime-adapter-hints">
                    <strong>{t("runtime.restart.setupHints")}</strong>
                    {restartAdapter.setup_hints.map((hint) => (
                      <span key={hint}>{hint}</span>
                    ))}
                  </div>
                ) : null}
                {restartAdapter?.env_lines.length ? (
                  <div className="runtime-adapter-env" aria-label={t("runtime.restart.envLines")}>
                    <strong>{t("runtime.restart.envLines")}</strong>
                    {restartAdapter.env_lines.map((line) => (
                      <code key={line}>{line}</code>
                    ))}
                  </div>
                ) : null}
                <button
                  className="runtime-apply-button runtime-restart-request"
                  disabled={!restartAdapter?.executable || runtimeRestartStatus === "requesting"}
                  onClick={() => void handleRequestRuntimeRestart()}
                  type="button"
                >
                  <RotateCcw size={14} />
                  {runtimeRestartStatus === "requesting" ? t("runtime.restart.requesting") : t("runtime.restart.request")}
                </button>
              </div>
            </div>
            <div
              className={`runtime-compose-smoke ${restartAdapter?.adapter === "docker-compose" ? "good" : "warn"}`}
              aria-label={t("runtime.composeSmoke.title")}
            >
              <div className="runtime-apply-heading">
                <Terminal size={16} />
                <div>
                  <strong>{t("runtime.composeSmoke.title")}</strong>
                  <span>{t("runtime.composeSmoke.subtitle")}</span>
                </div>
                <button className="runtime-copy-button" onClick={() => void handleCopyComposeSmokeCommand()} type="button">
                  <ClipboardList size={14} />
                  {runtimeComposeSmokeCopyStatus === "copied"
                    ? t("runtime.composeSmoke.copied")
                    : runtimeComposeSmokeCopyStatus === "error"
                      ? t("runtime.composeSmoke.copyError")
                      : t("runtime.composeSmoke.copy")}
                </button>
              </div>
              <div className="runtime-compose-smoke-grid">
                <article>
                  <span>{t("runtime.composeSmoke.adapter")}</span>
                  <strong>{restartAdapterLabel}</strong>
                  <small>
                    {restartAdapter?.executable ? t("runtime.composeSmoke.executable") : t("runtime.composeSmoke.copyOnly")}
                  </small>
                </article>
                <article>
                  <span>{t("runtime.composeSmoke.isolation")}</span>
                  <strong>{t("runtime.composeSmoke.isolationValue")}</strong>
                  <small>15174 / 18001</small>
                </article>
                <article>
                  <span>{t("runtime.composeSmoke.cleanup")}</span>
                  <strong>{t("runtime.composeSmoke.cleanupValue")}</strong>
                  <small>CVN_COMPOSE_SMOKE_CLEANUP=true</small>
                </article>
              </div>
              <code>{composeSmokeCommand}</code>
              <div className="runtime-compose-smoke-fast">
                <span>{t("runtime.composeSmoke.fastLabel")}</span>
                <code>{composeSmokeFastCommand}</code>
              </div>
            </div>
            <div className="runtime-token-setup" aria-label={t("runtime.token.aria")} ref={accessGuardRef}>
              <div className="runtime-apply-heading">
                <KeyRound size={16} />
                <div>
                  <strong>{t("runtime.token.title")}</strong>
                  <span>{t("runtime.token.subtitle")}</span>
                </div>
              </div>
              <div className={`runtime-token-state ${securityReadinessReady ? "good" : "warn"}`}>
                {securityReadinessReady ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <strong>
                    {securityReadinessReady ? t("runtime.token.stateProtected") : t("runtime.token.stateNeedsToken")}
                  </strong>
                  <span>
                    {securityReadinessReady
                      ? t("runtime.token.stateProtectedDetail")
                      : t("runtime.token.stateNeedsTokenDetail")}
                  </span>
                </div>
              </div>
              <div className="runtime-token-actions">
                <button className="runtime-apply-button" onClick={() => handleGenerateAccessToken()} type="button">
                  <RotateCcw size={14} />
                  {accessTokenValue ? t("runtime.token.regenerate") : t("runtime.token.generate")}
                </button>
                <label className="runtime-token-rotate">
                  <input
                    checked={accessTokenRotate}
                    onChange={(event) => setAccessTokenRotate(event.target.checked)}
                    type="checkbox"
                  />
                  <span>{t("runtime.token.rotateMode")}</span>
                </label>
              </div>
              {accessTokenValue ? (
                <div className="runtime-token-result">
                  <div className="runtime-token-value">
                    <code>{accessTokenRevealed ? accessTokenValue : maskAccessToken(accessTokenValue)}</code>
                    <button
                      aria-label={accessTokenRevealed ? t("runtime.token.hide") : t("runtime.token.reveal")}
                      className="icon-button"
                      onClick={() => setAccessTokenRevealed((value) => !value)}
                      title={accessTokenRevealed ? t("runtime.token.hide") : t("runtime.token.reveal")}
                      type="button"
                    >
                      {accessTokenRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="runtime-token-copy-row">
                    <button
                      aria-label={t("runtime.token.copyToken")}
                      className="runtime-copy-button"
                      onClick={() => void handleCopyAccessToken("token")}
                      type="button"
                    >
                      <ClipboardList size={14} />
                      {accessTokenCopyStatus?.id === "token"
                        ? accessTokenCopyStatus.status === "copied"
                          ? t("runtime.token.tokenCopied")
                          : t("runtime.token.copyError")
                        : t("runtime.token.copyToken")}
                    </button>
                    <button
                      aria-label={t("runtime.token.copyEnv")}
                      className="runtime-copy-button"
                      onClick={() => void handleCopyAccessToken("env")}
                      type="button"
                    >
                      <ClipboardList size={14} />
                      {accessTokenCopyStatus?.id === "env"
                        ? accessTokenCopyStatus.status === "copied"
                          ? t("runtime.token.copied")
                          : t("runtime.token.copyError")
                        : t("runtime.token.copyEnv")}
                    </button>
                  </div>
                  <code className="runtime-token-env">CVN_AUTH_TOKEN={accessTokenRevealed ? accessTokenValue : maskAccessToken(accessTokenValue)}</code>
                  {accessTokenRotate ? <p className="runtime-token-rotate-note">{t("runtime.token.rotateNote")}</p> : null}
                  <ul className="runtime-token-safety">
                    <li>{t("runtime.token.safetyManager")}</li>
                    <li>{t("runtime.token.safetyRestart")}</li>
                    <li>{t("runtime.token.safetyNoShare")}</li>
                  </ul>
                </div>
              ) : (
                <p className="runtime-token-hint">{t("runtime.token.hint")}</p>
              )}
              <div className="runtime-token-smoke">
                <span>{t("runtime.token.smokeLabel")}</span>
                <code>{ACCESS_TOKEN_SMOKE_COMMAND}</code>
                <button
                  aria-label={t("runtime.token.copySmoke")}
                  className="runtime-copy-button"
                  onClick={() => void handleCopyAccessToken("smoke")}
                  type="button"
                >
                  <ClipboardList size={14} />
                  {accessTokenCopyStatus?.id === "smoke"
                    ? accessTokenCopyStatus.status === "copied"
                      ? t("runtime.token.copied")
                      : t("runtime.token.copyError")
                    : t("runtime.token.copySmoke")}
                </button>
              </div>
            </div>
            <div className="runtime-exposure-cookbook" aria-label={t("runtime.exposure.aria")}>
              <div className="runtime-apply-heading">
                <ShieldCheck size={16} />
                <div>
                  <strong>{t("runtime.exposure.title")}</strong>
                  <span>{t("runtime.exposure.subtitle")}</span>
                </div>
              </div>
              <div className={`runtime-exposure-guard ${securityReadinessReady ? "good" : "warn"}`}>
                {securityReadinessReady ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <strong>{securityReadinessReady ? t("runtime.exposure.guardReady") : t("runtime.exposure.guardWarn")}</strong>
                  <span>{t("runtime.exposure.guardDetail")}</span>
                </div>
                <code>CVN_API_PORT=127.0.0.1:8000</code>
              </div>
              <div className="runtime-exposure-smoke">
                <div className="runtime-exposure-card-head">
                  <div>
                    <strong>{t("runtime.exposure.smokeTitle")}</strong>
                    <span>{t("runtime.exposure.smokeDetail")}</span>
                  </div>
                  <small>{t("runtime.exposure.smokeBadge")}</small>
                </div>
                <code>{DEPLOYMENT_SMOKE_COMMAND}</code>
                <div className="runtime-exposure-card-foot">
                  <span>{t("runtime.exposure.smokeCovers")}</span>
                  <button
                    aria-label={t("runtime.exposure.smokeCopy")}
                    className="runtime-copy-button"
                    onClick={() => void handleCopyDeploymentSmokeCommand()}
                    type="button"
                  >
                    <ClipboardList size={14} />
                    {runtimeDeploymentSmokeCopyStatus === "copied"
                      ? t("runtime.exposure.smokeCopied")
                      : runtimeDeploymentSmokeCopyStatus === "error"
                        ? t("runtime.exposure.copyError")
                        : t("runtime.exposure.smokeCopy")}
                  </button>
                </div>
              </div>
              <div className="runtime-exposure-grid">
                {runtimeExposureProxyPresets.map((preset) => {
                  const copyState = runtimeProxyCopyStatus?.id === preset.id ? runtimeProxyCopyStatus.status : "idle";
                  return (
                    <article key={preset.id}>
                      <div className="runtime-exposure-card-head">
                        <div>
                          <strong>{t(preset.labelKey)}</strong>
                          <span>{t(preset.detailKey)}</span>
                        </div>
                        <small>{t(preset.badgeKey)}</small>
                      </div>
                      <code>{preset.snippet}</code>
                      <div className="runtime-exposure-card-foot">
                        <span>
                          {t("runtime.exposure.target")} · {preset.target}
                        </span>
                        <button
                          aria-label={`${t("runtime.exposure.copy")} ${t(preset.labelKey)}`}
                          className="runtime-copy-button"
                          onClick={() => void handleCopyExposureProxyPreset(preset)}
                          type="button"
                        >
                          <ClipboardList size={14} />
                          {copyState === "copied"
                            ? t("runtime.exposure.copied")
                            : copyState === "error"
                              ? t("runtime.exposure.copyError")
                              : t("runtime.exposure.copy")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="runtime-volume-cookbook" aria-label={t("runtime.volume.aria")}>
              <div className="runtime-apply-heading">
                <FolderTree size={16} />
                <div>
                  <strong>{t("runtime.volume.title")}</strong>
                  <span>{t("runtime.volume.subtitle")}</span>
                </div>
                <button className="runtime-copy-button" onClick={() => void handleCopyVolumeMountEnv()} type="button">
                  <ClipboardList size={14} />
                  {runtimeVolumeCopyStatus === "copied"
                    ? t("runtime.volume.copied")
                    : runtimeVolumeCopyStatus === "error"
                      ? t("runtime.volume.copyError")
                      : t("runtime.volume.copy")}
                </button>
              </div>
              <div className={`runtime-volume-doctor ${mountDoctor?.status ?? "checking"}`}>
                <HardDrive size={15} />
                <div>
                  <strong>
                    {t("runtime.volume.doctor")} ·{" "}
                    {mountDoctor ? t(`mountDoctor.status.${mountDoctor.status}` as TranslationKey) : t("runtime.checking")}
                  </strong>
                  <span>{mountDoctor ? mountDoctorIssueDetail : t("runtime.volume.doctorLoading")}</span>
                </div>
              </div>
              <div className="runtime-volume-grid">
                {runtimeVolumePresets.map((preset) => (
                  <article className={preset.tone} key={preset.id}>
                    <div>
                      <strong>{t(preset.labelKey)}</strong>
                      <span>{t(preset.detailKey)}</span>
                    </div>
                    <code>{preset.hostPath}</code>
                    <small>
                      {preset.envKey} → {preset.containerPath}
                    </small>
                  </article>
                ))}
              </div>
              <div className="runtime-volume-command-grid">
                <article>
                  <span>{t("runtime.volume.mkdir")}</span>
                  <code>{runtimeVolumeMkdirCommand}</code>
                </article>
                <article>
                  <span>{t("runtime.volume.env")}</span>
                  <code>{runtimeVolumeEnvManifest}</code>
                </article>
              </div>
            </div>
            <div
              className={`runtime-backup-restore ${runtimeBackupRestoreReady ? "good" : "warn"}`}
              aria-label={t("runtime.backup.aria")}
            >
              <div className="runtime-apply-heading">
                <FileArchive size={16} />
                <div>
                  <strong>{t("runtime.backup.title")}</strong>
                  <span>{t("runtime.backup.subtitle")}</span>
                </div>
              </div>
              <div className={`runtime-backup-state ${runtimeBackupRestoreReady ? "good" : "warn"}`}>
                {runtimeBackupRestoreReady ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <strong>{runtimeBackupRestoreReady ? t("runtime.backup.ready") : t("runtime.backup.warn")}</strong>
                  <span>{runtimeBackupRestoreReady ? t("runtime.backup.readyDetail") : t("runtime.backup.warnDetail")}</span>
                </div>
              </div>
              <div className="runtime-backup-grid">
                {runtimeBackupRestorePaths.map((item) => (
                  <article className={item.tone} key={item.id}>
                    <div>
                      <strong>{t(item.labelKey)}</strong>
                      <span>{t(item.detailKey)}</span>
                    </div>
                    <code>{item.displayPath}</code>
                    <small>{item.path ? mountDoctorPathState(item.path, t) : t("runtime.backup.pathUnknown")}</small>
                  </article>
                ))}
              </div>
              <div className="runtime-backup-command-grid">
                {(
                  [
                    {
                      id: "quiesced" as const,
                      label: t("runtime.backup.quiesced"),
                      detail: t("runtime.backup.quiescedDetail"),
                      button: t("runtime.backup.copyQuiesced"),
                    },
                    {
                      id: "sqlite" as const,
                      label: t("runtime.backup.sqlite"),
                      detail: t("runtime.backup.sqliteDetail"),
                      button: t("runtime.backup.copySqlite"),
                    },
                    {
                      id: "restore" as const,
                      label: t("runtime.backup.restore"),
                      detail: t("runtime.backup.restoreDetail"),
                      button: t("runtime.backup.copyRestore"),
                    },
                  ] satisfies {
                    id: BackupRestoreCommandId;
                    label: string;
                    detail: string;
                    button: string;
                  }[]
                ).map((command) => {
                  const copyState = runtimeBackupCopyStatus?.id === command.id ? runtimeBackupCopyStatus.status : "idle";
                  return (
                    <article key={command.id}>
                      <div>
                        <strong>{command.label}</strong>
                        <span>{command.detail}</span>
                      </div>
                      <code>{runtimeBackupRestoreCommands[command.id]}</code>
                      <button
                        aria-label={command.button}
                        className="runtime-copy-button"
                        onClick={() => void handleCopyBackupRestoreCommand(command.id)}
                        type="button"
                      >
                        <ClipboardList size={14} />
                        {copyState === "copied"
                          ? t("runtime.backup.copied")
                          : copyState === "error"
                            ? t("runtime.backup.copyError")
                            : command.button}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
            {runtimeRestartMessage ? (
              <div className={`runtime-copy-status ${runtimeRestartStatus === "error" ? "error" : "copied"}`}>
                {runtimeRestartMessage}
              </div>
            ) : null}
            <div className="runtime-restart-presets" aria-label={t("runtime.restart.presetsLabel")}>
              <div className="runtime-apply-heading">
                <Terminal size={16} />
                <div>
                  <strong>{t("runtime.restart.presetsTitle")}</strong>
                  <span>{t("runtime.restart.presetsSubtitle")}</span>
                </div>
              </div>
              <div className="runtime-restart-preset-grid">
                {runtimeRestartPresets.map((preset) => {
                  const copyState =
                    runtimeRestartPresetCopyStatus?.id === preset.id ? runtimeRestartPresetCopyStatus.status : "idle";
                  return (
                    <article key={preset.id}>
                      <div>
                        <strong>{t(preset.labelKey)}</strong>
                        <span>{t(preset.detailKey)}</span>
                      </div>
                      <code>{preset.command}</code>
                      <div className="runtime-restart-preset-lines">
                        {preset.lines.map((line) => (
                          <code key={line}>{line}</code>
                        ))}
                      </div>
                      <button
                        aria-label={`${t("runtime.restart.presetsCopy")} ${t(preset.labelKey)}`}
                        className="runtime-copy-button"
                        onClick={() => void handleCopyRestartPreset(preset)}
                        type="button"
                      >
                        <ClipboardList size={14} />
                        {copyState === "copied"
                          ? t("runtime.restart.presetsCopied")
                          : copyState === "error"
                            ? t("runtime.restart.presetsCopyError")
                            : t("runtime.restart.presetsCopy")}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="runtime-restart-ledger">
              <div className="runtime-apply-heading">
                <History size={16} />
                <div>
                  <strong>{t("runtime.restart.ledgerTitle")}</strong>
                  <span>{t("runtime.restart.ledgerSubtitle")}</span>
                </div>
                <button
                  className="runtime-copy-button"
                  disabled={runtimeRestartEventsStatus === "loading"}
                  onClick={() => void loadRuntimeRestartEvents()}
                  type="button"
                >
                  <RotateCcw size={14} />
                  {runtimeRestartEventsStatus === "loading" ? t("events.refreshing") : t("events.refresh")}
                </button>
                <button className="runtime-copy-button" onClick={() => void handleOpenRuntimeRestartEventLog()} type="button">
                  <ExternalLink size={14} />
                  {t("runtime.restart.ledgerOpen")}
                </button>
              </div>
              {runtimeRestartEventsStatus === "error" ? (
                <div className="runtime-copy-status error">{t("runtime.restart.ledgerError")}</div>
              ) : null}
              <div className="runtime-restart-ledger-list">
                {runtimeRestartEvents.map((event, index) => (
                  <article className={`runtime-restart-event ${eventTone(event.type)}`} key={`${event.type}-${event.occurred_at}-${index}`}>
                    <div>
                      <strong>{eventLabel(event, t)}</strong>
                      <span>{runtimeRestartEventDetail(event, t)}</span>
                    </div>
                    <time>{formatEventTime(event.occurred_at)}</time>
                  </article>
                ))}
                {!runtimeRestartEvents.length && runtimeRestartEventsStatus !== "loading" ? (
                  <p className="empty-copy">{t("runtime.restart.ledgerEmpty")}</p>
                ) : null}
              </div>
            </div>

            <div className="runtime-guide-state">
              <article>
                <Clock3 size={16} />
                <span>{t("runtime.scheduler")}</span>
                <strong>{schedulerRuntimeLabel}</strong>
                <small>{schedulerDetailLabel}</small>
                <em>{t("runtime.scheduler.next")} · {schedulerNextTickLabel}</em>
                <em>{t("runtime.scheduler.last")} · {schedulerLastTickLabel}</em>
              </article>
              <article>
                <Activity size={16} />
                <span>{t("runtime.metadataScheduler")}</span>
                <strong>{metadataSchedulerRuntimeLabel}</strong>
                <small>{metadataSchedulerDetailLabel}</small>
                <em>{t("runtime.scheduler.next")} · {metadataSchedulerNextTickLabel}</em>
                <em>{t("runtime.scheduler.last")} · {metadataSchedulerLastTickLabel}</em>
                <em>{metadataSchedulerDueLabel}</em>
                {metadataDueChannels[0] ? (
                  <em>
                    {t("runtime.metadataScheduler.dueChannels")} · {metadataDueChannels[0].handle ?? metadataDueChannels[0].title}
                  </em>
                ) : null}
              </article>
              <article>
                <Rocket size={16} />
                <span>{t("runtime.worker")}</span>
                <strong>{workerRuntimeLabel}</strong>
                <small>{runtimeSettings?.download_worker_enabled ? t("runtime.worker.liveDetail") : t("runtime.worker.lockedDetail")}</small>
              </article>
            </div>

            <div className="runtime-operator-export" aria-label={t("runtime.workerSummary.aria")}>
              <div className="runtime-apply-heading">
                <div>
                  <strong>{t("runtime.workerSummary.title")}</strong>
                  <span>{t("runtime.workerSummary.subtitle")}</span>
                </div>
                <div className="runtime-heading-actions">
                  <button
                    className="runtime-apply-button"
                    onClick={() => handleDownloadWorkerSummary("ndjson", "latest")}
                    type="button"
                  >
                    <Download size={14} />
                    {t("runtime.ticks.exportNdjson")}
                  </button>
                  <button className="runtime-apply-button" onClick={() => handleDownloadWorkerSummary("csv", "latest")} type="button">
                    <Download size={14} />
                    {t("runtime.ticks.exportCsv")}
                  </button>
                </div>
              </div>
              <div className="runtime-export-endpoints">
                <article>
                  <span>{t("runtime.workerSummary.summaryEndpoint")}</span>
                  <code>GET /api/jobs/downloads/worker/summary</code>
                </article>
                <article>
                  <span>{t("runtime.workerSummary.exportEndpoint")}</span>
                  <code>GET /api/jobs/downloads/worker/summary/export?format=ndjson|csv</code>
                </article>
              </div>
            </div>

            <form className="runtime-apply-panel" onSubmit={(event) => void handleApplyRuntimeSettings(event)}>
              <div className="runtime-apply-heading">
                <div>
                  <strong>{t("runtime.apply.title")}</strong>
                  <span>{t("runtime.apply.subtitle")}</span>
                </div>
                <button className="runtime-apply-button" disabled={runtimeApplyStatus === "applying" || !runtimeDraftValid} type="submit">
                  <Settings size={14} />
                  {runtimeApplyStatus === "applying" ? t("runtime.apply.saving") : t("runtime.apply.save")}
                </button>
              </div>
              <div className="runtime-switch-grid">
                <label className="runtime-switch-row">
                  <span>{t("runtime.apply.worker")}</span>
                  <input
                    checked={runtimeDraft.downloadWorkerEnabled}
                    onChange={(event) => setRuntimeDraft((draft) => ({ ...draft, downloadWorkerEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                </label>
                <label className="runtime-switch-row">
                  <span>{t("runtime.apply.scheduler")}</span>
                  <input
                    checked={runtimeDraft.schedulerEnabled}
                    onChange={(event) => setRuntimeDraft((draft) => ({ ...draft, schedulerEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                </label>
                <label className="runtime-switch-row">
                  <span>{t("runtime.apply.metadataScheduler")}</span>
                  <input
                    checked={runtimeDraft.metadataSchedulerEnabled}
                    onChange={(event) =>
                      setRuntimeDraft((draft) => ({ ...draft, metadataSchedulerEnabled: event.target.checked }))
                    }
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="runtime-field-grid">
                <label>
                  <span>{t("runtime.apply.interval")}</span>
                  <input
                    min={5}
                    onChange={(event) => setRuntimeDraft((draft) => ({ ...draft, schedulerIntervalSeconds: event.target.value }))}
                    type="number"
                    value={runtimeDraft.schedulerIntervalSeconds}
                  />
                </label>
                <label>
                  <span>{t("runtime.apply.limit")}</span>
                  <input
                    max={20}
                    min={1}
                    onChange={(event) => setRuntimeDraft((draft) => ({ ...draft, schedulerLimit: event.target.value }))}
                    type="number"
                    value={runtimeDraft.schedulerLimit}
                  />
                </label>
                <label>
                  <span>{t("runtime.apply.metadataInterval")}</span>
                  <input
                    min={30}
                    onChange={(event) =>
                      setRuntimeDraft((draft) => ({ ...draft, metadataSchedulerIntervalSeconds: event.target.value }))
                    }
                    type="number"
                    value={runtimeDraft.metadataSchedulerIntervalSeconds}
                  />
                </label>
                <label>
                  <span>{t("runtime.apply.metadataLimit")}</span>
                  <input
                    max={20}
                    min={1}
                    onChange={(event) =>
                      setRuntimeDraft((draft) => ({ ...draft, metadataSchedulerLimit: event.target.value }))
                    }
                    type="number"
                    value={runtimeDraft.metadataSchedulerLimit}
                  />
                </label>
                <label>
                  <span>{t("runtime.apply.ytdlp")}</span>
                  <input
                    onChange={(event) => setRuntimeDraft((draft) => ({ ...draft, ytdlpBinary: event.target.value }))}
                    value={runtimeDraft.ytdlpBinary}
                  />
                </label>
                <label>
                  <span>{t("runtime.apply.ffprobe")}</span>
                  <input
                    onChange={(event) => setRuntimeDraft((draft) => ({ ...draft, ffprobeBinary: event.target.value }))}
                    value={runtimeDraft.ffprobeBinary}
                  />
                </label>
              </div>
              {runtimePendingOverrides.length ? (
                <div className="runtime-pending-list">
                  {runtimePendingOverrides.map((item) => (
                    <span key={item.key}>{item.key}</span>
                  ))}
                </div>
              ) : null}
              {runtimeApplyMessage ? (
                <div className={`runtime-copy-status ${runtimeApplyStatus === "error" ? "error" : "copied"}`}>
                  {runtimeApplyMessage}
                </div>
              ) : null}
            </form>

            <div className="runtime-env-list">
              {runtimeEnvRows.map((row) => (
                <article className={row.tone} key={row.key}>
                  <div>
                    <strong>{row.key}</strong>
                    <span>{t("runtime.guide.current")} · {row.value}</span>
                  </div>
                  <code>{row.key}={row.recommended}</code>
                </article>
              ))}
            </div>

            <div className="runtime-binary-list">
              {[ytdlpBinary, ffprobeBinary].filter(Boolean).map((binary) => (
                <article className={binary?.available ? "good" : "warn"} key={binary?.name}>
                  <Database size={15} />
                  <div>
                    <strong>{binary?.name}</strong>
                    <span>{binary?.resolved_path ?? binary?.command}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="scheduler-tick-log">
              <div className="runtime-apply-heading">
                <div>
                  <strong>{t("runtime.ticks.title")}</strong>
                  <span>{t("runtime.ticks.subtitle")}</span>
                </div>
                <button className="runtime-apply-button" onClick={() => void handleOpenSchedulerTicks()} type="button">
                  <History size={14} />
                  {t("runtime.ticks.open")}
                </button>
              </div>
              {(runtimeSettings?.scheduler_ticks ?? []).length ? (
                <div className="scheduler-tick-summary">
                  <article>
                    <span>{t("runtime.ticks.completed")}</span>
                    <strong>{schedulerTickSummary.completed}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.ticks.failed")}</span>
                    <strong>{schedulerTickSummary.failed}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.ticks.skipped")}</span>
                    <strong>{schedulerTickSummary.skipped}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.ticks.slow")}</span>
                    <strong>{schedulerTickSummary.slow}</strong>
                  </article>
                </div>
              ) : (
                <p className="empty-copy">{t("runtime.ticks.empty")}</p>
              )}
            </div>

            <div className="scheduler-tick-log metadata-tick-log">
              <div className="runtime-apply-heading">
                <div>
                  <strong>{t("runtime.metadataTicks.title")}</strong>
                  <span>{t("runtime.metadataTicks.subtitle")}</span>
                </div>
                <div className="runtime-heading-actions">
                  {latestMetadataSyncTick ? (
                    <em className={`runtime-mini-badge ${latestMetadataSyncTick.status}`}>
                      {schedulerTickStatusLabel(latestMetadataSyncTick.status, t)}
                    </em>
                  ) : null}
                  <button className="runtime-apply-button" onClick={() => void handleOpenMetadataTicks()} type="button">
                    <History size={14} />
                    {t("runtime.metadataTicks.open")}
                  </button>
                </div>
              </div>
              {(runtimeSettings?.metadata_sync_ticks ?? []).length ? (
                <div className="scheduler-tick-summary metadata-tick-summary">
                  <article>
                    <span>{t("runtime.metadataTicks.due")}</span>
                    <strong>{metadataSyncTickSummary.due}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.metadataTicks.synced")}</span>
                    <strong>{metadataSyncTickSummary.synced}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.metadataTicks.videos")}</span>
                    <strong>{metadataSyncTickSummary.videos}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.metadataTicks.enriched")}</span>
                    <strong>{metadataSyncTickSummary.enriched}</strong>
                  </article>
                  <article>
                    <span>{t("runtime.metadataTicks.candidates")}</span>
                    <strong>{metadataSyncTickSummary.candidates}</strong>
                  </article>
                </div>
              ) : (
                <p className="empty-copy">{t("runtime.metadataTicks.empty")}</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
      {eventLogOpen ? (
        <div className="worker-history-backdrop" onClick={() => setEventLogOpen(false)} role="presentation">
          <aside
            aria-label={t("events.drawerTitle")}
            className="worker-history-drawer event-log-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="worker-history-header">
              <div>
                <p className="panel-kicker">{t("events.title")}</p>
                <h2>{t("events.drawerTitle")}</h2>
                <span>{t("events.drawerSubtitle")}</span>
              </div>
              <div className="runtime-heading-actions">
                <button
                  className="runtime-apply-button"
                  disabled={eventLogStatus === "loading"}
                  onClick={() => void handleRefreshEventLog()}
                  type="button"
                >
                  <RotateCcw size={14} />
                  {eventLogStatus === "loading" ? t("events.refreshing") : t("events.refresh")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!filteredEventLogRows.length}
                  onClick={() => void handleCopyEventLog()}
                  type="button"
                >
                  <ClipboardList size={14} />
                  {eventLogCopyStatus === "copied"
                    ? t("runtime.ticks.copyCopied")
                    : eventLogCopyStatus === "error"
                      ? t("runtime.ticks.copyError")
                      : t("runtime.ticks.copyJson")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!filteredEventLogRows.length}
                  onClick={() => handleDownloadEventLog("ndjson")}
                  type="button"
                >
                  <Download size={14} />
                  {t("events.exportNdjson")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!filteredEventLogRows.length}
                  onClick={() => handleDownloadEventLog("csv")}
                  type="button"
                >
                  <Download size={14} />
                  {t("events.exportCsv")}
                </button>
                <label className="retention-keep-control">
                  <span>{t("runtime.retention.keepLatest")}</span>
                  <input
                    min={1}
                    onChange={(event) => setEventLogRetentionKeep(event.target.value)}
                    type="number"
                    value={eventLogRetentionKeep}
                  />
                </label>
                <div className="retention-preset-strip" aria-label={t("runtime.retention.presets")}>
                  {retentionPresetValues.map((value) => (
                    <button
                      className={eventLogRetentionKeep === String(value) ? "active" : ""}
                      key={value}
                      onClick={() => setEventLogRetentionKeep(String(value))}
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <button
                  className="runtime-apply-button danger"
                  disabled={eventLogRetentionStatus === "pruning"}
                  onClick={() => void handlePruneEventLog()}
                  type="button"
                >
                  <Trash2 size={14} />
                  {eventLogRetentionStatus === "pruning"
                    ? t("events.retentionPruning")
                    : eventLogRetentionStatus === "pruned"
                      ? t("events.retentionPruned")
                      : t("events.retention")}
                </button>
                <button
                  aria-label={t("actions.close")}
                  className="icon-button"
                  onClick={() => setEventLogOpen(false)}
                  title={t("actions.close")}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="worker-history-filters event-log-filters">
              <ListFilter size={14} />
              {archiveEventFilters.map((filter) => (
                <button
                  className={eventLogFilter === filter.id ? "active" : ""}
                  key={filter.id}
                  onClick={() => setEventLogFilter(filter.id)}
                  type="button"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>

            {eventLogScopeLabel ? (
              <div className="event-log-scope">
                <span>{eventLogScopeLabel}</span>
                <button onClick={() => void handleOpenEventLog()} type="button">
                  {t("events.scopeClear")}
                </button>
              </div>
            ) : null}

            <div className="worker-history-summary event-log-summary">
              <article>
                <span>{t("events.filter.all")}</span>
                <strong>{eventLogSummary.total}</strong>
              </article>
              <article>
                <span>{t("events.filter.download")}</span>
                <strong>{eventLogSummary.download}</strong>
              </article>
              <article>
                <span>{t("events.filter.sync")}</span>
                <strong>{eventLogSummary.sync}</strong>
              </article>
              <article>
                <span>{t("events.filter.storage")}</span>
                <strong>{eventLogSummary.storage}</strong>
              </article>
              <article>
                <span>{t("events.filter.runtime")}</span>
                <strong>{eventLogSummary.runtime}</strong>
              </article>
              <article>
                <span>{t("events.filter.failure")}</span>
                <strong>{eventLogSummary.failure}</strong>
              </article>
            </div>

            {eventLogStatus === "error" ? <div className="runtime-copy-status error">{t("events.loadError")}</div> : null}
            {eventDetail ? (
              <section className="event-detail-panel" aria-label={t("events.detailTitle")}>
                <div className="event-detail-head">
                  <div>
                    <span>{t("events.detailTitle")}</span>
                    <strong>{eventLabel(eventDetail, t)}</strong>
                    <small>
                      {typeof eventDetail.id === "number" ? `#${eventDetail.id} · ` : ""}
                      {eventDetail.type} · {formatEventTime(eventDetail.occurred_at)}
                    </small>
                  </div>
                  <div className="event-detail-actions">
                    <button className="runtime-apply-button" onClick={() => void handleCopyEventDetail()} type="button">
                      <ClipboardList size={14} />
                      {eventDetailCopyStatus === "copied"
                        ? t("events.detailCopied")
                        : eventDetailCopyStatus === "error"
                          ? t("events.detailCopyError")
                          : t("events.detailCopy")}
                    </button>
                    <button
                      className="runtime-apply-button"
                      disabled={typeof eventDetail.id !== "number"}
                      onClick={() => void handleCopyEventDetailCurl()}
                      title={typeof eventDetail.id === "number" ? t("events.detailCurl") : t("events.detailCurlUnavailable")}
                      type="button"
                    >
                      <Terminal size={14} />
                      {typeof eventDetail.id !== "number"
                        ? t("events.detailCurlUnavailable")
                        : eventDetailCurlStatus === "copied"
                          ? t("events.detailCurlCopied")
                          : eventDetailCurlStatus === "error"
                            ? t("events.detailCurlCopyError")
                            : t("events.detailCurl")}
                    </button>
                    <button className="runtime-apply-button" onClick={() => handleDownloadEventDetail("ndjson")} type="button">
                      <Download size={14} />
                      {t("events.exportNdjson")}
                    </button>
                    <button className="runtime-apply-button" onClick={() => handleDownloadEventDetail("csv")} type="button">
                      <Download size={14} />
                      {t("events.exportCsv")}
                    </button>
                    <button
                      aria-label={`${t("events.detailOpen")} ${t("actions.close")}`}
                      className="icon-button"
                      onClick={() => {
                        setEventDetail(null);
                        setEventDetailCopyStatus("idle");
                        setEventDetailCurlStatus("idle");
                      }}
                      title={t("actions.close")}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="event-detail-grid">
                  <article>
                    <span>{t("events.detailEntity")}</span>
                    <strong>{eventEntityLabel(eventDetail, t)}</strong>
                  </article>
                  <article>
                    <span>{t("events.detailTone")}</span>
                    <strong>{eventTone(eventDetail.type)}</strong>
                  </article>
                </div>
                {eventDetailTargetChannelId || eventDetailTargetJobId ? (
                  <div className="event-detail-link-actions" aria-label={t("events.detailLinkedActions")}>
                    {eventDetailTargetChannelId ? (
                      <button className="runtime-inline-action" onClick={() => void handleOpenEventDetailChannelTarget()} type="button">
                        <ExternalLink size={13} />
                        {t("events.detailOpenChannel")}
                      </button>
                    ) : null}
                    {eventDetailTargetJobId ? (
                      <button className="runtime-inline-action" onClick={() => void handleOpenEventDetailQueueTarget()} type="button">
                        <ExternalLink size={13} />
                        {t("events.detailOpenQueue")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <code className="event-log-data event-detail-data">{JSON.stringify(eventDetail.data, null, 2)}</code>
              </section>
            ) : null}
            <div className="event-log-list">
              {filteredEventLogRows.map((event, index) => {
                const isHighlightedEvent = typeof event.id === "number" && eventLogHighlightId === event.id;
                return (
                  <article
                    className={`event-log-card ${eventTone(event.type)} ${isHighlightedEvent ? "target" : ""}`}
                    key={`${event.id ?? event.type}-${event.occurred_at}-${index}`}
                  >
                    <div className="event-log-card-head">
                      <em>{event.type}</em>
                      <span>
                        {typeof event.id === "number" ? <b className="event-log-id">#{event.id}</b> : null}
                        <time>{formatEventTime(event.occurred_at)}</time>
                      </span>
                    </div>
                    <strong>{eventLabel(event, t)}</strong>
                    <small>{eventEntityLabel(event, t)}</small>
                    <button
                      className="event-log-detail-button"
                      onClick={() => {
                        setEventDetail(event);
                        setEventDetailCopyStatus("idle");
                        setEventDetailCurlStatus("idle");
                      }}
                      type="button"
                    >
                      {t("events.detailOpen")}
                    </button>
                    <code className="event-log-data">{eventDataDigest(event)}</code>
                  </article>
                );
              })}
              {filteredEventLogRows.length === 0 ? <p className="empty-copy">{t("events.logEmpty")}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
      {schedulerTickDrawerOpen ? (
        <div className="scheduler-tick-backdrop" onClick={() => setSchedulerTickDrawerOpen(false)} role="presentation">
          <aside
            aria-label={t("runtime.ticks.drawerTitle")}
            className="scheduler-tick-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="worker-history-header">
              <div>
                <p className="panel-kicker">{t("runtime.scheduler")}</p>
                <h2>{t("runtime.ticks.drawerTitle")}</h2>
                <span>{t("runtime.ticks.drawerSubtitle")}</span>
              </div>
              <div className="runtime-heading-actions">
                <button
                  className="runtime-apply-button"
                  disabled={!schedulerTickRows.length}
                  onClick={() => void handleCopyTickRows("scheduler")}
                  type="button"
                >
                  <ClipboardList size={14} />
                  {schedulerTickCopyStatus === "copied"
                    ? t("runtime.ticks.copyCopied")
                    : schedulerTickCopyStatus === "error"
                      ? t("runtime.ticks.copyError")
                      : t("runtime.ticks.copyJson")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!schedulerTickRows.length}
                  onClick={() => handleDownloadTickRows("scheduler", "ndjson")}
                  type="button"
                >
                  <Download size={14} />
                  {t("runtime.ticks.exportNdjson")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!schedulerTickRows.length}
                  onClick={() => handleDownloadTickRows("scheduler", "csv")}
                  type="button"
                >
                  <Download size={14} />
                  {t("runtime.ticks.exportCsv")}
                </button>
                <button
                  className="runtime-apply-button danger"
                  disabled={schedulerTickRetentionStatus === "pruning"}
                  onClick={() => void handlePruneTickRows("scheduler")}
                  type="button"
                >
                  <Trash2 size={14} />
                  {schedulerTickRetentionStatus === "pruning"
                    ? t("runtime.ticks.retentionPruning")
                    : schedulerTickRetentionStatus === "pruned"
                      ? t("runtime.ticks.retentionPruned")
                      : t("runtime.ticks.retention")}
                </button>
                <button
                  aria-label={t("actions.close")}
                  className="icon-button"
                  onClick={() => setSchedulerTickDrawerOpen(false)}
                  title={t("actions.close")}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="scheduler-tick-filters">
              <div className="worker-history-filters">
                <ListFilter size={14} />
                {schedulerTickStatusFilters.map((filter) => (
                  <button
                    className={schedulerTickStatusFilter === filter.id ? "active" : ""}
                    key={filter.id}
                    onClick={() => void handleSchedulerTickStatus(filter.id)}
                    type="button"
                  >
                    {t(filter.labelKey)}
                  </button>
                ))}
                <button
                  className={schedulerDurationFilter === "slow" ? "active" : ""}
                  onClick={() => void handleSchedulerDurationFilter(schedulerDurationFilter === "slow" ? "all" : "slow")}
                  type="button"
                >
                  <TimerReset size={13} />
                  {t("runtime.ticks.slowOnly")}
                </button>
                <button onClick={() => void handleResetSchedulerTickFilters()} type="button">
                  <RotateCcw size={13} />
                  {t("runtime.ticks.resetFilters")}
                </button>
              </div>
              <div className="scheduler-numeric-filters">
                <label>
                  <span>{t("runtime.ticks.intervalFilter")}</span>
                  <input
                    min={5}
                    onChange={(event) => void handleSchedulerNumericFilter("interval", event.target.value)}
                    placeholder={String(runtimeSettings?.download_worker_scheduler_interval_seconds ?? 300)}
                    type="number"
                    value={schedulerIntervalFilter}
                  />
                </label>
                <label>
                  <span>{t("runtime.ticks.limitFilter")}</span>
                  <input
                    min={1}
                    onChange={(event) => void handleSchedulerNumericFilter("limit", event.target.value)}
                    placeholder={String(runtimeSettings?.download_worker_scheduler_limit ?? 1)}
                    type="number"
                    value={schedulerLimitFilter}
                  />
                </label>
                <label>
                  <span>{t("runtime.retention.keepLatest")}</span>
                  <input
                    min={1}
                    onChange={(event) => setSchedulerRetentionKeep(event.target.value)}
                    type="number"
                    value={schedulerRetentionKeep}
                  />
                </label>
                <div className="retention-preset-strip" aria-label={t("runtime.retention.presets")}>
                  {retentionPresetValues.map((value) => (
                    <button
                      className={schedulerRetentionKeep === String(value) ? "active" : ""}
                      key={value}
                      onClick={() => setSchedulerRetentionKeep(String(value))}
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="worker-history-summary scheduler-tick-summary-grid">
              <article>
                <span>{t("runtime.ticks.filter.all")}</span>
                <strong>{schedulerTickRows.length}</strong>
              </article>
              <article>
                <span>{t("runtime.ticks.failed")}</span>
                <strong>{schedulerDrawerSummary.failed}</strong>
              </article>
              <article>
                <span>{t("runtime.ticks.skipped")}</span>
                <strong>{schedulerDrawerSummary.skipped}</strong>
              </article>
              <article>
                <span>{t("runtime.ticks.slow")}</span>
                <strong>{schedulerDrawerSummary.slow}</strong>
              </article>
            </div>

            <div className="scheduler-tick-list expanded">
              {schedulerTickRows.map((tick) => (
                <article className={tick.status} key={tick.id}>
                  <div>
                    <span>
                      {schedulerTickStatusLabel(tick.status, t)} #{tick.id}
                    </span>
                    <strong>
                      {tick.started_count}/{tick.completed_count}/{tick.failed_count}
                    </strong>
                    <small>
                      {formatEventTime(tick.created_at)}
                      {tick.duration_seconds !== null ? ` · ${formatDuration(tick.duration_seconds)}` : ""}
                    </small>
                  </div>
                  <dl>
                    <div>
                      <dt>{t("runtime.ticks.interval")}</dt>
                      <dd>{tick.interval_seconds}s</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.ticks.limit")}</dt>
                      <dd>{tick.limit}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.scheduler.next")}</dt>
                      <dd>{formatDateTimeLabel(tick.next_tick_at, t("runtime.scheduler.none"))}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.worker")}</dt>
                      <dd>{tick.worker_enabled ? t("runtime.enabled") : t("runtime.disabled")}</dd>
                    </div>
                  </dl>
                  {tick.skipped_reason ?? tick.error_message ? <code>{tick.skipped_reason ?? tick.error_message}</code> : null}
                </article>
              ))}
              {schedulerTickRows.length === 0 ? <p className="empty-copy">{t("runtime.ticks.empty")}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
      {metadataTickDrawerOpen ? (
        <div className="scheduler-tick-backdrop" onClick={() => setMetadataTickDrawerOpen(false)} role="presentation">
          <aside
            aria-label={t("runtime.metadataTicks.drawerTitle")}
            className="scheduler-tick-drawer metadata-tick-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="worker-history-header">
              <div>
                <p className="panel-kicker">{t("runtime.metadataScheduler")}</p>
                <h2>{t("runtime.metadataTicks.drawerTitle")}</h2>
                <span>{t("runtime.metadataTicks.drawerSubtitle")}</span>
              </div>
              <div className="runtime-heading-actions">
                <button
                  className="runtime-apply-button"
                  disabled={!metadataTickRows.length}
                  onClick={() => void handleCopyTickRows("metadata")}
                  type="button"
                >
                  <ClipboardList size={14} />
                  {metadataTickCopyStatus === "copied"
                    ? t("runtime.ticks.copyCopied")
                    : metadataTickCopyStatus === "error"
                      ? t("runtime.ticks.copyError")
                      : t("runtime.ticks.copyJson")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!metadataTickRows.length}
                  onClick={() => handleDownloadTickRows("metadata", "ndjson")}
                  type="button"
                >
                  <Download size={14} />
                  {t("runtime.ticks.exportNdjson")}
                </button>
                <button
                  className="runtime-apply-button"
                  disabled={!metadataTickRows.length}
                  onClick={() => handleDownloadTickRows("metadata", "csv")}
                  type="button"
                >
                  <Download size={14} />
                  {t("runtime.ticks.exportCsv")}
                </button>
                <button
                  className="runtime-apply-button danger"
                  disabled={metadataTickRetentionStatus === "pruning"}
                  onClick={() => void handlePruneTickRows("metadata")}
                  type="button"
                >
                  <Trash2 size={14} />
                  {metadataTickRetentionStatus === "pruning"
                    ? t("runtime.ticks.retentionPruning")
                    : metadataTickRetentionStatus === "pruned"
                      ? t("runtime.ticks.retentionPruned")
                      : t("runtime.ticks.retention")}
                </button>
                <button
                  aria-label={t("actions.close")}
                  className="icon-button"
                  onClick={() => setMetadataTickDrawerOpen(false)}
                  title={t("actions.close")}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="scheduler-tick-filters">
              <div className="worker-history-filters">
                <ListFilter size={14} />
                {schedulerTickStatusFilters.map((filter) => (
                  <button
                    className={metadataTickStatusFilter === filter.id ? "active" : ""}
                    key={filter.id}
                    onClick={() => void handleMetadataTickStatus(filter.id)}
                    type="button"
                  >
                    {t(filter.labelKey)}
                  </button>
                ))}
                <button
                  className={metadataDurationFilter === "slow" ? "active" : ""}
                  onClick={() => void handleMetadataDurationFilter(metadataDurationFilter === "slow" ? "all" : "slow")}
                  type="button"
                >
                  <TimerReset size={13} />
                  {t("runtime.ticks.slowOnly")}
                </button>
                <button onClick={() => void handleResetMetadataTickFilters()} type="button">
                  <RotateCcw size={13} />
                  {t("runtime.ticks.resetFilters")}
                </button>
              </div>
              <div className="scheduler-numeric-filters">
                <label>
                  <span>{t("runtime.metadataTicks.intervalFilter")}</span>
                  <input
                    min={30}
                    onChange={(event) => void handleMetadataNumericFilter("interval", event.target.value)}
                    placeholder={String(runtimeSettings?.metadata_sync_scheduler_interval_seconds ?? 900)}
                    type="number"
                    value={metadataIntervalFilter}
                  />
                </label>
                <label>
                  <span>{t("runtime.metadataTicks.limitFilter")}</span>
                  <input
                    min={1}
                    onChange={(event) => void handleMetadataNumericFilter("limit", event.target.value)}
                    placeholder={String(runtimeSettings?.metadata_sync_scheduler_limit ?? 2)}
                    type="number"
                    value={metadataLimitFilter}
                  />
                </label>
                <label>
                  <span>{t("runtime.retention.keepLatest")}</span>
                  <input
                    min={1}
                    onChange={(event) => setMetadataRetentionKeep(event.target.value)}
                    type="number"
                    value={metadataRetentionKeep}
                  />
                </label>
                <div className="retention-preset-strip" aria-label={t("runtime.retention.presets")}>
                  {retentionPresetValues.map((value) => (
                    <button
                      className={metadataRetentionKeep === String(value) ? "active" : ""}
                      key={value}
                      onClick={() => setMetadataRetentionKeep(String(value))}
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="worker-history-summary scheduler-tick-summary-grid metadata-tick-summary-grid">
              <article>
                <span>{t("runtime.ticks.filter.all")}</span>
                <strong>{metadataTickRows.length}</strong>
              </article>
              <article>
                <span>{t("runtime.metadataTicks.synced")}</span>
                <strong>{metadataDrawerSummary.synced}</strong>
              </article>
              <article>
                <span>{t("runtime.metadataTicks.videos")}</span>
                <strong>{metadataDrawerSummary.videos}</strong>
              </article>
              <article>
                <span>{t("runtime.metadataTicks.enriched")}</span>
                <strong>{metadataDrawerSummary.enriched}</strong>
              </article>
              <article>
                <span>{t("runtime.metadataTicks.candidates")}</span>
                <strong>{metadataDrawerSummary.candidates}</strong>
              </article>
            </div>

            <div className="scheduler-tick-list expanded metadata-tick-list">
              {metadataTickRows.map((tick) => (
                <article className={tick.status} key={tick.id}>
                  <div>
                    <span>
                      {schedulerTickStatusLabel(tick.status, t)} #{tick.id}
                    </span>
                    <strong>
                      {tick.synced_count}/{tick.videos_created_count}/{tick.videos_enriched_count}/{tick.candidates_created_count}
                    </strong>
                    <small>
                      {formatEventTime(tick.created_at)}
                      {tick.duration_seconds !== null ? ` · ${formatDuration(tick.duration_seconds)}` : ""}
                    </small>
                  </div>
                  <dl>
                    <div>
                      <dt>{t("runtime.metadataTicks.due")}</dt>
                      <dd>{tick.due_channel_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.synced")}</dt>
                      <dd>{tick.synced_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.ticks.failed")}</dt>
                      <dd>{tick.failed_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.seen")}</dt>
                      <dd>{tick.videos_seen_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.videos")}</dt>
                      <dd>{tick.videos_created_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.enriched")}</dt>
                      <dd>{tick.videos_enriched_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.candidates")}</dt>
                      <dd>{tick.candidates_created_count}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.interval")}</dt>
                      <dd>{tick.interval_seconds}s</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataTicks.limit")}</dt>
                      <dd>{tick.limit}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.scheduler.next")}</dt>
                      <dd>{formatDateTimeLabel(tick.next_tick_at, t("runtime.scheduler.none"))}</dd>
                    </div>
                    <div>
                      <dt>{t("runtime.metadataScheduler")}</dt>
                      <dd>{tick.scheduler_enabled ? t("runtime.enabled") : t("runtime.disabled")}</dd>
                    </div>
                  </dl>
                  {tick.skipped_reason ?? tick.error_message ? <code>{tick.skipped_reason ?? tick.error_message}</code> : null}
                </article>
              ))}
              {metadataTickRows.length === 0 ? <p className="empty-copy">{t("runtime.metadataTicks.empty")}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
      {downloadRunSummaryOpen ? (
        <div className="worker-history-backdrop" onClick={() => setDownloadRunSummaryOpen(false)} role="presentation">
          <aside
            aria-label={t("worker.summary.title")}
            className="worker-history-drawer download-run-summary-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="worker-history-header">
              <div>
                <p className="panel-kicker">download audit</p>
                <h2>{t("worker.summary.title")}</h2>
                <span>{t("worker.summary.subtitle")}</span>
              </div>
              <div className="runtime-heading-actions">
                <button className="runtime-apply-button" onClick={() => void handleCopyDownloadRunSummary()} type="button">
                  <ClipboardList size={14} />
                  {downloadRunSummaryCopyStatus === "copied"
                    ? t("runtime.ticks.copyCopied")
                    : downloadRunSummaryCopyStatus === "error"
                      ? t("runtime.ticks.copyError")
                      : t("runtime.ticks.copyJson")}
                </button>
                <button className="runtime-apply-button" onClick={() => handleDownloadWorkerSummary("ndjson")} type="button">
                  <Download size={14} />
                  {t("runtime.ticks.exportNdjson")}
                </button>
                <button className="runtime-apply-button" onClick={() => handleDownloadWorkerSummary("csv")} type="button">
                  <Download size={14} />
                  {t("runtime.ticks.exportCsv")}
                </button>
                <button aria-label={t("actions.close")} className="icon-button" onClick={() => setDownloadRunSummaryOpen(false)} type="button">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="worker-history-summary download-run-summary-grid">
              <article>
                <span>{t("worker.summary.archiveTxt")}</span>
                <strong>{archiveTxtSummaryJobIds.size}</strong>
              </article>
              <article>
                <span>{t("worker.summary.skipped")}</span>
                <strong>{archiveTxtPreview?.archived_count ?? archiveSkipCount}</strong>
              </article>
              <article>
                <span>{t("worker.summary.completed")}</span>
                <strong>{recentCompletedJobs.length}</strong>
              </article>
              <article>
                <span>{t("worker.summary.files")}</span>
                <strong>{recentArchivedLibraryItems.length}</strong>
              </article>
            </div>
            <div className="download-run-summary-section">
              <div className="section-title">
                <History size={15} />
                <strong>{t("worker.summary.latestRun")}</strong>
              </div>
              {latestWorkerRun ? (
                <>
                  <article className={`worker-history-card ${latestWorkerRun.failed_count ? "failed-run" : latestWorkerRun.status}`}>
                    <div className="worker-history-card-head">
                      <div>
                        <strong>{latestWorkerRun.status}</strong>
                        <small>
                          {latestWorkerRun.dry_run ? t("worker.dryRun") : t("worker.live")} · {formatEventTime(latestWorkerRun.created_at)}
                        </small>
                      </div>
                      <em>{formatDuration(latestWorkerRun.duration_seconds)}</em>
                    </div>
                    <dl>
                      <div>
                        <dt>{t("worker.history.started")}</dt>
                        <dd>{latestWorkerRun.started_count}</dd>
                      </div>
                      <div>
                        <dt>{t("worker.history.completed")}</dt>
                        <dd>{latestWorkerRun.completed_count}</dd>
                      </div>
                      <div>
                        <dt>{t("worker.history.failed")}</dt>
                        <dd>{latestWorkerRun.failed_count}</dd>
                      </div>
                    </dl>
                    {latestWorkerRun.skipped_reason ? <code className="worker-history-reason">{latestWorkerRun.skipped_reason}</code> : null}
                  </article>
                  {latestWorkerJobs.length ? (
                    <div className="download-run-summary-list compact">
                      {latestWorkerJobs.slice(0, 5).map((job) => (
                        <article key={job.id}>
                          <strong>{job.video_title}</strong>
                          <span>job #{job.id} · {job.video_external_id}</span>
                          <em>
                            {latestWorkerFailedJobIds.has(job.id)
                              ? t("worker.summary.failedStatus")
                              : latestWorkerCompletedJobIds.has(job.id)
                                ? t("worker.summary.completedStatus")
                                : jobStatusLabel(job.status, t)}
                          </em>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="empty-copy">{t("worker.summary.noRuns")}</p>
              )}
            </div>
            <div className="download-run-summary-section">
              <div className="section-title">
                <FileArchive size={15} />
                <strong>{t("worker.summary.archiveRows")}</strong>
              </div>
              <div className="download-run-summary-list">
                {archiveTxtSummaryJobs.slice(0, 5).map((job) => (
                  <article key={job.id}>
                    <strong>{job.video_title}</strong>
                    <span>{job.video_external_id}</span>
                    <em>{jobStatusLabel(job.status, t)}</em>
                  </article>
                ))}
                {archiveTxtSummaryJobs.length === 0 ? <p className="empty-copy">{t("worker.summary.noArchiveRows")}</p> : null}
              </div>
            </div>
            <div className="download-run-summary-section">
              <div className="section-title">
                <FileCheck2 size={15} />
                <strong>{t("worker.summary.completedFiles")}</strong>
              </div>
              <div className="download-run-summary-list">
                {recentArchivedLibraryItems.slice(0, 5).map((item) => (
                  <article key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.video_external_id}</span>
                    <em>{item.total_label}</em>
                  </article>
                ))}
                {recentArchivedLibraryItems.length === 0 ? <p className="empty-copy">{t("worker.summary.noFiles")}</p> : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
      {workerHistoryOpen ? (
        <div className="worker-history-backdrop" onClick={() => setWorkerHistoryOpen(false)} role="presentation">
          <aside
            aria-label={t("worker.history.drawerTitle")}
            className="worker-history-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="worker-history-header">
              <div>
                <p className="panel-kicker">{t("worker.history")}</p>
                <h2>{t("worker.history.drawerTitle")}</h2>
                <span>{t("worker.history.drawerSubtitle")}</span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => setWorkerHistoryOpen(false)}
                title={t("actions.close")}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="worker-history-filters">
              <ListFilter size={14} />
              {workerHistoryFilters.map((filter) => (
                <button
                  className={workerHistoryFilter === filter.id ? "active" : ""}
                  key={filter.id}
                  onClick={() => void handleWorkerHistoryFilter(filter.id)}
                  type="button"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>

            <div className="worker-history-summary">
              <article>
                <span>{t("worker.history.filter.all")}</span>
                <strong>{workerHistorySummary.total}</strong>
              </article>
              <article>
                <span>{t("worker.history.filter.failed")}</span>
                <strong>{workerHistorySummary.failed}</strong>
              </article>
              <article>
                <span>{t("worker.history.filter.live")}</span>
                <strong>{workerHistorySummary.live}</strong>
              </article>
              <article>
                <span>{t("worker.history.filter.dryRun")}</span>
                <strong>{workerHistorySummary.dryRun}</strong>
              </article>
            </div>

            <div className="worker-history-list">
              {workerHistoryRuns.map((run) => (
                <article className={`worker-history-card ${run.failed_count ? "failed-run" : run.status}`} key={run.id}>
                  <div className="worker-history-card-head">
                    <div>
                      <strong>{run.status}</strong>
                      <small>
                        {run.channel_title ?? activeTitle} · {run.dry_run ? t("worker.dryRun") : t("worker.live")} · {formatEventTime(run.created_at)}
                      </small>
                    </div>
                    {run.duration_seconds !== null ? <em>{formatDuration(run.duration_seconds)}</em> : null}
                  </div>
                  <dl>
                    <div>
                      <dt>{t("worker.history.started")}</dt>
                      <dd>{run.started_count}</dd>
                    </div>
                    <div>
                      <dt>{t("worker.history.completed")}</dt>
                      <dd>{run.completed_count}</dd>
                    </div>
                    <div>
                      <dt>{t("worker.history.failed")}</dt>
                      <dd>{run.failed_count}</dd>
                    </div>
                  </dl>
                  {run.skipped_reason ? (
                    <code className="worker-history-reason">
                      {t("worker.history.skipped")} · {run.skipped_reason}
                    </code>
                  ) : null}
                </article>
              ))}
              {workerHistoryRuns.length === 0 ? <p className="empty-copy">{t("worker.history.empty")}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
      {selectedLibraryItem ? (
        <div className="library-detail-backdrop" onClick={() => setSelectedLibraryItem(null)} role="presentation">
          <aside
            aria-label={t("library.detail.title")}
            className="library-detail-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="library-detail-header">
              <div>
                <p className="panel-kicker">{t("library.kicker")}</p>
                <h2>{selectedLibraryItem.title}</h2>
                <span>
                  {selectedLibraryItem.channel_title} · {selectedLibraryItem.video_external_id}
                </span>
              </div>
              <button
                aria-label={t("actions.close")}
                className="icon-button"
                onClick={() => setSelectedLibraryItem(null)}
                title={t("actions.close")}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="library-detail-actions">
              <a href={selectedLibraryItem.url} rel="noreferrer" target="_blank">
                <ExternalLink size={14} />
                {t("library.detail.source")}
              </a>
              {selectedLibraryFiles.find((file) => file.exists) ? (
                <a href={apiUrl(selectedLibraryFiles.find((file) => file.exists)?.stream_url ?? "")} rel="noreferrer" target="_blank">
                  <Film size={14} />
                  {t("library.detail.stream")}
                </a>
              ) : null}
            </div>

            <div className="library-detail-summary">
              <article>
                <span>{t("library.detail.files")}</span>
                <strong>{selectedLibraryFiles.length || selectedLibraryItem.media_count}</strong>
              </article>
              <article>
                <span>{t("library.bytes")}</span>
                <strong>{selectedLibraryItem.total_label}</strong>
              </article>
              <article>
                <span>{t("library.detail.fidelity")}</span>
                <strong>{fidelityCount(selectedLibraryItem)}/5</strong>
              </article>
              <article>
                <span>{t("worker.mode")}</span>
                <strong>{libraryStateLabel(selectedLibraryItem, t)}</strong>
              </article>
            </div>

            <div className="library-detail-list">
              {libraryDetailStatus === "loading" ? <p className="empty-copy">{t("library.detail.loading")}</p> : null}
              {libraryDetailStatus === "idle" && selectedLibraryFiles.length === 0 ? (
                <p className="empty-copy">{t("library.detail.empty")}</p>
              ) : null}
              {selectedLibraryFiles.map((file) => (
                <article className={`library-file-card ${file.integrity_state}`} key={file.relative_path}>
                  <div className="library-file-head">
                    <div>
                      <strong>{file.filename}</strong>
                      <span>{file.relative_path}</span>
                    </div>
                    <em>{integrityLabel(file.integrity_state, t)}</em>
                  </div>
                  <div className="library-file-chips">
                    <span>{file.exists ? t("library.detail.mediaPresent") : t("library.detail.mediaMissing")}</span>
                    <span>{file.size_label}</span>
                    {mediaFileProfileLabel(file) ? <span>{mediaFileProfileLabel(file)}</span> : null}
                    {file.duration_seconds !== null ? <span>{formatDuration(file.duration_seconds)}</span> : null}
                  </div>
                  <div className="library-sidecar-grid">
                    {file.sidecars.map((sidecar) => (
                      <span className={sidecar.exists ? "present" : "missing"} key={`${sidecar.kind}-${sidecar.relative_path}`}>
                        {sidecar.exists ? <FileCheck2 size={12} /> : <AlertTriangle size={12} />}
                        {sidecarKindLabel(sidecar.kind, t)}
                      </span>
                    ))}
                    {file.sidecars.length === 0 ? <span className="missing">{t("library.detail.noSidecars")}</span> : null}
                  </div>
                  {file.exists ? (
                    <a className="library-stream-link" href={apiUrl(file.stream_url)} rel="noreferrer" target="_blank">
                      <Film size={14} />
                      {t("library.detail.stream")}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function loadSavedLibraryViews(): SavedLibraryView[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedLibraryViewsStorageKey) ?? "[]") as SavedLibraryView[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((view) => view && typeof view.id === "string" && typeof view.name === "string")
      .slice(0, 10);
  } catch {
    return [];
  }
}

function loadArchiveTxtDraft(): string {
  try {
    return localStorage.getItem(archiveTxtDraftStorageKey) || archiveTxtDefaultDraft;
  } catch {
    return archiveTxtDefaultDraft;
  }
}

function toSavedLibraryView(view: LibrarySavedView): SavedLibraryView {
  return {
    id: String(view.id),
    name: view.name,
    query: view.query,
    integrity: normalizeLibraryIntegrity(view.integrity),
    sidecar: normalizeLibrarySidecar(view.sidecar),
    codec: view.codec,
    createdAt: view.created_at,
    updatedAt: view.updated_at,
  };
}

function normalizeLibraryIntegrity(value: string): LibraryIntegrityFilter {
  if (value === "complete" || value === "partial_sidecars" || value === "missing_media" || value === "media_only") {
    return value;
  }
  return "all";
}

function normalizeLibrarySidecar(value: string): LibrarySidecarFilter {
  if (value === "any" || value === "subtitles" || value === "thumbnail" || value === "nfo") {
    return value;
  }
  return "all";
}

function buildLibraryActiveViewChips(
  query: string,
  integrity: LibraryIntegrityFilter,
  sidecar: LibrarySidecarFilter,
  codec: string,
  t: (key: TranslationKey) => string,
) {
  const chips: { label: string; value: string }[] = [];
  if (query.trim()) chips.push({ label: t("library.active.query"), value: query.trim() });
  if (integrity !== "all") chips.push({ label: t("library.active.integrity"), value: libraryIntegrityFilterLabel(integrity, t) });
  if (sidecar !== "all") chips.push({ label: t("library.active.sidecar"), value: librarySidecarFilterLabel(sidecar, t) });
  if (codec.trim()) chips.push({ label: t("library.active.codec"), value: codec.trim() });
  return chips;
}

function libraryIntegrityFilterLabel(filter: LibraryIntegrityFilter, t: (key: TranslationKey) => string) {
  return t(libraryIntegrityFilters.find((item) => item.id === filter)?.labelKey ?? "library.filter.all");
}

function librarySidecarFilterLabel(filter: LibrarySidecarFilter, t: (key: TranslationKey) => string) {
  return t(librarySidecarFilters.find((item) => item.id === filter)?.labelKey ?? "library.filter.all");
}

function schedulerTickQuery(
  statusFilter: SchedulerTickStatusFilter,
  durationFilter: SchedulerDurationFilter,
  intervalFilter: string,
  limitFilter: string,
): SchedulerTickFilters {
  const filters: SchedulerTickFilters = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (durationFilter === "slow") filters.min_duration_seconds = 10;
  const interval = Number(intervalFilter);
  if (Number.isInteger(interval) && interval >= 5) filters.interval_seconds = interval;
  const workerLimit = Number(limitFilter);
  if (Number.isInteger(workerLimit) && workerLimit >= 1) filters.worker_limit = workerLimit;
  return filters;
}

function metadataTickQuery(
  statusFilter: SchedulerTickStatusFilter,
  durationFilter: SchedulerDurationFilter,
  intervalFilter: string,
  limitFilter: string,
): MetadataSyncTickFilters {
  const filters: MetadataSyncTickFilters = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (durationFilter === "slow") filters.min_duration_seconds = 10;
  const interval = Number(intervalFilter);
  if (Number.isInteger(interval) && interval >= 30) filters.interval_seconds = interval;
  const schedulerLimit = Number(limitFilter);
  if (Number.isInteger(schedulerLimit) && schedulerLimit >= 1) filters.scheduler_limit = schedulerLimit;
  return filters;
}

function summarizeSchedulerTicks(ticks: SchedulerTick[]) {
  return {
    completed: ticks.filter((tick) => tick.status === "completed").length,
    failed: ticks.filter((tick) => tick.status === "failed").length,
    skipped: ticks.filter((tick) => tick.status === "skipped").length,
    slow: ticks.filter((tick) => (tick.duration_seconds ?? 0) >= 10).length,
  };
}

function summarizeMetadataSyncTicks(ticks: MetadataSyncTick[]) {
  return {
    due: ticks.reduce((sum, tick) => sum + tick.due_channel_count, 0),
    synced: ticks.reduce((sum, tick) => sum + tick.synced_count, 0),
    videos: ticks.reduce((sum, tick) => sum + tick.videos_created_count, 0),
    enriched: ticks.reduce((sum, tick) => sum + tick.videos_enriched_count, 0),
    candidates: ticks.reduce((sum, tick) => sum + tick.candidates_created_count, 0),
  };
}

function restartAdapterLabelText(adapter: string, t: (key: TranslationKey) => string) {
  if (adapter === "supervised-hook") return t("runtime.restart.adapter.hook");
  if (adapter === "supervisor") return t("runtime.restart.adapter.supervisor");
  if (adapter === "docker-compose") return t("runtime.restart.adapter.compose");
  if (adapter === "systemd") return t("runtime.restart.adapter.systemd");
  if (adapter === "synology-package") return t("runtime.restart.adapter.synology");
  if (adapter === "qnap-package") return t("runtime.restart.adapter.qnap");
  if (adapter === "local-dev") return t("runtime.restart.adapter.local");
  if (adapter === "disabled") return t("runtime.restart.adapter.disabled");
  return t("runtime.restart.adapter.manual");
}

function restartAdapterPresets(): RestartAdapterPreset[] {
  return [
    {
      id: "docker-compose",
      labelKey: "runtime.restart.adapter.compose",
      detailKey: "runtime.restart.presetsDocker",
      command: "docker compose restart api",
      lines: [
        "CVN_RESTART_ADAPTER=docker-compose",
        "CVN_RESTART_SERVICE_NAME=api",
        "CVN_RESTART_ADAPTER_EXECUTE=true",
      ],
    },
    {
      id: "systemd",
      labelKey: "runtime.restart.adapter.systemd",
      detailKey: "runtime.restart.presetsSystemd",
      command: "systemctl restart channel-vault-nas",
      lines: [
        "CVN_RESTART_ADAPTER=systemd",
        "CVN_RESTART_SERVICE_NAME=channel-vault-nas",
        "CVN_RESTART_ADAPTER_EXECUTE=true",
      ],
    },
    {
      id: "supervisor",
      labelKey: "runtime.restart.adapter.supervisor",
      detailKey: "runtime.restart.presetsSupervisor",
      command: "supervisorctl restart channel-vault-nas",
      lines: [
        "CVN_RESTART_ADAPTER=supervisor",
        "CVN_RESTART_SERVICE_NAME=channel-vault-nas",
        "CVN_RESTART_ADAPTER_EXECUTE=true",
      ],
    },
    {
      id: "synology-package",
      labelKey: "runtime.restart.adapter.synology",
      detailKey: "runtime.restart.presetsSynology",
      command: "synopkg restart ChannelVault",
      lines: [
        "CVN_RESTART_ADAPTER=synology-package",
        "CVN_RESTART_SERVICE_NAME=ChannelVault",
        "CVN_RESTART_ADAPTER_EXECUTE=true",
      ],
    },
    {
      id: "qnap-package",
      labelKey: "runtime.restart.adapter.qnap",
      detailKey: "runtime.restart.presetsQnap",
      command: "/etc/init.d/ChannelVault.sh restart",
      lines: [
        "CVN_RESTART_ADAPTER=qnap-package",
        "CVN_RESTART_SERVICE_NAME=ChannelVault",
        "CVN_RESTART_ADAPTER_EXECUTE=true",
      ],
    },
  ];
}

function volumeMountPresets(): VolumeMountPreset[] {
  return [
    {
      id: "metadata",
      labelKey: "runtime.volume.metadata",
      detailKey: "runtime.volume.metadataDetail",
      envKey: "CVN_METADATA_HOST_DIR",
      hostPath: "/volume1/channel-vault-nas/metadata",
      containerPath: "/app/metadata",
      tone: "good",
    },
    {
      id: "archive",
      labelKey: "runtime.volume.archive",
      detailKey: "runtime.volume.archiveDetail",
      envKey: "CVN_DOWNLOAD_HOST_DIR",
      hostPath: "/volume1/channel-vault-nas/archive",
      containerPath: "/app/downfolder",
      tone: "warn",
    },
    {
      id: "runtime",
      labelKey: "runtime.volume.runtime",
      detailKey: "runtime.volume.runtimeDetail",
      envKey: "CVN_RUNTIME_HOST_DIR",
      hostPath: "/volume1/channel-vault-nas/runtime",
      containerPath: "/app/runtime",
      tone: "idle",
    },
  ];
}

function buildVolumeMountEnvManifest(presets: VolumeMountPreset[]) {
  return presets.map((preset) => `${preset.envKey}=${preset.hostPath}`).join("\n");
}

function buildVolumeMountMkdirCommand(presets: VolumeMountPreset[]) {
  return `mkdir -p ${presets.map((preset) => preset.hostPath).join(" ")}`;
}

function buildBackupRestorePathCards(mountDoctor: MountDoctor | null, runtime: RuntimeSettings | null): BackupRestorePathCard[] {
  const metadata = mountDoctorPath(mountDoctor, "metadata");
  const download = mountDoctorPath(mountDoctor, "download");
  const runtimeEnv = mountDoctorPath(mountDoctor, "runtime");
  return [
    {
      id: "metadata",
      labelKey: "runtime.backup.metadata",
      detailKey: "runtime.backup.metadataDetail",
      path: metadata,
      displayPath: metadata?.resolved ?? runtime?.metadata_dir ?? "/volume1/channel-vault-nas/metadata",
      tone: backupPathTone(metadata, mountDoctor),
    },
    {
      id: "download",
      labelKey: "runtime.backup.archive",
      detailKey: "runtime.backup.archiveDetail",
      path: download,
      displayPath: download?.resolved ?? runtime?.download_dir ?? "/volume1/channel-vault-nas/archive",
      tone: backupPathTone(download, mountDoctor),
    },
    {
      id: "runtime",
      labelKey: "runtime.backup.runtime",
      detailKey: "runtime.backup.runtimeDetail",
      path: runtimeEnv,
      displayPath:
        runtimeEnv?.resolved ??
        (runtime?.managed_env_file && runtime.managed_env_file.startsWith("/")
          ? parentPath(runtime.managed_env_file)
          : "/volume1/channel-vault-nas/runtime"),
      tone: backupPathTone(runtimeEnv, mountDoctor),
    },
  ];
}

function buildBackupRestoreCommands(
  mountDoctor: MountDoctor | null,
  runtime: RuntimeSettings | null,
): Record<BackupRestoreCommandId, string> {
  const metadataDir = backupResolvedPath(mountDoctor, "metadata", runtime?.metadata_dir ?? "/volume1/channel-vault-nas/metadata");
  const archiveDir = backupResolvedPath(mountDoctor, "download", runtime?.download_dir ?? "/volume1/channel-vault-nas/archive");
  const runtimeEnvFile = backupResolvedPath(
    mountDoctor,
    "runtime",
    runtime?.managed_env_file && runtime.managed_env_file.startsWith("/")
      ? runtime.managed_env_file
      : "/volume1/channel-vault-nas/runtime/.env.runtime",
  );
  const runtimeDir = parentPath(runtimeEnvFile);
  const databaseFile = backupResolvedPath(mountDoctor, "database", joinPath(metadataDir, "app.db"));
  return {
    quiesced: [
      "# Stop briefly for a consistent metadata/runtime copy.",
      "docker compose stop",
      `rsync -a --delete ${shellQuote(ensureTrailingSlash(metadataDir))} /backup/cvn/metadata/`,
      `rsync -a ${shellQuote(ensureTrailingSlash(archiveDir))} /backup/cvn/archive/`,
      `rsync -a --delete ${shellQuote(ensureTrailingSlash(runtimeDir))} /backup/cvn/runtime/`,
      "docker compose start",
    ].join("\n"),
    sqlite: [
      "# Hot SQLite snapshot for the operational index.",
      "mkdir -p /backup/cvn/metadata",
      `sqlite3 ${shellQuote(databaseFile)} ".backup '/backup/cvn/metadata/app.db'"`,
    ].join("\n"),
    restore: [
      "# Restore the same three durable roots, then start the app.",
      "docker compose stop",
      "rsync -a --delete /backup/cvn/metadata/ /volume1/channel-vault-nas/metadata/",
      "rsync -a /backup/cvn/archive/ /volume1/channel-vault-nas/archive/",
      "rsync -a --delete /backup/cvn/runtime/ /volume1/channel-vault-nas/runtime/",
      "docker compose start",
      "# If the DB was lost but archive sidecars survived:",
      "curl -X POST http://127.0.0.1:8000/api/library/_rescan/apply",
    ].join("\n"),
  };
}

function mountDoctorPath(mountDoctor: MountDoctor | null, id: MountDoctorPath["id"]) {
  return mountDoctor?.paths.find((path) => path.id === id) ?? null;
}

function backupPathTone(path: MountDoctorPath | null, mountDoctor: MountDoctor | null): BackupRestorePathCard["tone"] {
  if (!path || !mountDoctor) return "warn";
  return mountDoctorPathTone(path, mountDoctor.running_in_container) === "bad" ? "bad" : "good";
}

function backupResolvedPath(mountDoctor: MountDoctor | null, id: MountDoctorPath["id"], fallback: string) {
  return mountDoctorPath(mountDoctor, id)?.resolved ?? fallback;
}

function parentPath(value: string) {
  const normalized = value.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return ".";
  return normalized.slice(0, index);
}

function joinPath(base: string, child: string) {
  return `${base.replace(/\/+$/, "")}/${child}`;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

const ACCESS_TOKEN_SMOKE_COMMAND = [
  "# 1) Without a token, the API rejects the request once CVN_AUTH_TOKEN is set",
  "curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:8000/api/dashboard   # expect 401",
  "# 2) With the operator token exported, the same request succeeds",
  'curl -s -o /dev/null -w \'%{http_code}\\n\' -H "Authorization: Bearer $CVN_AUTH_TOKEN" http://127.0.0.1:8000/api/dashboard   # expect 200',
].join("\n");

const DEPLOYMENT_SMOKE_COMMAND = [
  "CVN_DEPLOYMENT_SMOKE_WEB_URL=https://vault.example.test \\",
  'CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN="$CVN_AUTH_TOKEN" \\',
  "CVN_DEPLOYMENT_SMOKE_FORBIDDEN_API_URL=http://vault.example.test:8000 \\",
  "scripts/deployment-smoke.sh",
].join("\n");

function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function maskAccessToken(token: string): string {
  if (!token) {
    return "";
  }
  if (token.length <= 8) {
    return "•".repeat(token.length);
  }
  return `${token.slice(0, 4)}${"•".repeat(Math.min(24, token.length - 4))}`;
}

function exposureProxyPresets(): ExposureProxyPreset[] {
  return [
    {
      id: "nginx",
      labelKey: "runtime.exposure.nginx",
      detailKey: "runtime.exposure.nginxDetail",
      badgeKey: "runtime.exposure.badgeTls",
      target: "http://127.0.0.1:5173",
      snippet: `server {
  listen 443 ssl http2;
  server_name vault.example.test;

  ssl_certificate /etc/letsencrypt/live/vault.example.test/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/vault.example.test/privkey.pem;

  client_max_body_size 64m;

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}`,
    },
    {
      id: "caddy",
      labelKey: "runtime.exposure.caddy",
      detailKey: "runtime.exposure.caddyDetail",
      badgeKey: "runtime.exposure.badgeSimple",
      target: "http://127.0.0.1:5173",
      snippet: `vault.example.test {
  encode zstd gzip
  reverse_proxy 127.0.0.1:5173
}`,
    },
    {
      id: "cloudflare",
      labelKey: "runtime.exposure.cloudflare",
      detailKey: "runtime.exposure.cloudflareDetail",
      badgeKey: "runtime.exposure.badgeTunnel",
      target: "http://127.0.0.1:5173",
      snippet: `tunnel: channel-vault-nas
credentials-file: /etc/cloudflared/channel-vault-nas.json

ingress:
  - hostname: vault.example.test
    service: http://127.0.0.1:5173
  - service: http_status:404`,
    },
  ];
}

function buildComposeSmokeCommand(fastRepeat: boolean) {
  return [
    "CVN_WEB_PORT=15174",
    "CVN_API_PORT=18001",
    "CVN_COMPOSE_SMOKE_CLEANUP=true",
    fastRepeat ? "CVN_COMPOSE_SMOKE_BUILD=false" : null,
    "scripts/compose-smoke.sh",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildStorageOpenCommand(
  path: string,
  adapter: RuntimeRestartAdapter | null,
  t: (key: TranslationKey) => string,
) {
  if (!path) {
    return {
      label: t("detail.storageLens.commandLocal"),
      note: t("detail.storageLens.noPath"),
      command: "",
    };
  }
  const quotedPath = shellQuote(path);
  if (adapter?.adapter === "docker-compose") {
    const service = adapter.service_name ?? "channel-vault-nas";
    const composeFile = adapter.compose_file ? `-f ${shellQuote(adapter.compose_file)} ` : "";
    const innerCommand = `cd ${quotedPath} && pwd && ls -la`;
    return {
      label: t("detail.storageLens.commandDocker"),
      note: t("detail.storageLens.commandDockerNote"),
      command: `docker compose ${composeFile}exec ${shellQuote(service)} sh -lc ${shellQuote(innerCommand)}`,
    };
  }
  if (adapter?.adapter === "systemd" || adapter?.adapter === "supervisor" || adapter?.adapter === "supervised-hook") {
    return {
      label: t("detail.storageLens.commandService"),
      note: t("detail.storageLens.commandServiceNote"),
      command: `xdg-open ${quotedPath} || gio open ${quotedPath}`,
    };
  }
  return {
    label: t("detail.storageLens.commandLocal"),
    note: t("detail.storageLens.commandLocalNote"),
    command: `open ${quotedPath}`,
  };
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function readAppRouteFromHash() {
  if (typeof window === "undefined") return null;
  return parseAppHash(window.location.hash);
}

function parseAppHash(hash: string): AppRoute | null {
  const trimmed = hash.replace(/^#\/?/, "").trim();
  if (!trimmed) return null;
  const [pathPart, queryPart = ""] = trimmed.split("?");
  const [navPart, tabPart] = pathPart.split("/");
  const nav = navItems.some((item) => item.id === navPart) ? (navPart as NavId) : null;
  if (!nav) return null;

  const params = new URLSearchParams(queryPart);
  const channelParam = Number(params.get("channel") ?? "");
  const channelId = Number.isFinite(channelParam) && channelParam > 0 ? channelParam : undefined;
  const queueJobIds = (params.get("jobs") ?? "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const channelTab =
    nav === "channels" && channelDetailTabs.some((tab) => tab.id === tabPart)
      ? (tabPart as ChannelDetailTab)
      : nav === "channels"
        ? "overview"
        : undefined;

  return {
    nav,
    channelTab,
    channelId,
    queueJobIds: queueJobIds.length ? queueJobIds : undefined,
    runtimeGuide: params.get("runtime") === "guide",
    eventLog: params.get("events") === "open",
  };
}

function buildAppHash(route: AppRoute) {
  const path = route.nav === "channels" ? `channels/${route.channelTab ?? "overview"}` : route.nav;
  const params = new URLSearchParams();
  if (route.channelId) params.set("channel", String(route.channelId));
  if (route.nav === "queue" && route.queueJobIds?.length) params.set("jobs", route.queueJobIds.join(","));
  if (route.runtimeGuide) params.set("runtime", "guide");
  if (route.eventLog) params.set("events", "open");
  const query = params.toString();
  return `#/${path}${query ? `?${query}` : ""}`;
}

function writeAppHash(route: AppRoute, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const hash = buildAppHash(route);
  if (window.location.hash === hash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === "push") {
    window.history.pushState(null, "", nextUrl);
    return;
  }
  window.history.replaceState(null, "", nextUrl);
}

function commandPaletteItemMatches(
  item: CommandPaletteItem,
  query: string,
  t: (key: TranslationKey) => string,
) {
  if (!query) return true;
  const haystack = [t(item.titleKey), t(item.detailKey), t(item.groupKey), ...item.keywords].join(" ").toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function eventStreamStatusLabel(status: EventStreamStatus, t: (key: TranslationKey) => string) {
  if (status === "live") return t("topbar.live.live");
  if (status === "error") return t("topbar.live.error");
  if (status === "closed") return t("topbar.live.closed");
  return t("topbar.live.connecting");
}

function eventStreamStatusDetail(status: EventStreamStatus, t: (key: TranslationKey) => string) {
  if (status === "error") return t("topbar.live.errorDetail");
  if (status === "closed") return t("topbar.live.closedDetail");
  return t("topbar.live.connectingDetail");
}

function buildEventDetailExportUrl(eventId: number, format: AuditExportFormat) {
  const params = new URLSearchParams({
    event_id: String(eventId),
    format,
  });
  return apiUrl(`/api/events/recent/export?${params}`);
}

function buildEventDetailCurlCommand(eventId: number) {
  return [
    "curl",
    "--fail",
    "--location",
    "--silent",
    "--show-error",
    "--output",
    shellQuote(`archive-event-${eventId}.ndjson`),
    shellQuote(buildEventDetailExportUrl(eventId, "ndjson")),
  ].join(" ");
}

function defaultLibraryViewName(
  integrity: LibraryIntegrityFilter,
  sidecar: LibrarySidecarFilter,
  codec: string,
  query: string,
  t: (key: TranslationKey) => string,
) {
  const parts = [query.trim(), codec.trim(), integrity !== "all" ? integrity : "", sidecar !== "all" ? sidecar : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : t("library.saved.defaultName");
}

function getInitials(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "CV";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function buildFolderRows(probe: ChannelProbeResult | null): FolderPreviewItem[] | null {
  if (!probe) return null;
  const channelName = probe.folder_preview.channel_dir.replace(/^channels\//, "");
  const exampleParts = probe.folder_preview.example_video_dir?.split("/") ?? [];
  const year = exampleParts[2] ?? "undated";
  const videoFolder = exampleParts[3] ?? `${year} - ${probe.title}`;
  return [
    { depth: 0, name: "/downfolder", kind: "root" },
    { depth: 1, name: "channels", kind: "channel" },
    { depth: 2, name: channelName, kind: "channel" },
    { depth: 3, name: year, kind: "year" },
    { depth: 4, name: videoFolder, kind: "month" },
    ...probe.folder_preview.sidecars.map((name) => ({
      depth: 5,
      name,
      kind: "file" as const,
    })),
  ];
}

function buildFolderRoot(probe: ChannelProbeResult) {
  const exampleParts = probe.folder_preview.example_video_dir?.split("/") ?? [];
  if (exampleParts.length >= 3) {
    return `/downfolder/${exampleParts.slice(0, 3).join("/")}`;
  }
  return `/downfolder/${probe.folder_preview.channel_dir}`;
}

function buildRegisteredFolderRows(channel: ChannelDetail | null, videos: ChannelVideo[]): FolderPreviewItem[] | null {
  if (!channel) return null;
  const infoPath = firstInfoJsonPath(videos);
  const parts = infoPath?.split("/") ?? [];
  const channelName = parts[1] ?? buildChannelDirectoryName(channel);
  const year = parts[2] ?? channel.latest_video_published_at?.slice(0, 4) ?? "undated";
  const videoFolder = parts[3] ?? `${year} - ${channel.title}`;
  return [
    { depth: 0, name: "/downfolder", kind: "root" },
    { depth: 1, name: "channels", kind: "channel" },
    { depth: 2, name: channelName, kind: "channel" },
    { depth: 3, name: year, kind: "year" },
    { depth: 4, name: videoFolder, kind: "month" },
    { depth: 5, name: "video.mp4", kind: "file" },
    { depth: 5, name: "video.info.json", kind: "file" },
    { depth: 5, name: "thumbnail.jpg", kind: "file" },
    { depth: 5, name: "video.nfo", kind: "file" },
  ];
}

function buildRegisteredFolderRoot(channel: ChannelDetail | null, videos: ChannelVideo[]) {
  if (!channel) return null;
  const infoPath = firstInfoJsonPath(videos);
  const parts = infoPath?.split("/") ?? [];
  if (parts.length >= 3) return `/downfolder/${parts.slice(0, 3).join("/")}`;
  return `/downfolder/channels/${buildChannelDirectoryName(channel)}`;
}

function firstInfoJsonPath(videos: ChannelVideo[]) {
  return videos.find((video) => video.info_json_path)?.info_json_path ?? null;
}

function buildChannelDirectoryName(channel: ChannelDetail) {
  const name = channel.handle ?? channel.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${name} [${channel.external_id ?? channel.id}]`;
}

function buildQueueLanes(jobs: DownloadJob[], syncActive: boolean): QueueLane[] {
  const count = (status: string) => jobs.filter((job) => job.status === status).length;
  const running = count("running");
  const queued = count("queued");
  const failed = count("failed");
  return [
    { labelKey: "queue.sync" as TranslationKey, count: syncActive ? 1 : 0, status: syncActive ? "active" : "waiting" },
    { labelKey: "queue.candidates" as TranslationKey, count: count("candidate"), status: "waiting" },
    { labelKey: "queue.queued" as TranslationKey, count: queued, status: queued > 0 ? "active" : "waiting" },
    { labelKey: "queue.running" as TranslationKey, count: running, status: running > 0 ? "active" : "waiting" },
    { labelKey: "queue.failed" as TranslationKey, count: failed, status: failed > 0 ? "blocked" : "waiting" },
  ];
}

function buildUploadRhythm(videos: TimelineVideo[], fallback: UploadRhythmDay[]): UploadRhythmDay[] {
  const counts = Array.from({ length: 7 }, () => 0);
  for (const video of videos) {
    const raw = video.published_at ?? video.upload_date;
    if (!raw) continue;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) continue;
    const mondayBased = (parsed.getDay() + 6) % 7;
    counts[mondayBased] += 1;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return fallback;
  const max = Math.max(...counts, 1);
  return fallback.map((day, index) => ({
    ...day,
    count: counts[index],
    intensity: counts[index] / max,
  }));
}

function normalizeMetricTone(value: string): MetricTone {
  if (value === "bad") return "bad";
  if (value === "warn") return "warn";
  if (value === "active") return "active";
  if (value === "protected") return "protected";
  if (value === "good") return "good";
  return "info";
}

function storageDriftActionKey(item: StorageDriftItem) {
  return `${item.kind}:${item.relative_path}`;
}

function normalizeRetentionKeep(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(50_000, parsed);
}

function buildStorageReportRows(scan: StorageScan | null): Record<string, unknown>[] {
  if (!scan) return [];
  return [
    {
      section: "volume",
      scanned_at: scan.scanned_at,
      root: scan.volume.root,
      archive_bytes: scan.volume.archive_bytes,
      archive_label: scan.volume.archive_label,
      pressure_percent: scan.volume.pressure_percent,
      file_count: scan.volume.file_count,
      dir_count: scan.volume.dir_count,
      warnings: scan.warnings.length,
    },
    ...scan.channels.map((channel) => ({
      section: "channel",
      relative_path: channel.relative_path,
      title: channel.title,
      bytes: channel.bytes,
      label: channel.label,
      file_count: channel.file_count,
      media_count: channel.media_count,
      sidecar_count: channel.sidecar_count,
      orphan_sidecar_count: channel.orphan_sidecar_count,
      video_folder_count: channel.video_folder_count,
      pressure_score: channel.pressure_score,
    })),
    ...scan.top_extensions.map((extension) => ({
      section: "extension",
      extension: extension.extension,
      bytes: extension.bytes,
      label: extension.label,
      count: extension.count,
    })),
    ...scan.orphan_sidecars.map((sidecar) => ({
      section: "orphan_sidecar",
      relative_path: sidecar.relative_path,
      kind: sidecar.kind,
      size_bytes: sidecar.size_bytes,
      label: sidecar.label,
      reason: sidecar.reason,
    })),
    ...scan.drift.unindexed_media.map((item) => ({
      section: "drift",
      drift_kind: item.kind,
      relative_path: item.relative_path,
      label: item.label,
      reason: item.reason,
    })),
    ...scan.drift.indexed_missing.map((item) => ({
      section: "drift",
      drift_kind: item.kind,
      relative_path: item.relative_path,
      label: item.label,
      reason: item.reason,
    })),
    ...scan.warnings.map((warning) => ({
      section: "warning",
      warning,
    })),
  ];
}

function buildStorageQuarantineRows(quarantine: StorageQuarantineList | null): Record<string, unknown>[] {
  if (!quarantine) return [];
  return quarantine.items.map((item) => ({
    section: "quarantine",
    relative_path: item.relative_path,
    original_relative_path: item.original_relative_path,
    kind: item.kind,
    size_bytes: item.size_bytes,
    label: item.label,
    quarantined_at: item.quarantined_at,
    restore_blocked_reason: item.restore_blocked_reason,
  }));
}

function summarizeStorageQuarantineAge(items: StorageQuarantineItem[], t: (key: TranslationKey) => string) {
  if (!items.length) return t("storage.triage.none");
  const now = Date.now();
  const buckets = items.reduce(
    (summary, item) => {
      if (!item.quarantined_at) {
        summary.unknown += 1;
        return summary;
      }
      const ageDays = Math.max(0, Math.floor((now - new Date(item.quarantined_at).getTime()) / 86_400_000));
      if (ageDays <= 7) summary.fresh += 1;
      else if (ageDays <= 30) summary.warm += 1;
      else summary.old += 1;
      return summary;
    },
    { fresh: 0, warm: 0, old: 0, unknown: 0 },
  );
  return t("storage.quarantine.ageSummary")
    .replace("{fresh}", String(buckets.fresh))
    .replace("{warm}", String(buckets.warm))
    .replace("{old}", String(buckets.old))
    .replace("{unknown}", String(buckets.unknown));
}

function storagePressureWarningLabel(warning: string, t: (key: TranslationKey) => string) {
  if (warning === "no snapshots yet") return t("storage.pressure.warning.none");
  if (warning === "volume pressure is critical") return t("storage.pressure.warning.critical");
  if (warning === "archive runway under 30 days") return t("storage.pressure.warning.runway");
  if (warning === "archive is growing") return t("storage.pressure.warning.growing");
  return warning;
}

function storageChannelPressureWarningLabel(warning: string, t: (key: TranslationKey) => string) {
  if (warning === "new_growth") return t("detail.storageLens.growthNew");
  if (warning === "rapid_growth") return t("detail.storageLens.growthRapid");
  if (warning === "growing") return t("detail.storageLens.growthGrowing");
  return warning;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function operationStageLabel(stage: string, t: (key: TranslationKey) => string) {
  return t(`ops.stage.${stage}` as TranslationKey);
}

function operationMetricLabel(key: string, t: (key: TranslationKey) => string) {
  return t(`ops.metric.${key}` as TranslationKey);
}

function operationMissionTitle(id: string, t: (key: TranslationKey) => string) {
  return t(`ops.mission.${id}.title` as TranslationKey);
}

function operationMissionDetail(mission: OperationMission, t: (key: TranslationKey) => string) {
  return t(`ops.mission.${mission.id}.detail` as TranslationKey)
    .replace("{count}", String(mission.count))
    .replace("{primary}", mission.primary_value || "0")
    .replace("{secondary}", mission.secondary_value || "0");
}

function operationMissionActionLabel(mission: OperationMission, t: (key: TranslationKey) => string) {
  return t(`ops.mission.${mission.id}.action` as TranslationKey);
}

function operationMissionIcon(id: string): typeof ShieldCheck {
  if (id.includes("register")) return Link2;
  if (id.includes("security") || id.includes("token")) return ShieldCheck;
  if (id.includes("drift")) return FileCheck2;
  if (id.includes("sidecar")) return FileArchive;
  if (id.includes("pressure")) return HardDrive;
  if (id.includes("failed")) return AlertTriangle;
  if (id.includes("worker") || id.includes("scheduler") || id.includes("paused")) return ShieldCheck;
  if (id.includes("queue")) return Download;
  return CheckCircle2;
}

function scrollToAppSection(selector: string) {
  window.requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function downloadAuditRows(prefix: string, rows: Record<string, unknown>[], format: AuditExportFormat) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const body = format === "csv" ? rowsToCsv(rows) : rowsToNdjson(rows);
  const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/x-ndjson;charset=utf-8";
  downloadTextFile(`${prefix}-${timestamp}.${format}`, body, mime);
}

function rowsToNdjson(rows: Record<string, unknown>[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  if (!columns.length) return "";
  return [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  triggerDownloadUrl(url, filename);
  URL.revokeObjectURL(url);
}

function triggerDownloadUrl(url: string, filename?: string) {
  const link = document.createElement("a");
  link.href = url;
  if (filename) link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function eventTone(type: string) {
  if (type.includes("failed") || type.includes("cancelled")) return "bad";
  if (
    type.includes("completed") ||
    type.includes("updated") ||
    type.includes("snapshot") ||
    type.includes("recovered") ||
    type.includes("pruned") ||
    type.includes("quarantined") ||
    type.includes("restored") ||
    type.includes("purged")
  ) return "good";
  if (type.includes("queued") || type.includes("started")) return "active";
  return "info";
}

function eventMatchesFilter(event: ArchiveEvent, filter: ArchiveEventFilter) {
  if (filter === "all") return true;
  if (filter === "download") return event.type.startsWith("download.");
  if (filter === "sync") return event.type.startsWith("sync.") || event.type.startsWith("channel.");
  if (filter === "library") return event.type.startsWith("library.");
  if (filter === "storage") return event.type.startsWith("storage.");
  if (filter === "runtime") return event.type.startsWith("runtime.");
  if (filter === "policy") return event.type.startsWith("policy.");
  return event.type.includes("failed") || event.type.includes("cancelled") || typeof event.data.error_message === "string";
}

function summarizeArchiveEvents(events: ArchiveEvent[]) {
  return {
    total: events.length,
    download: events.filter((event) => event.type.startsWith("download.")).length,
    sync: events.filter((event) => event.type.startsWith("sync.") || event.type.startsWith("channel.")).length,
    storage: events.filter((event) => event.type.startsWith("storage.")).length,
    runtime: events.filter((event) => event.type.startsWith("runtime.")).length,
    failure: events.filter((event) => eventMatchesFilter(event, "failure")).length,
  };
}

function eventEntityLabel(event: ArchiveEvent, t: (key: TranslationKey) => string) {
  const parts = [
    readEventNumber(event.data, "channel_id") ? `${t("events.channel")} #${readEventNumber(event.data, "channel_id")}` : "",
    readEventNumber(event.data, "job_id") ? `${t("events.job")} #${readEventNumber(event.data, "job_id")}` : "",
    readEventNumber(event.data, "video_id") ? `${t("events.video")} #${readEventNumber(event.data, "video_id")}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || t("events.noEntity");
}

function eventDataDigest(event: ArchiveEvent) {
  try {
    return JSON.stringify(event.data);
  } catch {
    return "{}";
  }
}

function runtimeRestartEventDetail(event: ArchiveEvent, t: (key: TranslationKey) => string) {
  const adapter = readEventString(event.data, "adapter");
  const reason = readEventString(event.data, "reason");
  const message = readEventString(event.data, "message");
  const exitCode = readEventNumber(event.data, "exit_code");
  const parts = [
    adapter ? `${t("runtime.restart.ledgerAdapter")} ${adapter}` : "",
    reason,
    typeof exitCode === "number" ? `exit ${exitCode}` : "",
    message,
  ].filter(Boolean);
  return parts.join(" · ") || t("runtime.restart.ledgerNoDetail");
}

function eventLabel(event: ArchiveEvent, t: (key: TranslationKey) => string) {
  const title = typeof event.data.channel_title === "string" ? event.data.channel_title : "";
  if (event.type === "sync.started") return `${t("event.sync.started")} ${title}`.trim();
  if (event.type === "sync.completed") {
    const count = typeof event.data.videos_created === "number" ? event.data.videos_created : 0;
    return t("event.sync.completed").replace("{count}", String(count));
  }
  if (event.type === "sync.failed") return `${t("event.sync.failed")} ${title}`.trim();
  if (event.type === "sync.scheduler.completed") {
    const synced = typeof event.data.synced_count === "number" ? event.data.synced_count : 0;
    const candidates = typeof event.data.candidates_created_count === "number" ? event.data.candidates_created_count : 0;
    return t("event.sync.scheduler")
      .replace("{synced}", String(synced))
      .replace("{candidates}", String(candidates));
  }
  if (event.type === "download.candidates") {
    const count = typeof event.data.count === "number" ? event.data.count : 0;
    return t("event.download.candidates").replace("{count}", String(count));
  }
  if (event.type === "download.queued") return t("event.download.queued");
  if (event.type === "download.cancelled") return t("event.download.cancelled");
  if (event.type === "download.stop_requested") return t("event.download.stopRequested");
  if (event.type === "download.started") return t("event.download.started");
  if (event.type === "download.preflight") {
    const count = typeof event.data.job_count === "number" ? event.data.job_count : 0;
    return t("event.download.preflight").replace("{count}", String(count));
  }
  if (event.type === "download.progress") {
    const percent = typeof event.data.percent === "number" ? Math.round(event.data.percent) : 0;
    return t("event.download.progress").replace("{percent}", String(percent));
  }
  if (event.type === "download.bulk") {
    const count = typeof event.data.updated === "number" ? event.data.updated : 0;
    return t("event.download.bulk").replace("{count}", String(count));
  }
  if (event.type === "download.completed") return t("event.download.completed");
  if (event.type === "download.failed") return t("event.download.failed");
  if (event.type === "library.rescan.applied") {
    const count = typeof event.data.media_files_indexed === "number" ? event.data.media_files_indexed : 0;
    return t("event.library.rescan").replace("{count}", String(count));
  }
  if (event.type === "storage.drift.recovered") {
    const count = typeof event.data.media_files_indexed === "number" ? event.data.media_files_indexed : 0;
    return t("event.storage.recovered").replace("{count}", String(count));
  }
  if (event.type === "storage.drift.pruned") {
    const count = typeof event.data.deleted_media_files === "number" ? event.data.deleted_media_files : 0;
    return t("event.storage.pruned").replace("{count}", String(count));
  }
  if (event.type === "storage.orphan.quarantined") return t("event.storage.orphanQuarantined");
  if (event.type === "storage.orphan.restored") return t("event.storage.orphanRestored");
  if (event.type === "storage.orphan.purged") {
    const count = typeof event.data.deleted_files === "number" ? event.data.deleted_files : 0;
    return t("event.storage.orphanPurged").replace("{count}", String(count));
  }
  if (event.type === "storage.pressure.snapshot") return t("event.storage.pressureSnapshot");
  if (event.type === "channel.settings.updated") return t("event.channel.settings");
  if (event.type === "policy.updated") return t("event.policy.updated");
  if (event.type === "runtime.restart.requested") return t("event.runtime.restartRequested");
  if (event.type === "runtime.restart.manual_required") return t("event.runtime.restartManual");
  if (event.type === "runtime.restart.dispatched") return t("event.runtime.restartDispatched");
  if (event.type === "runtime.restart.completed") return t("event.runtime.restartCompleted");
  if (event.type === "runtime.restart.failed") return t("event.runtime.restartFailed");
  return event.type;
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "sync pending";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTimeLabel(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatVideoDate(video: TimelineVideo) {
  if (video.published_at) return formatDateLabel(video.published_at);
  if (video.upload_date && /^\d{4}-\d{2}-\d{2}$/.test(video.upload_date)) return video.upload_date;
  if (video.upload_date && /^\d{8}$/.test(video.upload_date)) {
    return `${video.upload_date.slice(0, 4)}-${video.upload_date.slice(4, 6)}-${video.upload_date.slice(6, 8)}`;
  }
  return "undated";
}

function compactArchivePath(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.slice(-3).join(" / ");
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "duration n/a";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function archiveStateLabel(status: string, t: (key: TranslationKey) => string) {
  return status === "archived" ? t("video.archived") : t("video.missing");
}

function archiveTxtStateLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "archived") return t("archiveTxt.state.archived");
  if (status === "known_missing") return t("archiveTxt.state.knownMissing");
  if (status === "unknown") return t("archiveTxt.state.unknown");
  if (status === "duplicate") return t("archiveTxt.state.duplicate");
  return t("archiveTxt.state.invalid");
}

function libraryStateLabel(item: LibraryItem, t: (key: TranslationKey) => string) {
  if (item.archive_state === "archived") return t("library.state.archived");
  if (item.queue_status === "queued") return t("library.state.queued");
  if (item.queue_status === "candidate") return t("library.state.candidate");
  return t("library.state.missing");
}

function libraryItemMissingSidecar(item: LibraryItem, filter: LibrarySidecarFilter) {
  if (filter === "any") {
    return !item.fidelity.info_json || !item.fidelity.thumbnail || !item.fidelity.subtitles || !item.fidelity.nfo;
  }
  if (filter === "subtitles") return !item.fidelity.subtitles;
  if (filter === "thumbnail") return !item.fidelity.thumbnail;
  if (filter === "nfo") return !item.fidelity.nfo;
  return false;
}

function fidelityCount(item: LibraryItem) {
  return Object.values(item.fidelity).filter(Boolean).length;
}

function jobStatusLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "queued") return t("job.status.queued");
  if (status === "running") return t("job.status.running");
  if (status === "completed") return t("job.status.completed");
  if (status === "failed") return t("job.status.failed");
  if (status === "cancelled") return t("job.status.cancelled");
  return t("job.status.candidate");
}

function downloadTelemetryStatusLabel(status: DownloadTelemetryStatus, t: (key: TranslationKey) => string) {
  if (status === "completed") return t("job.status.completed");
  if (status === "failed") return t("job.status.failed");
  if (status === "cancelled") return t("job.status.cancelled");
  return t("job.status.running");
}

function downloadTelemetrySummary(item: DownloadTelemetry) {
  const parts = [`${Math.round(item.percent)}%`];
  if (item.speed) parts.push(item.speed);
  if (item.eta) parts.push(`ETA ${item.eta}`);
  return parts.join(" · ");
}

function downloadTelemetryStatusFromEvent(type: string): DownloadTelemetryStatus | null {
  if (type === "download.started" || type === "download.progress") return "running";
  if (type === "download.completed") return "completed";
  if (type === "download.failed") return "failed";
  if (type === "download.cancelled" || type === "download.stop_requested") return "cancelled";
  return null;
}

function readEventNumber(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEventNumberList(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

function readEventString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function dedupeDownloadTelemetry(items: DownloadTelemetry[]) {
  const seen = new Set<number>();
  const result: DownloadTelemetry[] = [];
  for (const item of items) {
    if (seen.has(item.jobId)) continue;
    seen.add(item.jobId);
    result.push(item);
  }
  return result.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function autoSyncStatusLabel(channel: ChannelDetail | null, t: (key: TranslationKey) => string) {
  const status = channel?.last_auto_sync_status;
  if (!status) return t("detail.syncOps.autoNoRun");
  if (status === "completed") return t("detail.syncOps.autoCompleted");
  if (status === "failed") return t("detail.syncOps.autoFailed");
  if (status === "running") return t("detail.syncOps.autoRunning");
  return status;
}

function effectivePreflightStatus(job: DownloadJob, statusByJobId: Map<number, string>) {
  return statusByJobId.get(job.id) ?? job.preflight_status;
}

function preflightLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "ready") return t("preflight.status.ready");
  if (status === "review") return t("preflight.status.review");
  return t("preflight.status.unchecked");
}

function queueJobStatusLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "candidate") return t("queue.candidates");
  if (status === "queued") return t("queue.queued");
  if (status === "running") return t("queue.running");
  if (status === "failed") return t("queue.failed");
  if (status === "cancelled") return t("queue.cancelled");
  return status;
}

function launchJobSignals(job: DownloadJob, t: (key: TranslationKey) => string) {
  const signals: { key: string; label: string; tone: string }[] = [];
  if (job.preflight_status === "review") {
    signals.push({ key: "review", label: t("launch.signal.review"), tone: "warn" });
  }
  if (job.status === "failed" || job.status === "cancelled") {
    signals.push({ key: "retry", label: t("launch.signal.retry"), tone: "danger" });
  }
  if (job.status === "running") {
    signals.push({ key: "running", label: t("launch.signal.running"), tone: "info" });
  }
  if (job.quality.toLowerCase() === "best") {
    signals.push({ key: "best", label: t("launch.signal.best"), tone: "warn" });
  }
  if ((job.status === "candidate" || job.status === "queued") && !job.estimated_bytes) {
    signals.push({ key: "nosize", label: t("launch.signal.noSize"), tone: "idle" });
  }
  return signals.slice(0, 3);
}

function isLaunchableJob(job: DownloadJob) {
  return job.status === "candidate" || job.status === "queued";
}

function isSelectableQueueJob(job: DownloadJob) {
  return job.status === "candidate" || job.status === "queued" || job.status === "failed" || job.status === "cancelled";
}

function workerHistoryQuery(filter: WorkerHistoryFilter): DownloadWorkerRunFilters {
  if (filter === "failed") return { failed_only: true };
  if (filter === "dry_run") return { dry_run: true };
  if (filter === "live") return { dry_run: false };
  return {};
}

function schedulerTone(state: string | undefined) {
  if (state === "failed" || state === "locked" || state === "off") return "warn";
  if (state === "waiting" || state === "running") return "good";
  return "idle";
}

function schedulerStateLabel(state: string, t: (key: TranslationKey) => string) {
  if (state === "locked") return t("runtime.scheduler.state.locked");
  if (state === "armed") return t("runtime.scheduler.state.armed");
  if (state === "waiting") return t("runtime.scheduler.state.waiting");
  if (state === "running") return t("runtime.scheduler.state.running");
  if (state === "failed") return t("runtime.scheduler.state.failed");
  return t("runtime.scheduler.state.off");
}

function schedulerStateDetail(status: RuntimeSettings["scheduler_status"], t: (key: TranslationKey) => string) {
  if (status.state === "locked") return t("runtime.scheduler.detail.locked");
  if (status.state === "armed") return t("runtime.scheduler.detail.armed");
  if (status.state === "waiting") return t("runtime.scheduler.detail.waiting");
  if (status.state === "running") return t("runtime.scheduler.detail.running");
  if (status.state === "failed") {
    const prefix = t("runtime.scheduler.detail.failed");
    return status.last_error ? `${prefix}: ${status.last_error}` : prefix;
  }
  return t("runtime.scheduler.detail.off");
}

function metadataSchedulerStateDetail(
  status: RuntimeSettings["metadata_scheduler_status"],
  t: (key: TranslationKey) => string,
) {
  if (status.state === "armed") return t("runtime.metadataScheduler.detail.armed");
  if (status.state === "waiting") return t("runtime.metadataScheduler.detail.waiting");
  if (status.state === "running") return t("runtime.metadataScheduler.detail.running");
  if (status.state === "failed") {
    const prefix = t("runtime.metadataScheduler.detail.failed");
    return status.last_error ? `${prefix}: ${status.last_error}` : prefix;
  }
  return t("runtime.metadataScheduler.detail.off");
}

function defaultRuntimeDraft(): RuntimeDraft {
  return {
    downloadWorkerEnabled: false,
    schedulerEnabled: false,
    schedulerIntervalSeconds: "300",
    schedulerLimit: "1",
    metadataSchedulerEnabled: false,
    metadataSchedulerIntervalSeconds: "900",
    metadataSchedulerLimit: "2",
    ytdlpBinary: "yt-dlp",
    ffprobeBinary: "ffprobe",
  };
}

function runtimeDraftFromSettings(runtime: RuntimeSettings): RuntimeDraft {
  const overrides = new Map(runtime.pending_overrides.map((item) => [item.key, item.value]));
  const binary = (name: string, fallback: string) => runtime.binaries.find((item) => item.name === name)?.command ?? fallback;
  return {
    downloadWorkerEnabled: parseRuntimeBool(overrides.get("CVN_DOWNLOAD_WORKER_ENABLED"), runtime.download_worker_enabled),
    schedulerEnabled: parseRuntimeBool(
      overrides.get("CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED"),
      runtime.download_worker_scheduler_enabled,
    ),
    schedulerIntervalSeconds:
      overrides.get("CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS") ??
      String(runtime.download_worker_scheduler_interval_seconds),
    schedulerLimit:
      overrides.get("CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT") ?? String(runtime.download_worker_scheduler_limit),
    metadataSchedulerEnabled: parseRuntimeBool(
      overrides.get("CVN_METADATA_SYNC_SCHEDULER_ENABLED"),
      runtime.metadata_sync_scheduler_enabled,
    ),
    metadataSchedulerIntervalSeconds:
      overrides.get("CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS") ??
      String(runtime.metadata_sync_scheduler_interval_seconds),
    metadataSchedulerLimit:
      overrides.get("CVN_METADATA_SYNC_SCHEDULER_LIMIT") ?? String(runtime.metadata_sync_scheduler_limit),
    ytdlpBinary: overrides.get("CVN_YTDLP_BINARY") ?? binary("yt-dlp", "yt-dlp"),
    ffprobeBinary: overrides.get("CVN_FFPROBE_BINARY") ?? binary("ffprobe", "ffprobe"),
  };
}

function parseRuntimeBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function schedulerNextTick(status: RuntimeSettings["scheduler_status"], t: (key: TranslationKey) => string, nowMs: number) {
  if (status.running) return t("runtime.scheduler.runningNow");
  if (!status.next_tick_at) return t("runtime.scheduler.none");
  const seconds = Math.max(0, Math.ceil((new Date(status.next_tick_at).getTime() - nowMs) / 1000));
  if (seconds <= 0) return t("runtime.scheduler.due");
  if (seconds < 60) return t("runtime.scheduler.inSeconds").replace("{seconds}", String(seconds));
  return t("runtime.scheduler.inMinutes")
    .replace("{minutes}", String(Math.floor(seconds / 60)))
    .replace("{seconds}", String(seconds % 60));
}

function metadataSchedulerNextTick(
  status: RuntimeSettings["metadata_scheduler_status"],
  t: (key: TranslationKey) => string,
  nowMs: number,
) {
  if (status.running) return t("runtime.scheduler.runningNow");
  if (!status.next_tick_at) return t("runtime.scheduler.none");
  const seconds = Math.max(0, Math.ceil((new Date(status.next_tick_at).getTime() - nowMs) / 1000));
  if (seconds <= 0) return t("runtime.scheduler.due");
  if (seconds < 60) return t("runtime.scheduler.inSeconds").replace("{seconds}", String(seconds));
  return t("runtime.scheduler.inMinutes")
    .replace("{minutes}", String(Math.floor(seconds / 60)))
    .replace("{seconds}", String(seconds % 60));
}

function demoSeedMessage(result: DemoWorkspaceResult, t: (key: TranslationKey) => string) {
  if (!result.created) {
    return t("firstRun.demo.exists").replace("{title}", result.channel_title || "Signal Lab");
  }
  return t("firstRun.demo.done")
    .replace("{title}", result.channel_title)
    .replace("{videos}", String(result.videos_created))
    .replace("{jobs}", String(result.jobs_created));
}

function demoClearMessage(result: DemoWorkspaceClearResult, t: (key: TranslationKey) => string) {
  if (!result.cleared) {
    return t("demo.workspace.clear.missing");
  }
  return t("demo.workspace.clear.done")
    .replace("{title}", result.channel_title || "Signal Lab")
    .replace("{files}", String(result.files_removed))
    .replace("{rows}", String(result.db_rows_removed));
}

function schedulerLastTick(status: RuntimeSettings["scheduler_status"], t: (key: TranslationKey) => string) {
  const timestamp = status.last_completed_at ?? status.last_started_at;
  if (!timestamp) return t("runtime.scheduler.none");
  const result =
    status.last_result_status === "failed"
      ? t("runtime.scheduler.result.failed")
      : status.last_result_status === "completed"
        ? t("runtime.scheduler.result.completed")
        : schedulerStateLabel(status.state, t);
  return `${result} · ${formatEventTime(timestamp)}`;
}

function metadataSchedulerLastTick(
  status: RuntimeSettings["metadata_scheduler_status"],
  t: (key: TranslationKey) => string,
) {
  const timestamp = status.last_completed_at ?? status.last_started_at;
  if (!timestamp) return t("runtime.scheduler.none");
  const result =
    status.last_result_status === "failed"
      ? t("runtime.scheduler.result.failed")
      : status.last_result_status === "completed"
        ? t("runtime.scheduler.result.completed")
        : schedulerStateLabel(status.state, t);
  return `${result} · ${formatEventTime(timestamp)}`;
}

function schedulerTickStatusLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "completed") return t("runtime.ticks.completed");
  if (status === "failed") return t("runtime.ticks.failed");
  if (status === "skipped") return t("runtime.ticks.skipped");
  return t("runtime.ticks.running");
}

function syncJobStatusLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "completed") return t("detail.syncJobs.completed");
  if (status === "failed") return t("detail.syncJobs.failed");
  return t("detail.syncJobs.running");
}

function mediaProfileLabel(item: LibraryItem) {
  const resolution = item.width && item.height ? (item.width >= item.height ? `${item.height}p` : `${item.width}x${item.height}`) : null;
  const codecs = [item.video_codec, item.audio_codec].filter(Boolean).join("/");
  const fps = item.fps ? `${Math.round(item.fps)}fps` : null;
  return [resolution, codecs || item.media_container, fps].filter(Boolean).join(" · ");
}

function mediaFileProfileLabel(file: LibraryFile) {
  const resolution = file.width && file.height ? (file.width >= file.height ? `${file.height}p` : `${file.width}x${file.height}`) : null;
  const codecs = [file.video_codec, file.audio_codec].filter(Boolean).join("/");
  const fps = file.fps ? `${Math.round(file.fps)}fps` : null;
  return [resolution, codecs || file.container, fps].filter(Boolean).join(" · ");
}

function integrityLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "complete") return t("library.integrity.complete");
  if (status === "partial_sidecars") return t("library.integrity.partial");
  if (status === "missing_media") return t("library.integrity.missingMedia");
  return t("library.integrity.mediaOnly");
}

function sidecarKindLabel(kind: string, t: (key: TranslationKey) => string) {
  if (kind === "info_json") return t("library.sidecar.infoJson");
  if (kind === "thumbnail") return t("library.sidecar.thumbnail");
  if (kind === "nfo") return t("library.sidecar.nfo");
  if (kind === "subtitle") return t("library.sidecar.subtitle");
  return kind;
}

function mountDoctorPathLabel(id: MountDoctorPath["id"], t: (key: TranslationKey) => string) {
  return t(`mountDoctor.path.${id}` as TranslationKey);
}

function mountDoctorPathState(path: MountDoctorPath, t: (key: TranslationKey) => string) {
  if (path.error) return t("mountDoctor.path.error");
  if (!path.parent_exists) return t("mountDoctor.path.missing");
  if (!path.parent_writable || !path.writable) return t("mountDoctor.path.readOnly");
  if (path.id !== "database" && path.id !== "runtime" && !path.exists) return t("mountDoctor.path.missing");
  if (path.is_mount) return t("mountDoctor.path.mounted");
  return t("mountDoctor.path.writable");
}

function mountDoctorPathTone(path: MountDoctorPath, runningInContainer: boolean) {
  if (path.error || !path.parent_exists || !path.parent_writable || !path.writable) return "bad";
  if (path.id !== "database" && path.id !== "runtime" && !path.exists) return "bad";
  if (runningInContainer && !path.is_mount) return "warn";
  return "good";
}

function AuthGate({
  authMessage,
  authTokenDraft,
  onClear,
  onSubmit,
  onTokenChange,
  t,
}: {
  authMessage: string;
  authTokenDraft: string;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTokenChange: (value: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <main className="auth-gate-shell" aria-label={t("auth.gate.aria")}>
      <section className="auth-gate-panel">
        <div className="auth-gate-mark">
          <ShieldCheck size={24} />
        </div>
        <p className="panel-kicker">{t("auth.gate.kicker")}</p>
        <h1>{t("auth.gate.title")}</h1>
        <span>{t("auth.gate.subtitle")}</span>
        <form className="auth-gate-form" onSubmit={onSubmit}>
          <label>
            {t("auth.gate.input")}
            <input
              autoComplete="current-password"
              autoFocus
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder={t("auth.gate.placeholder")}
              type="password"
              value={authTokenDraft}
            />
          </label>
          <div className="auth-gate-actions">
            <button className="primary-action" type="submit">
              <ShieldCheck size={15} />
              {t("auth.gate.submit")}
            </button>
            <button className="command-button" onClick={onClear} type="button">
              {t("auth.gate.clear")}
            </button>
          </div>
        </form>
        {authMessage ? <p className="auth-gate-message">{authMessage}</p> : null}
      </section>
    </main>
  );
}

function formatBytes(value: number) {
  if (value >= 1024 ** 4) return `${(value / 1024 ** 4).toFixed(1)} TB`;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${Math.round(value / 1024 ** 2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  if (value > 0) return `${value} B`;
  return "0 MB";
}

function parseDashboardChannelId(value: string) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = value.match(/\d+$/);
  return match ? Number(match[0]) : Number.NaN;
}

export default App;
