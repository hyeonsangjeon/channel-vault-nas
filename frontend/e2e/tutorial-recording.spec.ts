import { test, type Browser, type Page } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const enabled = process.env.CVN_RECORD_TUTORIAL === "true";
const frontendPort = process.env.CVN_E2E_FRONTEND_PORT ?? "5174";
const base = process.env.CVN_TUT_FRONTEND_URL ?? `http://127.0.0.1:${frontendPort}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.CVN_TUT_OUT ?? resolve(__dirname, "../../test-results/tutorial"));
const overlaySrc = readFileSync(resolve(__dirname, "tutorial/overlay.js"), "utf8");

const W = 1440;
const H = 1000;

// Visual target durations (seconds) — must match final-plan.json.
const DUR: Record<string, number> = {
  "01-intro": 16,
  "02-install": 30,
  "03-firstrun": 27,
  "03b-overview": 27,
  "04-register": 44,
  "05-progress": 56,
  "06-library": 36,
  "07-insights": 34,
  "08-settings": 26,
  "09-outro": 18,
};

test.skip(!enabled, "Set CVN_RECORD_TUTORIAL=true to record the tutorial segments.");
test.setTimeout(900_000);

async function newRec(browser: Browser, lang: string) {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: W, height: H },
    recordVideo: { dir: outDir, size: { width: W, height: H } },
  });
  await context.addInitScript((l) => localStorage.setItem("channel-vault-language", l), lang);
  await context.addInitScript({ content: overlaySrc });
  const page = await context.newPage();
  return { context, page };
}

async function install(page: Page) {
  await page.evaluate(() => (window as unknown as { __cvnInstallOverlay: () => void }).__cvnInstallOverlay());
}

async function finish(page: Page, context: import("@playwright/test").BrowserContext, id: string, startedAt: number) {
  const targetMs = DUR[id] * 1000;
  const elapsed = Date.now() - startedAt;
  const pad = targetMs - elapsed + 900;
  if (pad > 0) await page.waitForTimeout(pad);
  const video = page.video();
  await page.close();
  await context.close();
  const p = await video?.path();
  if (!p) throw new Error(`no video for ${id}`);
  const dest = resolve(outDir, `${id}.webm`);
  copyFileSync(p, dest);
  // eslint-disable-next-line no-console
  console.log(`SEGMENT ${id} -> ${dest}`);
}

async function goto(page: Page, hash: string) {
  await page.goto(`${base}/${hash}`);
  await page.waitForTimeout(500);
  await install(page);
}

// --------------------------------------------------------------------------
// First-backup wizard mock. Drives the wizard end-to-end (analyze -> plan ->
// confirmation) with deterministic data so the recording never touches YouTube
// and never runs a real download. Worker is presented as armed so the plan and
// the confirmation dialog read consistently. Mirrors e2e/first-backup-wizard.spec.ts.
const backendPort = process.env.CVN_E2E_BACKEND_PORT ?? "8011";
const backendUrl = `http://127.0.0.1:${backendPort}`;
const NOW = new Date("2026-06-30T12:00:00.000Z").toISOString();
const WIZ_CHANNEL_ID = 22;

