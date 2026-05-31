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
  first_video_published_at: string | null;
  latest_video_published_at: string | null;
  avg_upload_interval_days: number | null;
  typical_upload_dow: number | null;
  typical_upload_hour: number | null;
  updated_at: string;
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
  status: "running" | "completed" | "failed" | string;
  started_at: string;
  completed_at: string | null;
  videos_seen: number;
  videos_created: number;
  error_message: string | null;
  created_at: string;
};

export type ChannelSyncResult = {
  job: SyncJob;
  channel: RegisteredChannel;
  videos_seen: number;
  videos_created: number;
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
  skipped_reason: string | null;
  duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type DownloadCandidateResult = {
  channel: RegisteredChannel;
  candidates_created: number;
  total_candidates: number;
  jobs: DownloadJob[];
};

export type ArchiveEvent = {
  type: string;
  data: Record<string, unknown>;
  occurred_at: string;
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
  download_dir: string;
  metadata_dir: string;
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
  binaries: BinaryHealth[];
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

export async function probeChannel(payload: ChannelRegistrationPayload): Promise<ChannelProbeResult> {
  return postJson("/api/channels/_probe", payload);
}

export async function registerChannel(payload: ChannelRegistrationPayload): Promise<ChannelRegistrationResult> {
  return postJson("/api/channels", payload);
}

export async function getChannel(channelId: number): Promise<ChannelDetail> {
  return getJson(`/api/channels/${channelId}`);
}

export async function getChannelVideos(channelId: number): Promise<ChannelVideo[]> {
  return getJson(`/api/channels/${channelId}/videos`);
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

export async function createDownloadCandidates(channelId: number, quality: string): Promise<DownloadCandidateResult> {
  return postJson(`/api/channels/${channelId}/downloads/candidates`, { quality, limit: 50 });
}

export async function enqueueVideoDownload(videoId: number, quality: string): Promise<{ job: DownloadJob }> {
  return postJson(`/api/videos/${videoId}/download`, { quality });
}

export async function getDownloadJobs(channelId?: number): Promise<DownloadJob[]> {
  const query = typeof channelId === "number" ? `?channel_id=${channelId}` : "";
  return getJson(`/api/jobs/downloads${query}`);
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

export async function getRecentEvents(): Promise<ArchiveEvent[]> {
  return getJson("/api/events/recent");
}

export async function getDashboard(): Promise<DashboardSnapshot> {
  return getJson("/api/dashboard");
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

export async function getLibraryFiles(videoId: number): Promise<LibraryFile[]> {
  return getJson(`/api/library/${videoId}/files`);
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  return getJson("/api/settings/runtime");
}

export async function applyLibraryRescan(): Promise<RescanApplyResult> {
  return postJson("/api/library/_rescan/apply", {});
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
