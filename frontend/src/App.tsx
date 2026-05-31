import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CirclePause,
  ClipboardList,
  Clock3,
  Database,
  Download,
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
  Languages,
  Link2,
  ListFilter,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Waves,
  X,
  XCircle,
  Zap,
  Square,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  applyLibraryRescan,
  apiUrl,
  bulkUpdateDownloadJobs,
  createDownloadCandidates,
  cancelDownloadJob,
  enqueueVideoDownload,
  getChannel,
  getChannelPolicy,
  getChannelVideos,
  getDashboard,
  getDownloadJobs,
  getDownloadWorkerPlan,
  getDownloadWorkerRuns,
  getLibrary,
  getLibraryFiles,
  getQueuePreflight,
  getRecentEvents,
  getRuntimeSettings,
  probeChannel,
  registerChannel,
  retryDownloadJob,
  runDownloadWorkerOnce,
  stopDownloadJob,
  syncChannel,
  updateChannelPolicy,
  WS_EVENTS_URL,
  type ArchiveEvent,
  type ChannelPolicy,
  type ChannelDetail,
  type ChannelProbeResult,
  type ChannelRegistrationPayload,
  type ChannelRegistrationResult,
  type ChannelVideo,
  type DashboardSnapshot,
  type DownloadJob,
  type DownloadWorkerPlan,
  type DownloadWorkerRunAudit,
  type DownloadWorkerRunFilters,
  type LibraryItem,
  type LibraryFile,
  type LibrarySnapshot,
  type QueuePreflightPlan,
  type RescanApplyResult,
  type RuntimeSettings,
} from "./api/channels";
import { ChannelConstellation } from "./components/ChannelConstellation";
import { MetricTile } from "./components/MetricTile";
import { QueueFlow } from "./components/QueueFlow";
import {
  backupStats,
  fidelityChecks,
  folderPreview,
  importOptions,
  mockActivity,
  mockChannels,
  mockLinks,
  mockMetrics,
  mockQueue,
  uploadRhythm,
  type ArchiveMetric,
  type FolderPreviewItem,
  type MetricTone,
  type QueueLane,
  type UploadRhythmDay,
} from "./data/observatory";
import { languages, useI18n, type Language, type TranslationKey } from "./i18n";

const navItems: { key: TranslationKey; id: string }[] = [
  { key: "nav.dashboard", id: "dashboard" },
  { key: "nav.channels", id: "channels" },
  { key: "nav.library", id: "library" },
  { key: "nav.queue", id: "queue" },
  { key: "nav.insights", id: "insights" },
  { key: "nav.settings", id: "settings" },
];

const qualityOptions = ["720p", "1080p", "best"];
type WorkflowStatus = "idle" | "syncing" | "candidates" | "queueing" | "preflight" | "bulk" | "error";
type WorkerHistoryFilter = "all" | "failed" | "dry_run" | "live";
type LibraryIntegrityFilter = "all" | "complete" | "partial_sidecars" | "missing_media" | "media_only";
type LibrarySidecarFilter = "all" | "any" | "subtitles" | "thumbnail" | "nfo";
type LibraryPresetFilter = "missing_subtitles" | "media_only" | "h264_1080p" | "complete_mp4";
const workerHistoryFilters: { id: WorkerHistoryFilter; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "worker.history.filter.all" },
  { id: "failed", labelKey: "worker.history.filter.failed" },
  { id: "dry_run", labelKey: "worker.history.filter.dryRun" },
  { id: "live", labelKey: "worker.history.filter.live" },
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

