import { expect, type Page, test } from "@playwright/test";

const now = new Date("2026-06-30T12:00:00.000Z").toISOString();
const channelId = 22;

const probe = {
  title: "Wingnut Archive Lab",
  external_id: "UCmLADXQtWVuzOnOK5TNrWaw",
  handle: "@wingnut987s4",
  source_url: "https://www.youtube.com/@wingnut987s4",
  channel_url: "https://www.youtube.com/channel/UCmLADXQtWVuzOnOK5TNrWaw",
  description: "Mocked first backup probe.",
  thumbnail_url: null,
  banner_url: null,
  follower_count: 42_000,
  video_count: 3,
  videos: [
    {
      external_id: "wingnut001",
      title: "The first vault pass",
      url: "https://www.youtube.com/watch?v=wingnut001",
      duration_seconds: 612,
      thumbnail_url: null,
      published_at: now,
      upload_date: "20260630",
    },
    {
      external_id: "wingnut002",
      title: "Folder structure for creators",
      url: "https://www.youtube.com/watch?v=wingnut002",
      duration_seconds: 845,
      thumbnail_url: null,
      published_at: now,
      upload_date: "20260629",
    },
    {
      external_id: "wingnut003",
      title: "Safety check before download",
      url: "https://www.youtube.com/watch?v=wingnut003",
      duration_seconds: 488,
      thumbnail_url: null,
      published_at: now,
      upload_date: "20260628",
    },
  ],
  storage_forecast: {
    video_count: 3,
    max_quality: "1080p",
    audio_only: false,
    estimated_bytes: 3_600_000_000,
    estimated_label: "3.4 GB",
    confidence: "medium",
  },
  folder_preview: {
    root: "/tmp/channel-vault-nas-e2e/archive",
    channel_dir: "channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]",
    example_video_dir: "channels/@wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/2026/The first vault pass [wingnut001]",
    sidecars: ["video.info.json", "thumbnail.jpg", "video.ko.srt", "video.nfo"],
  },
  already_registered: false,
  existing_channel_id: null,
  normalized: {
    original: "https://www.youtube.com/@wingnut987s4",
    source_type: "channel",
    identifier_type: "handle",
    identifier: "@wingnut987s4",
    canonical_url: "https://www.youtube.com/@wingnut987s4",
    probe_url: "https://www.youtube.com/@wingnut987s4/videos",
    tracking_query_removed: false,
  },
};

const channel = {
  id: channelId,
  title: probe.title,
  external_id: probe.external_id,
  handle: probe.handle,
  source_url: probe.source_url,
  video_count: 3,
  archived_count: 0,
  missing_count: 3,
  status: "active",
  created_at: now,
  description: probe.description,
  thumbnail_url: null,
  banner_url: null,
  follower_count: probe.follower_count,
  last_synced_at: now,
  sync_interval_minutes: 360,
  next_sync_due_at: null,
  last_auto_synced_at: null,
  last_auto_sync_status: null,
  last_auto_candidates_created: 0,
  first_video_published_at: now,
  latest_video_published_at: now,
  avg_upload_interval_days: 7,
  typical_upload_dow: 2,
  typical_upload_hour: 21,
  updated_at: now,
};

const jobs = probe.videos.slice(0, 2).map((video, index) => ({
  id: 900 + index,
  video_id: 700 + index,
  video_external_id: video.external_id,
  video_title: video.title,
  channel_id: channelId,
  channel_title: probe.title,
  status: "candidate",
  progress: 0,
  quality: "1080p",
  priority: 80,
  preflight_status: "ready",
  estimated_bytes: 1_200_000_000,
  preflight_checked_at: now,
  error_message: null,
  attempt_count: 0,
  archive_path: `${probe.folder_preview.channel_dir}/2026/${video.title} [${video.external_id}]`,
  started_at: null,
  completed_at: null,
  created_at: now,
  updated_at: now,
}));

