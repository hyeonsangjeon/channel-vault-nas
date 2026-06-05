const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
export const WS_EVENTS_URL = API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "") + "/ws/events";
export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export type SourceVideoPreview = {
  external_id: string;
  title: string;
  url: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  upload_date: string | null;
};

export type ChannelProbeResult = {
  title: string;
  external_id: string | null;
  handle: string | null;
  source_url: string;
  channel_url: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  follower_count: number | null;
  video_count: number;
  videos: SourceVideoPreview[];
  storage_forecast: {
    video_count: number;
    max_quality: string;
    audio_only: boolean;
    estimated_bytes: number;
    estimated_label: string;
    confidence: string;
  };
  folder_preview: {
    root: string;
    channel_dir: string;
    example_video_dir: string | null;
    sidecars: string[];
  };
  already_registered: boolean;
  existing_channel_id: number | null;
  normalized: {
    original: string;
    source_type: string;
    identifier_type: string;
    identifier: string;
    canonical_url: string;
    probe_url: string;
    tracking_query_removed: boolean;
  };
};

export type ChannelRegistrationResult = {
  created: boolean;
  channel: RegisteredChannel;
  probe: ChannelProbeResult;
};

export type RegisteredChannel = {
  id: number;
  title: string;
  external_id: string | null;
  handle: string | null;
  source_url: string;
  video_count: number;
  archived_count: number;
  missing_count: number;
  status: string;
  created_at: string;
};

export type ChannelRegistrationPayload = {
  value: string;
  max_quality: string;
  audio_only: boolean;
  subtitles_enabled: boolean;
  auto_download?: boolean;
  backfill_mode?: string;
};

export type ChannelDetail = RegisteredChannel & {
  description: string | null;
  thumbnail_url: string | null;
  removed_saved_count: number;
  last_synced_at: string | null;
  sync_interval_minutes: number;
  next_sync_due_at: string | null;
  last_auto_synced_at: string | null;
  last_auto_sync_status: string | null;
  last_auto_candidates_created: number;
  first_video_published_at: string | null;
  latest_video_published_at: string | null;
  avg_upload_interval_days: number | null;
  typical_upload_dow: number | null;
  typical_upload_hour: number | null;
  updated_at: string;
};

export type ChannelSettingsUpdate = {
  sync_interval_minutes?: number;
};

export type ChannelVideo = {
  id: number;
  channel_id: number;
  external_id: string;
  title: string;
  url: string;
  published_at: string | null;
  upload_date: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  source_state: string;
  archive_state: "archived" | "missing" | string;
  info_json_path: string | null;
  discovered_at: string;
};

export type ChannelCoverage = {
  channel_id: string;
  source: number;
  archived: number;
  missing: number;
  removed_saved: number;
  percent: number;
  updated_at: string;
};

export type MissingVideo = {
  id: string;
  title: string;
  published_at: string;
  source_state: string;
  reason: string;
};

export type ChannelCadenceBucket = {
  dow: number;
  label: string;
  count: number;
  typical_hour: number;
};

export type ChannelCadence = {
  channel_id: string;
  first_video_published_at: string;
  latest_video_published_at: string;
  avg_upload_interval_days: number;
  typical_upload_dow: number;
  typical_upload_hour: number;
  next_expected_at: string;
  buckets: ChannelCadenceBucket[];
};

