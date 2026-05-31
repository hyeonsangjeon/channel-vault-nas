import { expect, type Page, test } from "@playwright/test";

function watchBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openKoreanVault(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "ko");
  });
  await page.route("**/api/dashboard", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    if (Array.isArray(payload.channels)) {
      payload.channels.sort((left: { id: string }, right: { id: string }) => {
        if (left.id === "c1") return -1;
        if (right.id === "c1") return 1;
        return left.id.localeCompare(right.id);
      });
    }
    await route.fulfill({ response, json: payload });
  });
  await page.goto("/");
  await expect(page.getByText("Signal Lab").first()).toBeVisible();
  await expect(page.getByText("런타임 설정")).toBeVisible();
  await expect(page.locator(".runtime-card").filter({ hasText: "스케줄러" })).toContainText("스케줄러 비활성");
  await expect(page.locator(".runtime-card").filter({ hasText: "yt-dlp" })).toBeVisible();
  await expect(page.locator(".runtime-card").filter({ hasText: "ffprobe" })).toBeVisible();
  await expect(page.getByText("아카이브 런치 컨트롤")).toBeVisible();
  await expect(page.getByText("인덱스된 미디어 선반")).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("registration command bar can probe and commit without external YouTube calls", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  const probe = {
    title: "E2E Vault Signal",
    external_id: "UC_CVN_E2E",
    handle: "@e2evault",
    source_url: "https://www.youtube.com/@e2evault",
    channel_url: "https://www.youtube.com/channel/UC_CVN_E2E",
    description: "Mocked registration probe for the browser smoke rail.",
    thumbnail_url: null,
    banner_url: null,
    follower_count: 1200,
    video_count: 3,
    videos: [
      {
        external_id: "cvnE2E01",
        title: "Golden hour archive",
        url: "https://www.youtube.com/watch?v=cvnE2E01",
        duration_seconds: 672,
        thumbnail_url: null,
        published_at: new Date().toISOString(),
        upload_date: "20260529",
      },
    ],
    storage_forecast: {
      video_count: 3,
      max_quality: "1080p",
      audio_only: false,
      estimated_bytes: 2_250_000_000,
      estimated_label: "2.1 GB",
      confidence: "medium",
    },
    folder_preview: {
      root: "/tmp/channel-vault-nas-e2e/archive",
      channel_dir: "channels/@e2evault [UC_CVN_E2E]",
      example_video_dir: "channels/@e2evault [UC_CVN_E2E]/2026/Golden hour archive [cvnE2E01]",
      sidecars: ["video.info.json", "thumbnail.jpg", "video.nfo"],
    },
    already_registered: true,
    existing_channel_id: 1,
    normalized: {
      original: "https://www.youtube.com/@e2evault",
      source_type: "channel",
      identifier_type: "handle",
      identifier: "@e2evault",
      canonical_url: "https://www.youtube.com/@e2evault",
      probe_url: "https://www.youtube.com/@e2evault/videos",
      tracking_query_removed: false,
    },
  };

  await page.route("**/api/channels/_probe", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(probe) });
  });
  await page.route("**/api/channels", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        created: false,
        channel: {
          id: 1,
          title: "Signal Lab",
          external_id: "UC_CVN_E2E",
          handle: "@signalvaultlab",
          source_url: "https://www.youtube.com/@signalvaultlab",
          video_count: 3,
          archived_count: 1,
          missing_count: 2,
          status: "active",
          created_at: new Date().toISOString(),
        },
        probe,
      }),
    });
  });

  await openKoreanVault(page);
  await page.getByLabel("채널 URL 또는 ID").fill("https://www.youtube.com/@e2evault");
  await page.getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByText("E2E Vault Signal").first()).toBeVisible();
  await page.getByRole("button", { name: "점화하기" }).click();
  await expect(page.getByRole("button", { name: "등록 완료" })).toBeVisible();
  await expect(page.getByText("다운로드 파동을 드라이런")).toBeVisible();
  expect(errors).toEqual([]);
});