function workerPlan(enabled: boolean) {
  return {
    enabled,
    dry_run: !enabled,
    channel_id: channelId,
    limit: 5,
    queued_count: 0,
    claimable_count: enabled ? jobs.length : 0,
    running_count: 0,
    locked_reason: enabled ? null : "CVN_DOWNLOAD_WORKER_ENABLED=false",
    running_jobs: [],
    jobs: enabled
      ? jobs.map((job) => ({
          job,
          archive_dir: `/archive/${job.archive_path}`,
          output_template: "video.%(ext)s",
          command_preview: `yt-dlp --no-overwrites -f 1080p ${probe.videos.find((video) => video.external_id === job.video_external_id)?.url}`,
          status_note: "ready for confirmation",
        }))
      : [],
  };
}

function emptyDashboard() {
  return {
    coverage: { source: 0, archived: 0, missing: 0, removed_saved: 0, percent: 0 },
    fidelity: { info_json: 0, thumbnails: 0, subtitles: 0, nfo: 0 },
    metrics: [],
    channels: [],
    links: [],
    queue: [],
    activity: [],
  };
}

async function setupFirstBackupRoutes(page: Page, options: { workerEnabled: boolean }) {
  const calls: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "ko");
    localStorage.removeItem("cvn.authToken");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/dashboard") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(emptyDashboard()) });
      return;
    }
    if (path === "/api/library/views") {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (path === "/api/events/recent") {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (path === "/api/jobs/downloads" && !url.searchParams.get("channel_id")) {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (path === "/api/jobs/downloads/worker/plan" && !url.searchParams.get("channel_id")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ...workerPlan(true), channel_id: null, claimable_count: 0, jobs: [] }),
      });
      return;
    }
    if (path === "/api/jobs/downloads/worker/runs" && !url.searchParams.get("channel_id")) {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (path === "/api/channels/_probe" && method === "POST") {
      calls.push("probe");
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(probe) });
      return;
    }
    if (path === "/api/channels" && method === "POST") {
      calls.push("register");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ created: true, channel, probe: { ...probe, already_registered: true, existing_channel_id: channelId } }),
      });
      return;
    }
    if (path === `/api/channels/${channelId}`) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(channel) });
      return;
    }
    if (path === `/api/channels/${channelId}/policy`) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          channel_id: channelId,
          auto_download: false,
          max_quality: "1080p",
          audio_only: false,
          subtitles_enabled: true,
          subtitle_languages: ["ko"],
          retention_policy: "keep_all",
          worker_paused: false,
          worker_pause_reason: null,
          created_at: now,
          updated_at: now,
        }),
      });
      return;
    }
    if (path === `/api/channels/${channelId}/videos`) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          probe.videos.map((video, index) => ({
            id: 700 + index,
            channel_id: channelId,
            external_id: video.external_id,
            title: video.title,
            url: video.url,
            published_at: video.published_at,
            upload_date: video.upload_date,
            duration_seconds: video.duration_seconds,
            thumbnail_url: null,
            source_state: "available",
            archive_state: "missing",
            info_json_path: null,
            discovered_at: now,
          })),
        ),
      });
      return;
    }
    if (path === `/api/channels/${channelId}/coverage`) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ channel_id: String(channelId), source: 3, archived: 0, missing: 3, removed_saved: 0, percent: 0, updated_at: now }),
      });
      return;
    }
    if (path === `/api/channels/${channelId}/missing`) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(probe.videos.map((video) => ({ id: video.external_id, title: video.title, published_at: now, source_state: "available", reason: "not_backed_up" }))),
      });
      return;
    }
    if (path === `/api/channels/${channelId}/cadence`) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          channel_id: String(channelId),
          first_video_published_at: now,
          latest_video_published_at: now,
          avg_upload_interval_days: 7,
          typical_upload_dow: 2,
          typical_upload_hour: 21,
          next_expected_at: now,
          buckets: [{ dow: 2, label: "화", count: 3, typical_hour: 21 }],
        }),
      });
      return;
    }
    if (path === `/api/channels/${channelId}/sync` && method === "POST") {
      calls.push("sync");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          job: {
            id: 81,
            channel_id: channelId,
            channel_title: probe.title,
            trigger: "manual",
            status: "completed",
            started_at: now,
            completed_at: now,
            videos_seen: 3,
            videos_created: 3,
            videos_enriched: 3,
            candidates_created: 0,
            error_message: null,
            created_at: now,
          },
          channel,
          videos_seen: 3,
          videos_created: 3,
          videos_enriched: 3,
          candidates_created: 0,
        }),
      });
      return;
    }
    if (path === `/api/channels/${channelId}/downloads/candidates` && method === "POST") {
      calls.push("candidates");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ channel, candidates_created: jobs.length, total_candidates: jobs.length, jobs }),
      });
      return;
    }
    if (path === "/api/jobs/sync" && url.searchParams.get("channel_id") === String(channelId)) {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (path === "/api/jobs/downloads" && url.searchParams.get("channel_id") === String(channelId)) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(jobs) });
      return;
    }
    if (path === "/api/library" && url.searchParams.get("channel_id") === String(channelId)) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 3, archived: 0, missing: 3, queued: 0, total_bytes: 0, total_label: "0 MB" }),
      });
      return;
    }
    if (path === "/api/jobs/downloads/worker/plan" && url.searchParams.get("channel_id") === String(channelId)) {
      calls.push("worker-plan");
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(workerPlan(options.workerEnabled)) });
      return;
    }
    if (path === "/api/jobs/downloads/worker/runs" && url.searchParams.get("channel_id") === String(channelId)) {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    if (path === "/api/jobs/downloads/worker/run-once" && method === "POST") {
      calls.push("worker-run");
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ enabled: true, dry_run: false, started: 0, completed: 0, failed: 0, skipped_reason: null, plan: workerPlan(true), jobs: [] }) });
      return;
    }
    await route.continue();
  });
  return calls;
}