export type ChannelPolicy = {
  channel_id: number;
  auto_download: boolean;
  max_quality: string;
  audio_only: boolean;
  subtitles_enabled: boolean;
  subtitle_languages: string[];
  retention_policy: string;
  worker_paused: boolean;
  worker_pause_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ChannelPolicyUpdate = Partial<
  Pick<
    ChannelPolicy,
    | "auto_download"
    | "max_quality"
    | "audio_only"
    | "subtitles_enabled"
    | "subtitle_languages"
    | "retention_policy"
    | "worker_paused"
    | "worker_pause_reason"
  >
>;

export type SyncJob = {
  id: number;
  channel_id: number;
  channel_title: string;
  trigger: string;
  status: "running" | "completed" | "failed" | string;
  started_at: string;
  completed_at: string | null;
  videos_seen: number;
  videos_created: number;
  videos_enriched: number;
  candidates_created: number;
  error_message: string | null;
  created_at: string;
};

export type ChannelSyncResult = {
  job: SyncJob;
  channel: RegisteredChannel;
  videos_seen: number;
  videos_created: number;
  videos_enriched: number;
  candidates_created: number;
};

export type DownloadJob = {
  id: number;
  video_id: number;
  video_external_id: string;
  video_title: string;
  channel_id: number;
  channel_title: string;
  status: "candidate" | "queued" | "running" | "completed" | "failed" | string;
  progress: number;
  quality: string;
  priority: number;
  preflight_status: "unchecked" | "ready" | "review" | string;
  estimated_bytes: number | null;
  preflight_checked_at: string | null;
  error_message: string | null;
  attempt_count: number;
  archive_path: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DownloadJobBulkRequest = {
  job_ids: number[];
  action: "queue" | "cancel" | "prioritize" | "retry";
  priority?: number;
  quality?: string;
};

export type QueuePreflightPlan = {
  channel_id: number | null;
  job_count: number;
  candidate_count: number;
  queued_count: number;
  estimated_bytes: number;
  estimated_label: string;
  ready_job_ids: number[];
  review_job_ids: number[];
  warnings: string[];
  command_preview: string[];
  jobs: DownloadJob[];
};

export type DownloadWorkerPlanJob = {
  job: DownloadJob;
  archive_dir: string;
  output_template: string;
  command_preview: string;
  status_note: string | null;
};

export type DownloadWorkerPlan = {
  enabled: boolean;
  dry_run: boolean;
  channel_id: number | null;
  limit: number;
  queued_count: number;
  claimable_count: number;
  running_count: number;
  locked_reason: string | null;
  running_jobs: DownloadWorkerPlanJob[];
  jobs: DownloadWorkerPlanJob[];
};

export type DownloadWorkerRunRequest = {
  channel_id?: number | null;
  limit?: number;
  dry_run?: boolean;
};

export type DownloadWorkerRunResult = {
  enabled: boolean;
  dry_run: boolean;
  started: number;
  completed: number;
  failed: number;
  skipped_reason: string | null;
  plan: DownloadWorkerPlan;
  jobs: DownloadJob[];
};

export type DownloadWorkerRunAudit = {
  id: number;
  channel_id: number | null;
  channel_title: string | null;
  status: string;
  dry_run: boolean;
  started_count: number;
  completed_count: number;
  failed_count: number;
  planned_job_ids: number[];
  started_job_ids: number[];
  completed_job_ids: number[];
  failed_job_ids: number[];
  skipped_reason: string | null;
  duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type DownloadWorkerRunSummaryFile = {
  id: number;
  video_id: number;
  video_external_id: string;
  video_title: string;
  channel_id: number;
  channel_title: string;
  relative_path: string;
  filename: string;
  size_bytes: number | null;
  size_label: string;
  container: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  info_json_path: string | null;
  nfo_path: string | null;
  thumbnail_path: string | null;
  created_at: string;
};

export type DownloadWorkerRunSummary = {
  generated_at: string;
  channel_id: number | null;
  channel_title: string | null;
  run: DownloadWorkerRunAudit | null;
  latest_worker_jobs: DownloadJob[];
  completed_jobs: DownloadJob[];
  failed_jobs: DownloadJob[];
  archived_files: DownloadWorkerRunSummaryFile[];
};

export type DownloadCandidateResult = {
  channel: RegisteredChannel;
  candidates_created: number;
  total_candidates: number;
  jobs: DownloadJob[];
};

export type ArchiveEvent = {
  id?: number | null;
  type: string;
  data: Record<string, unknown>;
  occurred_at: string;
};

export type ArchiveEventFilters = {
  event_id?: number;
  type_prefix?: string;
  channel_id?: number;
  job_id?: number;
  video_id?: number;
};

export type LogPruneResult = {
  kind: string;
  deleted: number;
  keep_latest: number;
};

export type DashboardSnapshot = {
  coverage: {
    source: number;
    archived: number;
    missing: number;
    removed_saved: number;
    percent: number;
  };
  fidelity: {
    info_json: number;
    thumbnails: number;
    subtitles: number;
    nfo: number;
  };
  metrics: {
    label: string;
    value: string;
    detail: string;
    tone: string;
  }[];
  channels: {
    id: string;
    title: string;
    health: number;
    storage_gb: number;
    new_videos: number;
    failed_jobs: number;
    group: string;
  }[];
  links: {
    source: string;
    target: string;
    weight: number;
  }[];
  queue: {
    label: string;
    count: number;
    status: "active" | "waiting" | "blocked" | string;
  }[];
  activity: {
    title: string;
    channel: string;
    status: "discovered" | "downloading" | "archived" | "failed" | string;
    time: string;
  }[];
};

export type OperationSeverity = "critical" | "warning" | "info" | "good";
export type OperationStatus = "blocked" | "action" | "watch" | "done";
export type OperationActionKind =
  | "register"
  | "storage"
  | "snapshot"
  | "runtime"
  | "downloads"
  | "library"
  | "refresh"
  | "none";

export type OperationMetric = {
  key: string;
  value: string;
  raw_value: number | null;
  tone: OperationSeverity;
};

export type OperationMission = {
  id: string;
  severity: OperationSeverity;
  status: OperationStatus;
  action_kind: OperationActionKind;
  count: number;
  primary_value: string;
  secondary_value: string;
  target_kind: string;
  target_id: string;
  target_channel_id: number | null;
  target_path: string;
  resolved: boolean;
};

export type OperationsReadiness = {
  generated_at: string;
  score: number;
  stage: "setup" | "attention" | "ready" | "excellent" | string;
  metrics: OperationMetric[];
  missions: OperationMission[];
  warnings: string[];
};

export type LibraryFidelity = {
  info_json: boolean;
  media: boolean;
  thumbnail: boolean;
  subtitles: boolean;
  nfo: boolean;
};

export type LibraryItem = {
  id: number;
  channel_id: number;
  channel_title: string;
  video_external_id: string;
  title: string;
  url: string;
  published_at: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  source_state: string;
  archive_state: "archived" | "missing" | string;
  integrity_state: "complete" | "partial_sidecars" | "missing_media" | "media_only" | string;
  info_json_path: string | null;
  media_files: string[];
  media_count: number;
  media_container: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  total_bytes: number;
  total_label: string;
  queue_status: string | null;
  queue_priority: number | null;
  fidelity: LibraryFidelity;
};

export type LibrarySnapshot = {
  items: LibraryItem[];
  total: number;
  archived: number;
  missing: number;
  queued: number;
  total_bytes: number;
  total_label: string;
};

export type LibraryFilters = {
  integrity?: string;
  codec?: string;
  missing_sidecar?: string;
};

export type LibrarySavedView = {
  id: number;
  name: string;
  query: string;
  integrity: string;
  sidecar: string;
  codec: string;
  created_at: string;
  updated_at: string;
};

export type LibrarySavedViewPayload = {
  name: string;
  query: string;
  integrity: string;
  sidecar: string;
  codec: string;
};

export type LibrarySidecar = {
  kind: string;
  relative_path: string;
  exists: boolean;
};

export type LibraryFile = {
  video_id: number;
  relative_path: string;
  filename: string;
  size_bytes: number | null;
  container: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  exists: boolean;
  size_label: string;
  integrity_state: "complete" | "partial_sidecars" | "missing_media" | "media_only" | string;
  info_json_path: string | null;
  thumbnail_path: string | null;
  nfo_path: string | null;
  info_json_exists: boolean;
  thumbnail_exists: boolean;
  nfo_exists: boolean;
  sidecars: LibrarySidecar[];
  stream_url: string;
};

export type BinaryHealth = {
  name: string;
  command: string;
  available: boolean;
  resolved_path: string | null;
};

export type RuntimeSettings = {
  download_worker_enabled: boolean;
  download_worker_scheduler_enabled: boolean;
  download_worker_scheduler_interval_seconds: number;
  download_worker_scheduler_limit: number;
  metadata_sync_scheduler_enabled: boolean;
  metadata_sync_scheduler_interval_seconds: number;
  metadata_sync_scheduler_limit: number;
  download_dir: string;
  metadata_dir: string;
  managed_env_file: string;
  pending_restart: boolean;
  pending_overrides: RuntimeEnvOverride[];
  restart_command: string;
  restart_adapter: RuntimeRestartAdapter;
  scheduler_status: {
    state: "off" | "locked" | "armed" | "waiting" | "running" | "failed" | string;
    enabled: boolean;
    worker_enabled: boolean;
    running: boolean;
    interval_seconds: number;
    limit: number;
    last_started_at: string | null;
    last_completed_at: string | null;
    last_error: string | null;
    last_result_status: string | null;
    next_tick_at: string | null;
  };
  metadata_scheduler_status: {
    state: "off" | "armed" | "waiting" | "running" | "failed" | string;
    enabled: boolean;
    running: boolean;
    interval_seconds: number;
    limit: number;
    due_channel_count: number;
    next_due_at: string | null;
    due_channels: {
      id: number;
      title: string;
      handle: string | null;
      sync_interval_minutes: number;
      last_synced_at: string | null;
      next_due_at: string;
      is_due: boolean;
    }[];
    last_started_at: string | null;
    last_completed_at: string | null;
    last_error: string | null;
    last_result_status: string | null;
    next_tick_at: string | null;
  };
  scheduler_ticks: SchedulerTick[];
  metadata_sync_ticks: MetadataSyncTick[];
  binaries: BinaryHealth[];
};

export type RuntimeRestartAdapter = {
  adapter: string;
  environment: string;
  label: string;
  command: string;
  executable: boolean;
  manual_required: boolean;
  reason: string;
  command_available: boolean;
  setup_hints: string[];
  env_lines: string[];
  service_name: string | null;
  compose_file: string | null;
};

export type RuntimeEnvOverride = {
  key: string;
  value: string;
  active_value: string | null;
  pending_restart: boolean;
};

export type SchedulerTick = {
  id: number;
  trigger: string;
  status: "running" | "completed" | "failed" | "skipped" | string;
  scheduler_enabled: boolean;
  worker_enabled: boolean;
  interval_seconds: number;
  limit: number;
  started_count: number;
  completed_count: number;
  failed_count: number;
  skipped_reason: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  next_tick_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type MetadataSyncTick = {
  id: number;
  trigger: string;
  status: "running" | "completed" | "failed" | "skipped" | string;
  scheduler_enabled: boolean;
  interval_seconds: number;
  limit: number;
  due_channel_count: number;
  synced_count: number;
  failed_count: number;
  videos_seen_count: number;
  videos_created_count: number;
  videos_enriched_count: number;
  candidates_created_count: number;
  skipped_reason: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  next_tick_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type RuntimeSettingsUpdate = {
  download_worker_enabled?: boolean;
  download_worker_scheduler_enabled?: boolean;
  download_worker_scheduler_interval_seconds?: number;
  download_worker_scheduler_limit?: number;
  metadata_sync_scheduler_enabled?: boolean;
  metadata_sync_scheduler_interval_seconds?: number;
  metadata_sync_scheduler_limit?: number;
  ytdlp_binary?: string;
  ffprobe_binary?: string;
};

export type RuntimeSettingsApplyResult = {
  applied: boolean;
  restart_required: boolean;
  changed_keys: string[];
  managed_env_file: string;
  restart_command: string;
  runtime: RuntimeSettings;
};

export type RuntimeRestartResult = {
  requested: boolean;
  adapter: RuntimeRestartAdapter;
  message: string;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
};

export type SchedulerTickFilters = {
  status?: string;
  min_duration_seconds?: number;
  interval_seconds?: number;
  worker_limit?: number;
};

export type MetadataSyncTickFilters = {
  status?: string;
  min_duration_seconds?: number;
  interval_seconds?: number;
  scheduler_limit?: number;
};

export type RescanApplyResult = {
  root: string;
  candidates_seen: number;
  channels_created: number;
  videos_created: number;
  media_files_indexed: number;
  thumbnails_indexed: number;
  subtitles_indexed: number;
  warnings: string[];
};

export type ArchiveTxtPreviewItem = {
  line_number: number;
  raw: string;
  video_external_id: string | null;
  state: "archived" | "known_missing" | "unknown" | "duplicate" | "invalid" | string;
  title: string | null;
  channel_title: string | null;
  reason: string;
};

export type ArchiveTxtPreviewResult = {
  total_lines: number;
  parsed_count: number;
  archived_count: number;
  known_missing_count: number;
  unknown_count: number;
  duplicate_count: number;
  invalid_count: number;
  items: ArchiveTxtPreviewItem[];
};

export type ArchiveTxtStageResult = {
  channel_id: number;
  videos_created: number;
  candidates_created: number;
  skipped_count: number;
  video_ids: number[];
  job_ids: number[];
  preview: ArchiveTxtPreviewResult;
  warnings: string[];
};

export type StorageVolume = {
  root: string;
  exists: boolean;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  archive_bytes: number;
  pressure_percent: number;
  archive_label: string;
  used_label: string;
  free_label: string;
  total_label: string;
  file_count: number;
  dir_count: number;
};

export type StorageChannel = {
  relative_path: string;
  title: string;
  bytes: number;
  label: string;
  file_count: number;
  media_count: number;
  sidecar_count: number;
  orphan_sidecar_count: number;
  video_folder_count: number;
  pressure_score: number;
};

export type StorageExtension = {
  extension: string;
  bytes: number;
  label: string;
  count: number;
};

export type StorageOrphanSidecar = {
  relative_path: string;
  kind: string;
  size_bytes: number;
  label: string;
  reason: string;
};

export type StorageOrphanQuarantineResult = {
  action: string;
  relative_path: string;
  applied: boolean;
  dry_run: boolean;
  destination_relative_path: string | null;
  size_bytes: number;
  warnings: string[];
};

export type StorageQuarantineItem = {
  relative_path: string;
  original_relative_path: string;
  kind: string;
  size_bytes: number;
  label: string;
  quarantined_at: string | null;
  restore_blocked_reason: string | null;
};

export type StorageQuarantineList = {
  count: number;
  total_bytes: number;
  total_label: string;
  items: StorageQuarantineItem[];
  warnings: string[];
};

export type StorageQuarantineRestoreResult = {
  action: string;
  quarantine_relative_path: string;
  destination_relative_path: string | null;
  applied: boolean;
  dry_run: boolean;
  size_bytes: number;
  warnings: string[];
};

export type StorageQuarantinePurgeResult = {
  action: string;
  applied: boolean;
  dry_run: boolean;
  min_age_days: number;
  cutoff_at: string;
  required_confirmation: string;
  candidate_count: number;
  retained_count: number;
  planned_bytes: number;
  planned_label: string;
  deleted_files: number;
  deleted_bytes: number;
  deleted_label: string;
  items: StorageQuarantineItem[];
  warnings: string[];
};

export type StorageFolderNode = {
  relative_path: string;
  name: string;
  depth: number;
  bytes: number;
  label: string;
  file_count: number;
};

export type StorageDriftItem = {
  relative_path: string;
  kind: string;
  label: string;
  reason: string;
};

export type StorageDrift = {
  unindexed_media_count: number;
  indexed_missing_count: number;
  unindexed_media: StorageDriftItem[];
  indexed_missing: StorageDriftItem[];
};

export type StorageDriftActionResult = {
  action: string;
  relative_path: string;
  applied: boolean;
  dry_run: boolean;
  deleted_media_files: number;
  planned_media_files: number;
  planned_info_json: number;
  planned_subtitles: number;
  planned_thumbnails: number;
  planned_nfo: number;
  rescan: RescanApplyResult | null;
  warnings: string[];
};

export type StorageScan = {
  scanned_at: string;
  volume: StorageVolume;
  channels: StorageChannel[];
  top_extensions: StorageExtension[];
  orphan_sidecars: StorageOrphanSidecar[];
  folder_tree: StorageFolderNode[];
  drift: StorageDrift;
  warnings: string[];
};

export type StoragePressureSnapshot = {
  id: number;
  root: string;
  archive_bytes: number;
  archive_label: string;
  used_bytes: number;
  used_label: string;
  free_bytes: number;
  free_label: string;
  total_bytes: number;
  total_label: string;
  pressure_percent: number;
  file_count: number;
  dir_count: number;
  channel_count: number;
  orphan_sidecar_count: number;
  unindexed_media_count: number;
  indexed_missing_count: number;
  scanned_at: string;
  created_at: string;
};

export type StoragePressureTrend = {
  snapshots: StoragePressureSnapshot[];
  latest: StoragePressureSnapshot | null;
  previous: StoragePressureSnapshot | null;
  delta_archive_bytes: number;
  delta_archive_label: string;
  delta_pressure_percent: number;
  daily_growth_bytes: number;
  daily_growth_label: string;
  runway_days: number | null;
  runway_label: string;
  warning: string | null;
};

export type StorageChannelPressureSnapshot = {
  id: number;
  snapshot_id: number;
  root: string;
  channel_relative_path: string;
  title: string;
  bytes: number;
  label: string;
  file_count: number;
  media_count: number;
  sidecar_count: number;
  orphan_sidecar_count: number;
  video_folder_count: number;
  pressure_score: number;
  scanned_at: string;
  created_at: string;
};

export type StorageChannelPressureComparison = {
  window_days: number;
  label: string;
  snapshot_count: number;
  baseline: StorageChannelPressureSnapshot | null;
  delta_bytes: number;
  delta_label: string;
  daily_growth_bytes: number;
  daily_growth_label: string;
  growth_percent: number;
  warning: string | null;
};

export type StorageChannelPressureTrend = {
  relative_path: string;
  snapshots: StorageChannelPressureSnapshot[];
  latest: StorageChannelPressureSnapshot | null;
  previous: StorageChannelPressureSnapshot | null;
  delta_bytes: number;
  delta_label: string;
  peak_bytes: number;
  peak_label: string;
  comparisons: StorageChannelPressureComparison[];
  warning: string | null;
};

export async function probeChannel(payload: ChannelRegistrationPayload): Promise<ChannelProbeResult> {
  return postJson("/api/channels/_probe", payload);
}

export async function registerChannel(payload: ChannelRegistrationPayload): Promise<ChannelRegistrationResult> {
  return postJson("/api/channels", payload);
}

export async function getChannel(channelId: number): Promise<ChannelDetail> {
  return getJson(`/api/channels/${channelId}`);
}

export async function updateChannel(channelId: number, payload: ChannelSettingsUpdate): Promise<ChannelDetail> {
  return patchJson(`/api/channels/${channelId}`, payload);
}

export async function getChannelVideos(channelId: number): Promise<ChannelVideo[]> {
  return getJson(`/api/channels/${channelId}/videos`);
}

export async function getChannelCoverage(channelId: number): Promise<ChannelCoverage> {
  return getJson(`/api/channels/${channelId}/coverage`);
}

export async function getChannelMissingVideos(channelId: number): Promise<MissingVideo[]> {
  return getJson(`/api/channels/${channelId}/missing`);
}

export async function getChannelCadence(channelId: number): Promise<ChannelCadence> {
  return getJson(`/api/channels/${channelId}/cadence`);
}

export async function getChannelPolicy(channelId: number): Promise<ChannelPolicy> {
  return getJson(`/api/channels/${channelId}/policy`);
}

export async function updateChannelPolicy(channelId: number, payload: ChannelPolicyUpdate): Promise<ChannelPolicy> {
  return patchJson(`/api/channels/${channelId}/policy`, payload);
}

export async function syncChannel(channelId: number, payload: Pick<ChannelRegistrationPayload, "max_quality" | "audio_only" | "subtitles_enabled">): Promise<ChannelSyncResult> {
  return postJson(`/api/channels/${channelId}/sync`, payload);
}

export type SyncJobFilters = {
  status?: string;
  trigger?: string;
};

export async function getSyncJobs(
  channelId?: number,
  limit = 4,
  filters: SyncJobFilters = {},
): Promise<SyncJob[]> {
  const params = new URLSearchParams();
  if (typeof channelId === "number") params.set("channel_id", String(channelId));
  params.set("limit", String(limit));
  if (filters.status) params.set("status", filters.status);
  if (filters.trigger) params.set("trigger", filters.trigger);
  return getJson(`/api/jobs/sync?${params}`);
}

export async function createDownloadCandidates(channelId: number, quality: string): Promise<DownloadCandidateResult> {
  return postJson(`/api/channels/${channelId}/downloads/candidates`, { quality, limit: 50 });
}

export async function enqueueVideoDownload(videoId: number, quality: string): Promise<{ job: DownloadJob }> {
  return postJson(`/api/videos/${videoId}/download`, { quality });
}

export type DownloadJobFilters = {
  status?: string;
  preflight_status?: string;
  limit?: number;
};

export async function getDownloadJobs(channelId?: number, filters: DownloadJobFilters = {}): Promise<DownloadJob[]> {
  const params = new URLSearchParams();
  if (typeof channelId === "number") params.set("channel_id", String(channelId));
  if (filters.status) params.set("status", filters.status);
  if (filters.preflight_status) params.set("preflight_status", filters.preflight_status);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  const suffix = params.toString() ? `?${params}` : "";
  return getJson(`/api/jobs/downloads${suffix}`);
}

export async function getQueuePreflight(channelId?: number): Promise<QueuePreflightPlan> {
  const query = typeof channelId === "number" ? `?channel_id=${channelId}` : "";
  return getJson(`/api/jobs/downloads/preflight${query}`);
}

export async function getDownloadWorkerPlan(channelId?: number, limit = 3): Promise<DownloadWorkerPlan> {
  const params = new URLSearchParams();
  if (typeof channelId === "number") params.set("channel_id", String(channelId));
  params.set("limit", String(limit));
  return getJson(`/api/jobs/downloads/worker/plan?${params}`);
}

export async function runDownloadWorkerOnce(payload: DownloadWorkerRunRequest): Promise<DownloadWorkerRunResult> {
  return postJson("/api/jobs/downloads/worker/run-once", payload);
}

export type DownloadWorkerRunFilters = {
  status?: string;
  dry_run?: boolean;
  failed_only?: boolean;
};

export async function getDownloadWorkerRuns(
  channelId?: number,
  limit = 4,
  filters: DownloadWorkerRunFilters = {},
): Promise<DownloadWorkerRunAudit[]> {
  const params = new URLSearchParams();
  if (typeof channelId === "number") params.set("channel_id", String(channelId));
  params.set("limit", String(limit));
  if (filters.status) params.set("status", filters.status);
  if (typeof filters.dry_run === "boolean") params.set("dry_run", String(filters.dry_run));
  if (filters.failed_only) params.set("failed_only", "true");
  return getJson(`/api/jobs/downloads/worker/runs?${params}`);
}

export async function getDownloadWorkerRunSummary(channelId?: number, runId?: number): Promise<DownloadWorkerRunSummary> {
  const params = new URLSearchParams();
  if (typeof channelId === "number") params.set("channel_id", String(channelId));
  if (typeof runId === "number") params.set("run_id", String(runId));
  return getJson(`/api/jobs/downloads/worker/summary?${params}`);
}

export async function bulkUpdateDownloadJobs(payload: DownloadJobBulkRequest): Promise<{ updated: number; jobs: DownloadJob[] }> {
  return postJson("/api/jobs/downloads/bulk", payload);
}

export async function retryDownloadJob(jobId: number): Promise<{ job: DownloadJob }> {
  return postJson(`/api/jobs/downloads/${jobId}/retry`, {});
}

export async function cancelDownloadJob(jobId: number): Promise<{ job: DownloadJob }> {
  return postJson(`/api/jobs/downloads/${jobId}/cancel`, {});
}

export async function stopDownloadJob(jobId: number): Promise<{ job: DownloadJob }> {
  return postJson(`/api/jobs/downloads/${jobId}/stop`, {});
}

export async function getRecentEvents(limit = 50, filters: ArchiveEventFilters = {}): Promise<ArchiveEvent[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (typeof filters.event_id === "number") params.set("event_id", String(filters.event_id));
  if (filters.type_prefix) params.set("type_prefix", filters.type_prefix);
  if (typeof filters.channel_id === "number") params.set("channel_id", String(filters.channel_id));
  if (typeof filters.job_id === "number") params.set("job_id", String(filters.job_id));
  if (typeof filters.video_id === "number") params.set("video_id", String(filters.video_id));
  return getJson(`/api/events/recent?${params}`);
}

export async function pruneRecentEvents(keepLatest = 500): Promise<LogPruneResult> {
  return deleteJson(`/api/events/recent?keep_latest=${keepLatest}`);
}

export async function getDashboard(): Promise<DashboardSnapshot> {
  return getJson("/api/dashboard");
}

export async function getOperationsReadiness(): Promise<OperationsReadiness> {
  return getJson("/api/ops/readiness");
}

export async function getLibrary(channelId?: number, query?: string, filters: LibraryFilters = {}): Promise<LibrarySnapshot> {
  const params = new URLSearchParams();
  if (typeof channelId === "number") params.set("channel_id", String(channelId));
  if (query?.trim()) params.set("query", query.trim());
  if (filters.integrity) params.set("integrity", filters.integrity);
  if (filters.codec) params.set("codec", filters.codec);
  if (filters.missing_sidecar) params.set("missing_sidecar", filters.missing_sidecar);
  const suffix = params.toString() ? `?${params}` : "";
  return getJson(`/api/library${suffix}`);
}

export async function getLibraryViews(): Promise<LibrarySavedView[]> {
  return getJson("/api/library/views");
}

export async function saveLibraryView(payload: LibrarySavedViewPayload): Promise<LibrarySavedView> {
  return postJson("/api/library/views", payload);
}

export async function deleteLibraryView(viewId: number): Promise<{ deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/library/views/${viewId}`, { method: "DELETE" });
  return readJsonResponse<{ deleted: boolean }>(response);
}

export async function getLibraryFiles(videoId: number): Promise<LibraryFile[]> {
  return getJson(`/api/library/${videoId}/files`);
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  return getJson("/api/settings/runtime");
}

export async function updateRuntimeSettings(payload: RuntimeSettingsUpdate): Promise<RuntimeSettingsApplyResult> {
  return patchJson("/api/settings/runtime", payload);
}

export async function requestRuntimeRestart(reason: string): Promise<RuntimeRestartResult> {
  return postJson("/api/settings/runtime/restart", { reason });
}

export async function getSchedulerTicks(limit = 24, filters: SchedulerTickFilters = {}): Promise<SchedulerTick[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (filters.status) params.set("status", filters.status);
  if (typeof filters.min_duration_seconds === "number") {
    params.set("min_duration_seconds", String(filters.min_duration_seconds));
  }
  if (typeof filters.interval_seconds === "number") {
    params.set("interval_seconds", String(filters.interval_seconds));
  }
  if (typeof filters.worker_limit === "number") {
    params.set("worker_limit", String(filters.worker_limit));
  }
  return getJson(`/api/jobs/downloads/scheduler/ticks?${params}`);
}

export async function pruneSchedulerTicks(keepLatest = 200): Promise<LogPruneResult> {
  return deleteJson(`/api/jobs/downloads/scheduler/ticks?keep_latest=${keepLatest}`);
}

export async function getMetadataSyncTicks(
  limit = 24,
  filters: MetadataSyncTickFilters = {},
): Promise<MetadataSyncTick[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (filters.status) params.set("status", filters.status);
  if (typeof filters.min_duration_seconds === "number") {
    params.set("min_duration_seconds", String(filters.min_duration_seconds));
  }
  if (typeof filters.interval_seconds === "number") {
    params.set("interval_seconds", String(filters.interval_seconds));
  }
  if (typeof filters.scheduler_limit === "number") {
    params.set("scheduler_limit", String(filters.scheduler_limit));
  }
  return getJson(`/api/jobs/sync/scheduler/ticks?${params}`);
}

export async function pruneMetadataSyncTicks(keepLatest = 200): Promise<LogPruneResult> {
  return deleteJson(`/api/jobs/sync/scheduler/ticks?keep_latest=${keepLatest}`);
}

export async function runMetadataSyncSchedulerOnce(): Promise<MetadataSyncTick> {
  return postJson("/api/jobs/sync/scheduler/run-once", {});
}

export async function getStorageScan(): Promise<StorageScan> {
  return getJson("/api/storage/scan");
}

export async function getStoragePressureTrend(limit = 24): Promise<StoragePressureTrend> {
  return getJson(`/api/storage/pressure/trend?limit=${limit}`);
}

export async function getStorageChannelPressureTrend(relativePath: string, limit = 24): Promise<StorageChannelPressureTrend> {
  const params = new URLSearchParams();
  params.set("relative_path", relativePath);
  params.set("limit", String(limit));
  return getJson(`/api/storage/pressure/channels/trend?${params}`);
}

export async function captureStoragePressureSnapshot(limit = 24): Promise<StoragePressureTrend> {
  return postJson(`/api/storage/pressure/snapshots?limit=${limit}`, {});
}

export async function recoverUnindexedStorageDrift(relativePath: string, dryRun = false): Promise<StorageDriftActionResult> {
  return postJson("/api/storage/drift/recover-unindexed", { relative_path: relativePath, dry_run: dryRun });
}

export async function pruneMissingStorageIndex(relativePath: string, dryRun = false): Promise<StorageDriftActionResult> {
  return postJson("/api/storage/drift/prune-missing-index", { relative_path: relativePath, dry_run: dryRun });
}

export async function quarantineStorageOrphanSidecar(
  relativePath: string,
  dryRun = true,
): Promise<StorageOrphanQuarantineResult> {
  return postJson("/api/storage/orphans/quarantine", { relative_path: relativePath, dry_run: dryRun });
}

export async function getStorageOrphanQuarantine(limit = 100): Promise<StorageQuarantineList> {
  return getJson(`/api/storage/orphans/quarantine?limit=${limit}`);
}

export async function restoreStorageOrphanSidecar(
  quarantineRelativePath: string,
  dryRun = true,
): Promise<StorageQuarantineRestoreResult> {
  return postJson("/api/storage/orphans/quarantine/restore", {
    quarantine_relative_path: quarantineRelativePath,
    dry_run: dryRun,
  });
}

export async function purgeStorageOrphanQuarantine(
  minAgeDays: number,
  dryRun = true,
  confirmText = "",
): Promise<StorageQuarantinePurgeResult> {
  return postJson("/api/storage/orphans/quarantine/purge", {
    min_age_days: minAgeDays,
    dry_run: dryRun,
    confirm_text: confirmText,
  });
}

export async function applyLibraryRescan(): Promise<RescanApplyResult> {
  return postJson("/api/library/_rescan/apply", {});
}

export async function previewArchiveTxt(content: string, channelId?: number | null): Promise<ArchiveTxtPreviewResult> {
  return postJson("/api/imports/archive-txt/preview", { content, channel_id: channelId ?? null });
}

export async function stageArchiveTxt(
  content: string,
  channelId: number,
  quality = "1080p",
  limit = 50,
): Promise<ArchiveTxtStageResult> {
  return postJson("/api/imports/archive-txt/stage", {
    content,
    channel_id: channelId,
    quality,
    limit,
    create_candidates: true,
  });
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  return readJsonResponse<T>(response);
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJsonResponse<T>(response);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJsonResponse<T>(response);
}

async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  return readJsonResponse<T>(response);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Request failed with ${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      }
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}