const wizProbe = {
  title: "Wingnut Archive Lab",
  external_id: "UCwn0310ArchiveLab00001",
  handle: "@wingnut0310",
  source_url: "https://www.youtube.com/@wingnut0310",
  channel_url: "https://www.youtube.com/channel/UCwn0310ArchiveLab00001",
  description: "Your own channel, ready to archive.",
  thumbnail_url: null,
  banner_url: null,
  follower_count: 42_000,
  video_count: 3,
  videos: [
    { external_id: "wingnut001", title: "The first vault pass", url: "https://www.youtube.com/watch?v=wingnut001", duration_seconds: 612, thumbnail_url: null, published_at: NOW, upload_date: "20260630" },
    { external_id: "wingnut002", title: "Folder structure for creators", url: "https://www.youtube.com/watch?v=wingnut002", duration_seconds: 845, thumbnail_url: null, published_at: NOW, upload_date: "20260629" },
    { external_id: "wingnut003", title: "Safety check before download", url: "https://www.youtube.com/watch?v=wingnut003", duration_seconds: 488, thumbnail_url: null, published_at: NOW, upload_date: "20260628" },
  ],
  storage_forecast: { video_count: 3, max_quality: "1080p", audio_only: false, estimated_bytes: 3_600_000_000, estimated_label: "3.4 GB", confidence: "medium" },
  folder_preview: {
    root: "/downfolder/archive",
    channel_dir: "channels/@wingnut0310 [UCwn0310ArchiveLab00001]",
    example_video_dir: "channels/@wingnut0310 [UCwn0310ArchiveLab00001]/2026/The first vault pass [wingnut001]",
    sidecars: ["video.info.json", "thumbnail.jpg", "video.en.srt", "video.nfo"],
  },
  already_registered: false,
  existing_channel_id: null,
  normalized: {
    original: "https://www.youtube.com/@wingnut0310",
    source_type: "channel",
    identifier_type: "handle",
    identifier: "@wingnut0310",
    canonical_url: "https://www.youtube.com/@wingnut0310",
    probe_url: "https://www.youtube.com/@wingnut0310/videos",
    tracking_query_removed: false,
  },
};

const wizChannel = {
  id: WIZ_CHANNEL_ID, title: wizProbe.title, external_id: wizProbe.external_id, handle: wizProbe.handle,
  source_url: wizProbe.source_url, video_count: 3, archived_count: 0, missing_count: 3, status: "active",
  created_at: NOW, description: wizProbe.description, thumbnail_url: null, banner_url: null,
  follower_count: wizProbe.follower_count, last_synced_at: NOW, sync_interval_minutes: 360, next_sync_due_at: null,
  last_auto_synced_at: null, last_auto_sync_status: null, last_auto_candidates_created: 0,
  first_video_published_at: NOW, latest_video_published_at: NOW, avg_upload_interval_days: 7,
  typical_upload_dow: 2, typical_upload_hour: 21, updated_at: NOW,
};

const wizJobs = wizProbe.videos.slice(0, 2).map((video, index) => ({
  id: 900 + index, video_id: 700 + index, video_external_id: video.external_id, video_title: video.title,
  channel_id: WIZ_CHANNEL_ID, channel_title: wizProbe.title, status: "candidate", progress: 0, quality: "1080p",
  priority: 80, preflight_status: "ready", estimated_bytes: 1_200_000_000, preflight_checked_at: NOW,
  error_message: null, attempt_count: 0, archive_path: `${wizProbe.folder_preview.channel_dir}/2026/${video.title} [${video.external_id}]`,
  started_at: null, completed_at: null, created_at: NOW, updated_at: NOW,
}));

function wizWorkerPlan() {
  return {
    enabled: true, dry_run: false, channel_id: WIZ_CHANNEL_ID, limit: 5, queued_count: 0,
    claimable_count: wizJobs.length, running_count: 0, locked_reason: null, running_jobs: [],
    jobs: wizJobs.map((job) => ({
      job, archive_dir: `/archive/${job.archive_path}`, output_template: "video.%(ext)s",
      command_preview: `yt-dlp --no-overwrites -f 1080p ${wizProbe.videos.find((v) => v.external_id === job.video_external_id)?.url}`,
      status_note: "ready for confirmation",
    })),
  };
}

const wizEmptyDashboard = {
  coverage: { source: 0, archived: 0, missing: 0, removed_saved: 0, percent: 0 },
  fidelity: { info_json: 0, thumbnails: 0, subtitles: 0, nfo: 0 },
  metrics: [], channels: [], links: [], queue: [], activity: [],
};

async function json(route: import("@playwright/test").Route, body: unknown) {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
}