test("queue preflight, bulk queueing, library shelf, and rescan apply stay wired", async ({ page }, testInfo) => {
  const errors = watchBrowserErrors(page);

  await openKoreanVault(page);
  await page.screenshot({ path: testInfo.outputPath("runtime-console.png"), fullPage: true });
  await page.getByRole("button", { name: "Env 가이드" }).click();
  const runtimeGuide = page.getByLabel("런타임 env 매니페스트");
  await expect(runtimeGuide).toBeVisible();
  await expect(runtimeGuide.locator("strong", { hasText: "CVN_DOWNLOAD_WORKER_ENABLED" })).toBeVisible();
  await expect(runtimeGuide.getByText("다음 tick")).toBeVisible();
  await runtimeGuide.getByRole("button", { name: "매니페스트 복사" }).click();
  await expect(runtimeGuide.getByText("복사됨")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("runtime-env-guide.png"), fullPage: true });
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByText("Queue calibration pass").first()).toBeVisible();
  await expect(page.getByText("Golden hour archive").first()).toBeVisible();
  await page.locator(".library-preset-group").getByRole("button", { name: "1080p h264" }).click();
  await expect(page.locator(".library-card").filter({ hasText: "Golden hour archive" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("library-filtered.png"), fullPage: true });
  await page.locator(".library-card").filter({ hasText: "Golden hour archive" }).click();
  await expect(page.getByLabel("미디어 파일 상세")).toBeVisible();
  await expect(page.locator(".library-file-card").first()).toContainText("1080p");
  await expect(page.locator(".library-sidecar-grid").first()).toContainText("자막");
  await page.screenshot({ path: testInfo.outputPath("library-detail.png"), fullPage: true });
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByText("워커 관제실")).toBeVisible();
  await expect(page.getByText("잠김").first()).toBeVisible();
  await page.getByRole("button", { name: "워커 정지" }).click();
  await expect(page.getByRole("button", { name: "워커 재개" })).toBeVisible();
  await page.getByRole("button", { name: "워커 재개" }).click();
  await expect(page.getByRole("button", { name: "워커 정지" })).toBeVisible();
  const workerRun = page.waitForResponse(
    (response) => response.url().endsWith("/api/jobs/downloads/worker/run-once") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "드라이런" }).click();
  const workerRunPayload = (await (await workerRun).json()) as { dry_run: boolean; started: number };
  expect(workerRunPayload.dry_run).toBe(true);
  expect(workerRunPayload.started).toBe(0);
  await expect(page.getByText("최근 워커 실행")).toBeVisible();
  await expect(page.locator(".worker-run-ledger").getByText("locked").first()).toBeVisible();
  await page.locator(".worker-run-ledger").getByRole("button", { name: "열기" }).click();
  await expect(page.getByLabel("워커 히스토리")).toBeVisible();
  await page.locator(".worker-history-filters").getByRole("button", { name: "드라이런" }).click();
  await expect(page.locator(".worker-history-card").first()).toContainText("locked");
  await page.screenshot({ path: testInfo.outputPath("worker-history.png"), fullPage: true });
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "프리플라이트" }).click();
  await expect(page.locator(".command-lines code").filter({ hasText: "yt-dlp" }).first()).toBeVisible();
  await expect(page.locator(".preflight-pill.ready").first()).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("launch-control.png"), fullPage: true });

  const bulkResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/jobs/downloads/bulk") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "선택 큐 등록" }).click();
  const bulkPayload = (await (await bulkResponse).json()) as { updated: number };
  expect(bulkPayload.updated).toBe(2);

  const rescanResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/library/_rescan/apply") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "가져오기 계획 검토" }).click();
  const rescanPayload = (await (await rescanResponse).json()) as {
    candidates_seen: number;
    media_files_indexed: number;
    videos_created: number;
  };
  expect(rescanPayload.candidates_seen).toBeGreaterThanOrEqual(2);
  if (testInfo.project.name === "chromium") {
    expect(rescanPayload.media_files_indexed).toBe(1);
    expect(rescanPayload.videos_created).toBe(1);
  }
  await expect(page.getByText(/NAS rescan 인덱싱/).first()).toBeVisible();
  await expect(page.getByText(/\d+파일/).first()).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("rescan-apply.png"), fullPage: true });
  expect(errors).toEqual([]);
});