test("first backup wizard analyzes a channel and opens confirmation without running downloads", async ({ page }) => {
  const calls = await setupFirstBackupRoutes(page, { workerEnabled: true });

  await page.goto("/");

  const wizard = page.getByLabel("첫 채널 백업");
  await expect(wizard).toBeVisible();
  await wizard.getByLabel("YouTube 채널 URL, 핸들, 채널 ID").fill("https://youtube.com/@wingnut987s4?si=LZr7f3vNJZsuoRo1");
  await wizard.getByRole("button", { name: "채널 분석" }).click();

  await expect(wizard).toContainText("Wingnut Archive Lab");
  await expect(wizard).toContainText("백업할 영상");
  await expect(wizard).toContainText("3.4 GB");
  await expect(wizard).toContainText("/downfolder/channels/@wingnut987s4");
  await expect(wizard).toContainText("The first vault pass");
  await expect(wizard).toContainText("안전 확인");

  await wizard.getByRole("button", { name: "첫 채널 백업 시작" }).click();

  const confirm = page.getByLabel("새 영상만 다운로드");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "최대 5개 시작" })).toBeEnabled();
  expect(calls.filter((call) => call !== "probe").slice(0, 4)).toEqual(["register", "sync", "candidates", "worker-plan"]);
  expect(calls).not.toContain("worker-run");
});

test("first backup confirmation stays locked when the download engine is disabled", async ({ page }) => {
  const calls = await setupFirstBackupRoutes(page, { workerEnabled: false });

  await page.goto("/");

  const wizard = page.getByLabel("첫 채널 백업");
  await wizard.getByLabel("YouTube 채널 URL, 핸들, 채널 ID").fill("UCmLADXQtWVuzOnOK5TNrWaw");
  await wizard.getByRole("button", { name: "채널 분석" }).click();
  await expect(wizard).toContainText("Wingnut Archive Lab");
  await wizard.getByRole("button", { name: "첫 채널 백업 시작" }).click();

  const confirm = page.getByLabel("새 영상만 다운로드");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "최대 5개 시작" })).toBeDisabled();
  await expect(confirm.getByRole("button", { name: "다운로드 설정 열기" })).toBeVisible();
  expect(calls).not.toContain("worker-run");
});