// Full wizard interception: empty dashboard first-run + deterministic probe/plan.
async function setupWizardMock(page: Page) {
  await page.addInitScript(() => localStorage.removeItem("cvn.authToken"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const cid = url.searchParams.get("channel_id");

    if (path === "/api/dashboard") return json(route, wizEmptyDashboard);
    if (path === "/api/channels" && method === "GET") return json(route, []);
    if (path === "/api/library/views") return json(route, []);
    if (path === "/api/events/recent") return json(route, []);
    if (path === "/api/jobs/downloads" && !cid) return json(route, []);
    if (path === "/api/jobs/downloads/worker/plan" && !cid)
      return json(route, { ...wizWorkerPlan(), channel_id: null, claimable_count: 0, jobs: [] });
    if (path === "/api/jobs/downloads/worker/runs") return json(route, []);
    if (path === "/api/channels/_probe" && method === "POST") return json(route, wizProbe);
    if (path === "/api/channels" && method === "POST")
      return json(route, { created: true, channel: wizChannel, probe: { ...wizProbe, already_registered: true, existing_channel_id: WIZ_CHANNEL_ID } });
    if (path === `/api/channels/${WIZ_CHANNEL_ID}` && method === "GET") return json(route, wizChannel);
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/policy`)
      return json(route, { channel_id: WIZ_CHANNEL_ID, auto_download: false, max_quality: "1080p", audio_only: false, subtitles_enabled: true, subtitle_languages: ["en"], retention_policy: "keep_all", worker_paused: false, worker_pause_reason: null, created_at: NOW, updated_at: NOW });
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/videos`)
      return json(route, wizProbe.videos.map((video, index) => ({ id: 700 + index, channel_id: WIZ_CHANNEL_ID, external_id: video.external_id, title: video.title, url: video.url, published_at: video.published_at, upload_date: video.upload_date, duration_seconds: video.duration_seconds, thumbnail_url: null, source_state: "available", archive_state: "missing", info_json_path: null, discovered_at: NOW })));
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/coverage`)
      return json(route, { channel_id: String(WIZ_CHANNEL_ID), source: 3, archived: 0, missing: 3, removed_saved: 0, percent: 0, updated_at: NOW });
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/missing`)
      return json(route, wizProbe.videos.map((video) => ({ id: video.external_id, title: video.title, published_at: NOW, source_state: "available", reason: "not_backed_up" })));
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/cadence`)
      return json(route, { channel_id: String(WIZ_CHANNEL_ID), first_video_published_at: NOW, latest_video_published_at: NOW, avg_upload_interval_days: 7, typical_upload_dow: 2, typical_upload_hour: 21, next_expected_at: NOW, buckets: [{ dow: 2, label: "Tue", count: 3, typical_hour: 21 }] });
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/sync` && method === "POST")
      return json(route, { job: { id: 81, channel_id: WIZ_CHANNEL_ID, channel_title: wizProbe.title, trigger: "manual", status: "completed", started_at: NOW, completed_at: NOW, videos_seen: 3, videos_created: 3, videos_enriched: 3, candidates_created: 0, error_message: null, created_at: NOW }, channel: wizChannel, videos_seen: 3, videos_created: 3, videos_enriched: 3, candidates_created: 0 });
    if (path === `/api/channels/${WIZ_CHANNEL_ID}/downloads/candidates` && method === "POST")
      return json(route, { channel: wizChannel, candidates_created: wizJobs.length, total_candidates: wizJobs.length, jobs: wizJobs });
    if (path === "/api/jobs/sync" && cid === String(WIZ_CHANNEL_ID)) return json(route, []);
    if (path === "/api/jobs/downloads" && cid === String(WIZ_CHANNEL_ID)) return json(route, wizJobs);
    if (path === "/api/library" && cid === String(WIZ_CHANNEL_ID))
      return json(route, { items: [], total: 3, archived: 0, missing: 3, queued: 0, total_bytes: 0, total_label: "0 MB" });
    if (path === "/api/jobs/downloads/worker/plan" && cid === String(WIZ_CHANNEL_ID)) return json(route, wizWorkerPlan());
    await route.continue();
  });
}