function App() {
  const { language, setLanguage, t } = useI18n();
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
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
  const [events, setEvents] = useState<ArchiveEvent[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>("idle");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [preflightPlan, setPreflightPlan] = useState<QueuePreflightPlan | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [queueSearch, setQueueSearch] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [selectionSeedKey, setSelectionSeedKey] = useState("");
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryIntegrityFilter, setLibraryIntegrityFilter] = useState<LibraryIntegrityFilter>("all");
  const [librarySidecarFilter, setLibrarySidecarFilter] = useState<LibrarySidecarFilter>("all");
  const [libraryCodecFilter, setLibraryCodecFilter] = useState("");
  const [activeLibraryPreset, setActiveLibraryPreset] = useState<LibraryPresetFilter | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<LibraryItem | null>(null);
  const [selectedLibraryFiles, setSelectedLibraryFiles] = useState<LibraryFile[]>([]);
  const [libraryDetailStatus, setLibraryDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [rescanResult, setRescanResult] = useState<RescanApplyResult | null>(null);
  const [workerPlan, setWorkerPlan] = useState<DownloadWorkerPlan | null>(null);
  const [workerRuns, setWorkerRuns] = useState<DownloadWorkerRunAudit[]>([]);
  const [workerHistoryRuns, setWorkerHistoryRuns] = useState<DownloadWorkerRunAudit[]>([]);
  const [workerHistoryOpen, setWorkerHistoryOpen] = useState(false);
  const [workerHistoryFilter, setWorkerHistoryFilter] = useState<WorkerHistoryFilter>("all");
  const [runtimeGuideOpen, setRuntimeGuideOpen] = useState(false);
  const [runtimeGuideCopyStatus, setRuntimeGuideCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [runtimeClockNow, setRuntimeClockNow] = useState(() => Date.now());

  const activeProbe = registration?.probe ?? probe;
  const registeredChannelId = registration?.channel.id ?? activeProbe?.existing_channel_id ?? selectedChannelId;
  const activeTitle = channelDetail?.title ?? activeProbe?.title ?? "wingnut987S";
  const activeHandle = channelDetail?.handle ?? activeProbe?.handle ?? "@wingnut987s4";
  const activeExternalId = channelDetail?.external_id ?? activeProbe?.external_id ?? "UCmLADXQtWVuzOnOK5TNrWaw";
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
      return mockChannels.map((channel) =>
        channel.id === "c1"
          ? {
              ...channel,
              title: activeTitle,
              health: registration ? 100 : activeProbe ? 82 : channel.health,
              storageGb: activeProbe ? Math.max(1, Math.round(activeProbe.storage_forecast.estimated_bytes / 1024 ** 3)) : channel.storageGb,
              newVideos: activeProbe?.video_count ?? channel.newVideos,
            }
          : channel,
      );
    },
    [activeProbe, activeTitle, dashboard, registration],
  );
  const activeLinks = useMemo(() => {
    if (!dashboard?.channels.length) return mockLinks;
    const ids = new Set(dashboard.channels.map((channel) => channel.id));
    return dashboard.links
      .filter((link) => ids.has(link.source) && ids.has(link.target))
      .map((link) => ({ source: link.source, target: link.target, weight: link.weight }));
  }, [dashboard]);
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
  const activeQueue = useMemo(
    () => (registeredChannelId ? buildQueueLanes(downloadJobs, workflowStatus === "syncing") : mockQueue),
    [downloadJobs, registeredChannelId, workflowStatus],
  );
  const activeMetrics = useMemo<ArchiveMetric[]>(() => {
    if (!dashboard) return mockMetrics;
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
      activeActivity.length
        ? activeActivity.map((item) => ({
            title: item.title,
            channel: item.channel,
            status: item.status,
            time: item.time,
          }))
        : mockActivity.map((item) => ({
            title: t(item.titleKey),
            channel: item.channel,
            status: item.status,
            time: t(item.timeKey),
          })),
    [activeActivity, t],
  );
  const policySubtitleLabel = channelPolicy?.subtitle_languages.length
    ? channelPolicy.subtitle_languages.join(", ")
    : t("policy.none");
  const workerPolicyLabel = channelPolicy?.worker_paused ? t("policy.worker.paused") : t("policy.worker.live");
  const launchableJobs = useMemo(
    () => downloadJobs.filter((job) => job.status === "candidate" || job.status === "queued"),
    [downloadJobs],
  );
  const runningJobs = useMemo(() => downloadJobs.filter((job) => job.status === "running"), [downloadJobs]);
  const runningWorkerJobs = useMemo(
    () => (workerPlan?.running_jobs.length ? workerPlan.running_jobs.map((item) => item.job) : runningJobs),
    [runningJobs, workerPlan],
  );
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
    if (!query) return launchableJobs;
    return launchableJobs.filter((job) =>
      [job.video_title, job.video_external_id, job.channel_title, job.quality, job.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [launchableJobs, queueSearch]);
  const selectedJobs = useMemo(
    () => launchableJobs.filter((job) => selectedJobIds.includes(job.id)),
    [launchableJobs, selectedJobIds],
  );
  const selectedBytesLabel = useMemo(
    () => formatBytes(selectedJobs.reduce((sum, job) => sum + (job.estimated_bytes ?? 0), 0)),
    [selectedJobs],
  );
  const launchableBytesLabel = useMemo(
    () => formatBytes(launchableJobs.reduce((sum, job) => sum + (job.estimated_bytes ?? 0), 0)),
    [launchableJobs],
  );
  const launchEstimateLabel = selectedJobs.length ? selectedBytesLabel : launchableBytesLabel;
  const allVisibleJobsSelected =
    filteredLaunchJobs.length > 0 && filteredLaunchJobs.every((job) => selectedJobIds.includes(job.id));
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
  const ytdlpBinary = useMemo(
    () => runtimeSettings?.binaries.find((binary) => binary.name === "yt-dlp") ?? null,
    [runtimeSettings],
  );
  const ffprobeBinary = useMemo(
    () => runtimeSettings?.binaries.find((binary) => binary.name === "ffprobe") ?? null,
    [runtimeSettings],
  );
  const schedulerStatus = runtimeSettings?.scheduler_status ?? null;
  const workerRuntimeLabel = !runtimeSettings
    ? t("runtime.checking")
    : runtimeSettings.download_worker_enabled
      ? t("runtime.enabled")
      : t("runtime.disabled");
  const schedulerRuntimeLabel = schedulerStatus ? schedulerStateLabel(schedulerStatus.state, t) : t("runtime.checking");
  const schedulerCadenceLabel = schedulerStatus
    ? t("runtime.interval").replace("{seconds}", String(schedulerStatus.interval_seconds))
    : t("runtime.checking");
  const schedulerLimitLabel = schedulerStatus
    ? t("runtime.limit").replace("{count}", String(schedulerStatus.limit))
    : t("runtime.checking");
  const schedulerDetailLabel = schedulerStatus ? schedulerStateDetail(schedulerStatus, t) : t("runtime.checking");
  const schedulerNextTickLabel = schedulerStatus ? schedulerNextTick(schedulerStatus, t, runtimeClockNow) : t("runtime.checking");
  const schedulerLastTickLabel = schedulerStatus ? schedulerLastTick(schedulerStatus, t) : t("runtime.checking");
  const binaryStateLabel = (binary: RuntimeSettings["binaries"][number] | null) =>
    !binary ? t("runtime.checking") : binary.available ? t("runtime.available") : t("runtime.missing");
  const binaryDetailLabel = (binary: RuntimeSettings["binaries"][number] | null) =>
    binary ? binary.resolved_path ?? binary.command : t("runtime.checking");
  const runtimeEnvRows = useMemo(
    () => [
      {
        key: "CVN_DOWNLOAD_WORKER_ENABLED",
        value: String(runtimeSettings?.download_worker_enabled ?? false),
        recommended: "true",
        tone: runtimeSettings?.download_worker_enabled ? "good" : "warn",
      },
      {
        key: "CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED",
        value: String(runtimeSettings?.download_worker_scheduler_enabled ?? false),
        recommended: "true",
        tone: runtimeSettings?.download_worker_scheduler_enabled ? "good" : "warn",
      },
      {
        key: "CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS",
        value: String(runtimeSettings?.download_worker_scheduler_interval_seconds ?? 300),
        recommended: "300",
        tone: "idle",
      },
      {
        key: "CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT",
        value: String(runtimeSettings?.download_worker_scheduler_limit ?? 1),
        recommended: "1",
        tone: "idle",
      },
      {
        key: "CVN_YTDLP_BINARY",
        value: ytdlpBinary?.command ?? "yt-dlp",
        recommended: "yt-dlp",
        tone: ytdlpBinary?.available ? "good" : "warn",
      },
      {
        key: "CVN_FFPROBE_BINARY",
        value: ffprobeBinary?.command ?? "ffprobe",
        recommended: "ffprobe",
        tone: ffprobeBinary?.available ? "good" : "warn",
      },
    ],
    [ffprobeBinary, runtimeSettings, ytdlpBinary],
  );
  const runtimeEnvManifest = useMemo(
    () => runtimeEnvRows.map((row) => `${row.key}=${row.recommended}`).join("\n"),
    [runtimeEnvRows],
  );

  const registrationPayload: ChannelRegistrationPayload = {
    value: sourceValue,
    max_quality: maxQuality,
    audio_only: audioOnly,
    subtitles_enabled: subtitlesEnabled,
    auto_download: false,
    backfill_mode: "all",
  };

  useEffect(() => {
    if (!runtimeGuideOpen && !schedulerStatus?.next_tick_at) return;
    const timer = window.setInterval(() => setRuntimeClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runtimeGuideOpen, schedulerStatus?.next_tick_at]);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        const [snapshot, recentEvents, runtimeSnapshot] = await Promise.all([
          getDashboard(),
          getRecentEvents(),
          getRuntimeSettings(),
        ]);
        if (cancelled) return;
        setDashboard(snapshot);
        setEvents(recentEvents);
        setRuntimeSettings(runtimeSnapshot);
      } catch {
        if (cancelled) return;
        setDashboard(null);
      }
    }
    loadDashboard();

    const socket = new WebSocket(WS_EVENTS_URL);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as ArchiveEvent;
        setEvents((current) => [event, ...current.filter((item) => item.occurred_at !== event.occurred_at)].slice(0, 8));
        getDashboard().then(setDashboard).catch(() => undefined);
      } catch {
        // Ignore malformed development events.
      }
    };

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

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
      setDownloadJobs([]);
      setPreflightPlan(null);
      setSelectedJobIds([]);
      setSelectionSeedKey("");
      setLibrary(null);
      setWorkerPlan(null);
      setWorkerRuns([]);
      return;
    }

    const channelId = registeredChannelId;
    let cancelled = false;
    async function load() {
      try {
        const [detail, policy, videos, jobs, librarySnapshot, workerSnapshot, workerRunSnapshot] = await Promise.all([
          getChannel(channelId),
          getChannelPolicy(channelId),
          getChannelVideos(channelId),
          getDownloadJobs(channelId),
          getLibrary(channelId),
          getDownloadWorkerPlan(channelId),
          getDownloadWorkerRuns(channelId),
        ]);
        if (cancelled) return;
        setChannelDetail(detail);
        setChannelPolicy(policy);
        setChannelVideos(videos);
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

  async function handleBulkQueueAction(action: "queue" | "cancel" | "prioritize", priority?: number) {
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
            : "queue.bulk.prioritized";
      setWorkflowMessage(t(messageKey as TranslationKey).replace("{count}", String(result.updated)));
    } catch (error) {
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
      const [snapshot, recentEvents] = await Promise.all([getDashboard(), getRecentEvents()]);
      setDashboard(snapshot);
      setEvents(recentEvents);
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

  async function handleCopyRuntimeEnv() {
    const copyWithField = () => {
      const field = document.createElement("textarea");
      field.value = runtimeEnvManifest;
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

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(runtimeEnvManifest);
        } catch {
          copyWithField();
        }
      } else {
        copyWithField();
      }
      setRuntimeGuideCopyStatus("copied");
      window.setTimeout(() => setRuntimeGuideCopyStatus("idle"), 1800);
    } catch {
      setRuntimeGuideCopyStatus("error");
      window.setTimeout(() => setRuntimeGuideCopyStatus("idle"), 2200);
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
    setLibraryIntegrityFilter(preset.integrity);
    setLibrarySidecarFilter(preset.sidecar);
    setLibraryCodecFilter(preset.codec);
  }

  function handleLibraryIntegrityFilter(filter: LibraryIntegrityFilter) {
    setActiveLibraryPreset(null);
    setLibraryIntegrityFilter(filter);
  }

  function handleLibrarySidecarFilter(filter: LibrarySidecarFilter) {
    setActiveLibraryPreset(null);
    setLibrarySidecarFilter(filter);
  }

  function handleToggleJobSelection(jobId: number) {
    setSelectedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId],
    );
  }

  function handleSelectVisibleJobs() {
    if (allVisibleJobsSelected) {
      const visibleIds = new Set(filteredLaunchJobs.map((job) => job.id));
      setSelectedJobIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }
    setSelectedJobIds((current) => Array.from(new Set([...current, ...filteredLaunchJobs.map((job) => job.id)])));
  }

  function applyDownloadJobs(jobs: DownloadJob[]) {
    setDownloadJobs(jobs);
    const activeIds = new Set(jobs.filter(isLaunchableJob).map((job) => job.id));
    setSelectedJobIds((current) => current.filter((id) => activeIds.has(id)));
  }

  async function loadChannelState(channelId: number) {
    const [detail, policy, videos, jobs, snapshot, librarySnapshot, workerSnapshot, workerRunSnapshot] = await Promise.all([
      getChannel(channelId),
      getChannelPolicy(channelId),
      getChannelVideos(channelId),
      getDownloadJobs(channelId),
      getDashboard(),
      getLibrary(channelId),
      getDownloadWorkerPlan(channelId),
      getDownloadWorkerRuns(channelId),
    ]);
    setChannelDetail(detail);
    setChannelPolicy(policy);
    setChannelVideos(videos);
    applyDownloadJobs(jobs);
    setSelectedJobIds(jobs.filter(isLaunchableJob).map((job) => job.id));
    setPreflightPlan(null);
    setDashboard(snapshot);
    setLibrary(librarySnapshot);
    setWorkerPlan(workerSnapshot);
    setWorkerRuns(workerRunSnapshot);
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
          {navItems.map((item) => (
            <button className={item.id === "dashboard" ? "nav-item active" : "nav-item"} key={item.id}>
              {t(item.key)}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="status-dot" />
          <div>
            <strong>{t("sidebar.status.title")}</strong>
            <span>{t("sidebar.status.detail")}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("topbar.eyebrow")}</p>
            <h1>{t("topbar.title")}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" title={t("actions.search")} aria-label={t("actions.search")}>
              <Search size={18} />
            </button>
            <button className="icon-button" title={t("actions.refresh")} aria-label={t("actions.refresh")}>
              <RotateCcw size={18} />
            </button>
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
            <button className="command-button">
              <Settings size={16} />
              {t("actions.policies")}
            </button>
          </div>
        </header>

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
        </section>

        <section className="runtime-console" aria-label={t("runtime.title")}>
          <div className="runtime-header">
            <div>
              <p className="panel-kicker">{t("runtime.kicker")}</p>
              <h2>{t("runtime.title")}</h2>
            </div>
            <div className="runtime-actions">
              <button
                className="runtime-guide-button"
                onClick={() => {
                  setRuntimeGuideCopyStatus("idle");
                  setRuntimeGuideOpen(true);
                }}
                type="button"
              >
                <FileText size={14} />
                {t("runtime.guide.open")}
              </button>
              <span className={`runtime-heartbeat ${runtimeSettings ? "good" : "warn"}`}>
                <span />
                {runtimeSettings ? t("runtime.snapshot") : t("runtime.checking")}
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

        {registeredChannelId ? (
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
                <div className="job-list">
                  {downloadJobs.slice(0, 4).map((job) => (
                    <article className={`job-row ${job.status}`} key={job.id}>
                      <span />
                      <div className="job-main">
                        <strong>{job.video_title}</strong>
                        <small>{job.video_external_id} · {job.quality}</small>
                        {job.status === "running" || job.progress > 0 ? (
                          <div aria-label={t("job.progress")} className="job-progress">
                            <span style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }} />
                          </div>
                        ) : null}
                      </div>
                      <div className="job-actions">
                        <em>{jobStatusLabel(job.status, t)}</em>
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
                  ))}
                  {downloadJobs.length === 0 ? <p className="empty-copy">{t("queue.empty")}</p> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {registeredChannelId ? (
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
                  disabled={filteredLaunchJobs.length === 0}
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

            <div className="launch-board">
              <div className="launch-job-stack">
                {filteredLaunchJobs.slice(0, 8).map((job) => {
                  const selected = selectedJobIds.includes(job.id);
                  return (
                    <article className={`launch-job ${job.status} ${selected ? "selected" : ""}`} key={job.id}>
                      <button
                        aria-label={selected ? t("launch.deselectJob") : t("launch.selectJob")}
                        className="select-job"
                        onClick={() => handleToggleJobSelection(job.id)}
                        type="button"
                      >
                        {selected ? <CheckCircle2 size={16} /> : <Square size={16} />}
                      </button>
                      <div className="launch-job-main">
                        <strong>{job.video_title}</strong>
                        <span>{job.video_external_id} · {job.quality} · P{job.priority}</span>
                        {job.archive_path ? <small>{compactArchivePath(job.archive_path)}</small> : null}
                      </div>
                      <div className="launch-job-meta">
                        <em className={`preflight-pill ${job.preflight_status}`}>{preflightLabel(job.preflight_status, t)}</em>
                        <small>{formatBytes(job.estimated_bytes ?? 0)}</small>
                      </div>
                    </article>
                  );
                })}
                {filteredLaunchJobs.length === 0 ? <p className="empty-copy">{t("launch.empty")}</p> : null}
              </div>

              <div className="launch-side-stack">
                <div className="command-preview">
                  <div className="section-title">
                    <Rocket size={16} />
                    <strong>{t("launch.commandPreview")}</strong>
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
                    <span className={`worker-status ${workerPlan?.enabled ? "enabled" : "locked"}`}>
                      {workerPlan?.enabled ? t("worker.enabled") : t("worker.locked")}
                    </span>
                  </div>
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
                        <button onClick={() => void handleOpenWorkerHistory()} type="button">
                          <History size={12} />
                          {t("worker.history.open")}
                        </button>
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

        {registeredChannelId ? (
          <section className="panel library-index-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("library.kicker")}</p>
                <h2>{t("library.title")}</h2>
              </div>
              <label className="library-search">
                <Search size={15} />
                <input
                  aria-label={t("library.search")}
                  onChange={(event) => setLibraryQuery(event.target.value)}
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
                    setLibraryCodecFilter(event.target.value);
                  }}
                  placeholder={t("library.filter.codecPlaceholder")}
                  value={libraryCodecFilter}
                />
              </label>
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
              {visibleLibraryItems.length === 0 ? <p className="empty-copy">{t("library.empty")}</p> : null}
            </div>
          </section>
        ) : null}

        <section className="archive-grid">
          <motion.div
            className="panel backup-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div className="channel-brief">
                <div className="channel-avatar">{activeInitials}</div>
                <div>
                  <p className="panel-kicker">{t("panel.backup.kicker")}</p>
                  <h2>{activeTitle}</h2>
                  <span>{activeHandle} · {activeExternalId}</span>
                </div>
              </div>
              <ShieldCheck size={20} className="panel-icon emerald" />
            </div>
            <div className="backup-stats">
              {activeBackupStats.map((stat) => (
                <article className="backup-stat" key={stat.labelKey}>
                  <span>{t(stat.labelKey)}</span>
                  <strong>{stat.value}</strong>
                  <small>{t(stat.detailKey)}</small>
                </article>
              ))}
            </div>
            <div className="cadence-block">
              <div>
                <p className="panel-kicker">{t("panel.cadence.kicker")}</p>
                <h3>{t("panel.cadence.title")}</h3>
                <div className="cadence-meta">
                  <span><Clock3 size={14} /> {latestUploadLabel}</span>
                  <span><TimerReset size={14} /> {cadenceAverageLabel}</span>
                </div>
              </div>
              <div className="cadence-strip" aria-label={t("panel.cadence.title")}>
                {activeRhythm.map((day) => (
                  <div className="cadence-day" key={day.labelKey}>
                    <span>{t(day.labelKey)}</span>
                    <i style={{ height: `${Math.max(18, day.intensity * 88)}px` }} />
                    <strong>{day.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="panel folder-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.folder.kicker")}</p>
                <h2>{t("panel.folder.title")}</h2>
              </div>
              <FolderTree size={20} className="panel-icon" />
            </div>
            <code className="folder-root">{activeFolderRoot}</code>
            <div className="folder-tree" aria-label={t("panel.folder.title")}>
              {activeFolderRows.map((item) => (
                <div className={`folder-row folder-${item.kind}`} key={`${item.depth}-${item.name}`}>
                  <span style={{ width: `${item.depth * 18}px` }} />
                  {item.kind === "file" ? <FileText size={15} /> : <Folder size={15} />}
                  <code>{item.name}</code>
                </div>
              ))}
            </div>
            <div className="fidelity-list" aria-label={t("panel.fidelity.title")}>
              <p className="panel-kicker">{t("panel.fidelity.kicker")}</p>
              {fidelityChecks.map((item) => (
                <span className={`fidelity-pill ${item.status}`} key={item.labelKey}>
                  <ShieldCheck size={14} />
                  {t(item.labelKey)}
                </span>
              ))}
            </div>
            <div className="folder-meta">
              <span><Film size={15} /> {t("folder.quality")}</span>
              <span><CalendarDays size={15} /> {t("folder.template")}</span>
            </div>
          </motion.div>
          <motion.div
            className="panel constellation-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
          >
            <div className="panel-header">
              <div>
                <p className="panel-kicker">{t("panel.channelHealth.kicker")}</p>
                <h2>{t("panel.channelHealth.title")}</h2>
              </div>
              <div className="legend-row">
                <span><i className="legend-dot healthy" /> {t("legend.healthy")}</span>
                <span><i className="legend-dot warning" /> {t("legend.pressure")}</span>
                <span><i className="legend-dot failed" /> {t("legend.failed")}</span>
              </div>
            </div>
            <ChannelConstellation channels={activeChannels} links={activeLinks} />
          </motion.div>

          <motion.div
            className="panel queue-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.liveJobs.kicker")}</p>
                <h2>{t("panel.liveJobs.title")}</h2>
              </div>
              <Activity size={20} className="panel-icon" />
            </div>
            <QueueFlow lanes={activeQueue} />
          </motion.div>
        </section>

        <section className="lower-grid">
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
            <div className="storage-map">
              {activeChannels.map((channel) => (
                <div
                  className={`storage-cell ${channel.health < 85 ? "warn" : ""}`}
                  key={channel.id}
                  style={{ flexGrow: channel.storageGb }}
                  title={`${channel.title}: ${channel.storageGb} GB`}
                >
                  <span>{channel.title}</span>
                  <strong>{channel.storageGb} {t("unit.gb")}</strong>
                </div>
              ))}
            </div>
          </motion.div>

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
        </section>
      </section>
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
                <Rocket size={16} />
                <span>{t("runtime.worker")}</span>
                <strong>{workerRuntimeLabel}</strong>
                <small>{runtimeSettings?.download_worker_enabled ? t("runtime.worker.liveDetail") : t("runtime.worker.lockedDetail")}</small>
              </article>
            </div>

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

function eventTone(type: string) {
  if (type.includes("failed") || type.includes("cancelled")) return "bad";
  if (type.includes("completed") || type.includes("updated")) return "good";
  if (type.includes("queued") || type.includes("started")) return "active";
  return "info";
}

function eventLabel(event: ArchiveEvent, t: (key: TranslationKey) => string) {
  const title = typeof event.data.channel_title === "string" ? event.data.channel_title : "";
  if (event.type === "sync.started") return `${t("event.sync.started")} ${title}`.trim();
  if (event.type === "sync.completed") {
    const count = typeof event.data.videos_created === "number" ? event.data.videos_created : 0;
    return t("event.sync.completed").replace("{count}", String(count));
  }
  if (event.type === "sync.failed") return `${t("event.sync.failed")} ${title}`.trim();
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
  if (event.type === "policy.updated") return t("event.policy.updated");
  return event.type;
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "sync pending";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
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

function preflightLabel(status: string, t: (key: TranslationKey) => string) {
  if (status === "ready") return t("preflight.status.ready");
  if (status === "review") return t("preflight.status.review");
  return t("preflight.status.unchecked");
}

function isLaunchableJob(job: DownloadJob) {
  return job.status === "candidate" || job.status === "queued";
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