// Present the download worker as armed for the queue scene so the visible worker
// state stays consistent with the guarded pass shown in the overlay. Keeps the
// real seeded queue data; only flips the enabled flags in-place.
async function armWorkerForQueue(page: Page) {
  await page.route("**/api/settings/runtime", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const resp = await route.fetch();
      const data = await resp.json();
      data.download_worker_enabled = true;
      data.pending_restart = false;
      await route.fulfill({ response: resp, json: data });
    } catch {
      await route.continue();
    }
  });
  await page.route("**/api/jobs/downloads/worker/plan**", async (route) => {
    try {
      const resp = await route.fetch();
      const data = await resp.json();
      data.enabled = true;
      data.dry_run = false;
      data.locked_reason = null;
      await route.fulfill({ response: resp, json: data });
    } catch {
      await route.continue();
    }
  });
}

async function seedDemoWorkspace() {
  const res = await fetch(`${backendUrl}/api/ops/demo-workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`demo seed failed: ${res.status}`);
  // eslint-disable-next-line no-console
  console.log("SEED demo workspace ->", res.status);
}

async function analyzeChannel(page: Page) {
  await page.getByText("Start your first channel backup").first().waitFor({ timeout: 15000 });
  const input = page.locator(".first-backup-command input").first();
  await input.click();
  await input.fill("");
  await input.pressSequentially("https://www.youtube.com/@wingnut0310", { delay: 42 });
  await page.locator('.first-backup-command button[type="submit"]').first().click();
  await page.locator(".first-backup-plan.ready").first().waitFor({ timeout: 15000 });
}


test("record tutorial segments", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });

  // ---- 03-firstrun (first backup wizard: paste channel -> Analyze) -------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await setupWizardMock(page);
    await goto(page, "#/dashboard");
    await page.getByText("Start your first channel backup").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const el = document.querySelector(".first-backup-command input");
      if (el) (el as HTMLElement).id = "cvn-anchor-src";
      const btn = document.querySelector('.first-backup-command button[type="submit"]');
      if (btn) (btn as HTMLElement).id = "cvn-anchor-analyze";
    });
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(2);
      await c.__cvn.moveToSel("#cvn-anchor-src", 1000);
      c.__cvn.ringSel("#cvn-anchor-src", 6, 12);
    });
    const input = page.locator("#cvn-anchor-src");
    await input.click();
    await input.fill("");
    await page.waitForTimeout(150);
    await input.pressSequentially("https://www.youtube.com/@wingnut0310", { delay: 45 });
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      await c.__cvn.moveToSel("#cvn-anchor-analyze", 850);
      c.__cvn.ringSel("#cvn-anchor-analyze", 6, 12);
      await c.__cvn.sleep(500);
      c.__cvn.ripple();
    });
    await page.locator("#cvn-anchor-analyze").click();
    await page.locator(".first-backup-plan.ready").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    // reveal the demoted "Safe demo" secondary panel to show it is optional
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const sec = document.querySelector(".first-backup-secondary") as HTMLElement | null;
      if (sec) {
        sec.setAttribute("open", "");
        const sum = sec.querySelector("summary") as HTMLElement | null;
        if (sum) {
          sum.id = "cvn-anchor-secondary";
          sum.scrollIntoView({ block: "center", behavior: "smooth" });
          await c.__cvn.sleep(500);
          await c.__cvn.moveToSel("#cvn-anchor-secondary", 900);
          c.__cvn.ringSel("#cvn-anchor-secondary", 6, 12);
        }
      }
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "03-firstrun", t);
  }

  // ---- 03b-overview (first backup wizard: plan review) ------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await setupWizardMock(page);
    await goto(page, "#/dashboard");
    await analyzeChannel(page);
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(null);
      const plan = document.querySelector(".first-backup-plan.ready") as HTMLElement | null;
      if (plan) plan.scrollIntoView({ block: "center", behavior: "smooth" });
      await c.__cvn.sleep(700);
      // pan across the four plan metrics
      const metrics = Array.from(document.querySelectorAll(".first-backup-metrics article")).slice(0, 4);
      for (const m of metrics) {
        (m as HTMLElement).id = (m as HTMLElement).id || "cvn-m-" + Math.random().toString(36).slice(2, 7);
        await c.__cvn.moveToSel("#" + (m as HTMLElement).id, 520);
        c.__cvn.ringSel("#" + (m as HTMLElement).id, 6, 12);
        await c.__cvn.sleep(360);
      }
    });
    // rest on the safety check, then the preview list
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const safety = document.querySelector(".first-backup-safety") as HTMLElement | null;
      if (safety) {
        safety.id = "cvn-anchor-safety";
        await c.__cvn.moveToSel("#cvn-anchor-safety", 800);
        c.__cvn.ringSel("#cvn-anchor-safety", 8, 14);
      }
    });
    await page.waitForTimeout(1600);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const list = document.querySelector(".first-backup-video-list") as HTMLElement | null;
      if (list) {
        list.id = "cvn-anchor-preview";
        await c.__cvn.moveToSel("#cvn-anchor-preview", 800);
        c.__cvn.ringSel("#cvn-anchor-preview", 8, 14);
      }
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "03b-overview", t);
  }

  // ---- 04-register (Start first backup -> confirmation dialog) ----------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await setupWizardMock(page);
    await goto(page, "#/dashboard");
    await analyzeChannel(page);
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(3);
      const start = document.querySelector(".first-backup-start") as HTMLElement | null;
      if (start) {
        start.id = "cvn-anchor-start";
        start.scrollIntoView({ block: "center", behavior: "smooth" });
        await c.__cvn.sleep(600);
        await c.__cvn.moveToSel("#cvn-anchor-start", 950);
        c.__cvn.ringSel("#cvn-anchor-start", 6, 12);
        await c.__cvn.sleep(600);
        c.__cvn.ripple();
      }
    });
    await page.locator(".first-backup-start").first().click();
    await page.locator(".download-confirm-modal").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    // point at the guardrail grid (max 5 / skipped / queued)
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const grid = document.querySelector(".download-confirm-grid") as HTMLElement | null;
      if (grid) {
        grid.id = "cvn-anchor-grid";
        await c.__cvn.moveToSel("#cvn-anchor-grid", 800);
        c.__cvn.ringSel("#cvn-anchor-grid", 8, 14);
      }
    });
    await page.waitForTimeout(1400);
    // highlight the "Start up to 5" button (do NOT click — no real download here)
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const btn = document.querySelector(".download-confirm-actions .primary-action") as HTMLElement | null;
      if (btn) {
        btn.id = "cvn-anchor-livestart";
        await c.__cvn.moveToSel("#cvn-anchor-livestart", 900);
        c.__cvn.ringSel("#cvn-anchor-livestart", 6, 12);
        await c.__cvn.sleep(600);
        c.__cvn.ripple();
      }
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "04-register", t);
  }

  // Seed the safe-demo workspace so the tour + bookend screens have live data.
  await seedDemoWorkspace();

  // ---- 05-progress (queue: guarded pass with worker armed) --------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await armWorkerForQueue(page);
    await goto(page, "#/queue?channel=1");
    await page.getByText("Global queue control").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(4);
      const list = document.querySelector(".queue-console, .queue-list, main") as HTMLElement | null;
      if (list) {
        list.id = list.id || "cvn-anchor-queue";
        await c.__cvn.moveToSel("#cvn-anchor-queue", 800);
      }
      await c.__cvn.moveTo(740, 705, 700);
      const card = await c.__cvn.progressCard({
        seconds: 34,
        totalMB: 715,
        title: "Guarded backup pass",
        sub: "1080p · h264/aac · worker armed",
        tag: "Guarded pass · capped at 5 per run · you confirmed this",
        x: 316,
        y: 636,
        w: 862,
      });
      card.id = "cvn-anchor-pc";
      c.__cvn.ringSel("#cvn-anchor-pc", 6, 16);
    });
    await page.waitForTimeout(2200);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "05-progress", t);
  }


  // ---- 06-library -------------------------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/library?channel=1");
    await page.getByText("Indexed media shelf").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(5);
      const card = document.querySelector(".library-grid article, .media-card, .library-card") as HTMLElement | null;
      if (card) {
        card.id = "cvn-anchor-lib";
        await c.__cvn.moveToSel("#cvn-anchor-lib", 1000);
        c.__cvn.ringSel("#cvn-anchor-lib", 8, 14);
      }
    });
    await page.waitForTimeout(2400);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const filters = document.querySelectorAll(".library-filter, .filter-chip, .segmented");
      const el = filters[0] as HTMLElement | undefined;
      if (el) {
        el.id = "cvn-anchor-filter";
        await c.__cvn.moveToSel("#cvn-anchor-filter", 900);
        c.__cvn.ringSel("#cvn-anchor-filter", 8, 12);
      }
    });
    await page.waitForTimeout(2200);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "06-library", t);
  }

  // ---- 07-insights ------------------------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/insights");
    await page.getByRole("heading", { name: "Volume Map" }).first().waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(6);
      const heads = Array.from(document.querySelectorAll("h2,h3"));
      const vm = heads.find((h) => /volume map/i.test(h.textContent || "")) as HTMLElement | undefined;
      const target = vm ? (vm.closest("section,article,.panel") as HTMLElement) || vm : (document.querySelector("main") as HTMLElement);
      if (target) {
        target.id = "cvn-anchor-vm";
        target.scrollIntoView({ block: "center" });
        await c.__cvn.sleep(700);
        await c.__cvn.moveToSel("#cvn-anchor-vm", 1000);
        c.__cvn.ringSel("#cvn-anchor-vm", 10, 16);
      }
    });
    await page.waitForTimeout(3200);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "07-insights", t);
  }

  // ---- 08-settings ------------------------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/settings?runtime=guide");
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(7);
      const cards = Array.from(document.querySelectorAll("*")).filter((e) => /^Schedulers$/i.test((e.textContent || "").trim()) && e.children.length === 0);
      const sched = cards[0] ? ((cards[0].closest("article,section,div") as HTMLElement) || (cards[0] as HTMLElement)) : (document.querySelector("main") as HTMLElement);
      if (sched) {
        sched.id = "cvn-anchor-sched";
        sched.scrollIntoView({ block: "center" });
        await c.__cvn.sleep(600);
        await c.__cvn.moveToSel("#cvn-anchor-sched", 1000);
        c.__cvn.ringSel("#cvn-anchor-sched", 8, 12);
        await c.__cvn.sleep(700);
        c.__cvn.ripple();
      }
    });
    await page.waitForTimeout(2600);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "08-settings", t);
  }

  // ---- 01-intro (title card over dimmed dashboard) ----------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/dashboard?channel=1");
    await page.getByText("archive status").first().waitFor({ timeout: 15000 });
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.titleCard());
    await finish(page, context, "01-intro", t);
  }

  // ---- 02-install (typed terminal) --------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/dashboard?channel=1");
    await page.getByText("archive status").first().waitFor({ timeout: 15000 });
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      await c.__cvn.terminal(
        [
          "$ git clone https://github.com/hyeonsangjeon/channel-vault-nas.git",
          "Cloning into 'channel-vault-nas'...",
          "$ cd channel-vault-nas",
          "$ docker compose pull",
          "$ docker compose up -d",
          " \u2714 Container channel-vault-api   Started",
          " \u2714 Container channel-vault-web   Started",
          "# Open http://127.0.0.1:5173/  in your browser",
        ],
        { typeSpeed: 22, lineDelay: 300 }
      );
    });
    await finish(page, context, "02-install", t);
  }

  // ---- 09-outro (end card) ----------------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/dashboard?channel=1");
    await page.getByText("archive status").first().waitFor({ timeout: 15000 });
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.endCard());
    await finish(page, context, "09-outro", t);
  }
});
