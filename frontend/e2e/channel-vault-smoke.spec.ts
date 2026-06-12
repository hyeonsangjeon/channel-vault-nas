import { expect, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";

test.setTimeout(90_000);

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

async function openKoreanVault(page: Page, path = "/", expectDashboard = true) {
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
  await page.goto(path);
  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
  if (!expectDashboard) return;
  const opsBoard = page.getByLabel("오늘의 아카이브 미션");
  await expect(opsBoard).toContainText("준비도");
  await expect(opsBoard).toContainText("워커가 안전 잠금 상태");
  const releaseReadiness = page.getByLabel("릴리즈 준비 체크리스트");
  await expect(releaseReadiness).toContainText("백업/복구");
  await expect(releaseReadiness).toContainText("Beta 런치 브리핑");
  await expect(releaseReadiness).toContainText("다음 unblock");
  const mountDoctor = page.getByLabel("NAS 볼륨 마운트 진단");
  await expect(mountDoctor).toContainText("NAS 마운트 Doctor");
  await expect(mountDoctor).toContainText("DB");
  await expect(mountDoctor).toContainText("Archive");
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("command palette opens operational surfaces and live status is visible", async ({ page }, testInfo) => {
  const errors = watchBrowserErrors(page);
  await openKoreanVault(page);

  const livePill = page.getByLabel("실시간 이벤트 연결");
  await expect(livePill).toContainText("Live");

  await expect(page.getByText("공개 이슈용 안전 진단")).toBeVisible();
  const supportBundleResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/ops/support-bundle") && response.status() === 200,
  );
  await page.getByRole("button", { name: "지원 번들 복사" }).click();
  const supportBundleResponse = await supportBundleResponsePromise;
  const supportBundle = await supportBundleResponse.json();
  expect(supportBundle.redaction.safe_for_public_issue).toBe(true);
  await expect(page.locator(".support-bundle-source").filter({ hasText: "서버 redacted" })).toBeVisible();
  const releaseReadiness = page.getByLabel("릴리즈 준비 체크리스트");
  const betaProof = page.getByLabel("Beta onboarding proof export");
  await expect(betaProof).toContainText("이 설치가 public-safe인지 증거로 내보내기");
  await expect(betaProof.getByRole("button", { name: "proof 다운로드" })).toBeVisible();
  await betaProof.getByRole("button", { name: "proof 복사" }).click();
  await expect(betaProof.getByRole("button", { name: "proof 복사됨" })).toBeVisible();
  const betaProofText = await page.evaluate(() => navigator.clipboard.readText());
  const betaProofPayload = JSON.parse(betaProofText);
  expect(betaProofPayload.kind).toBe("channel_vault_beta_onboarding_proof");
  expect(betaProofPayload.privacy.redacted_for_public_issue).toBe(true);
  expect(betaProofText).not.toContain("Signal Lab");
  expect(betaProofText).not.toContain("https://");
  expect(betaProofText).not.toContain("/tmp/");
  await releaseReadiness.getByRole("button", { name: "브리핑 복사" }).click();
  await expect(releaseReadiness.getByRole("button", { name: "브리핑 복사됨" })).toBeVisible();
  await releaseReadiness.getByRole("button", { name: "복구 가이드" }).click();
  const runtimeGuideFromReadiness = page.getByLabel("런타임 env 매니페스트");
  await expect(runtimeGuideFromReadiness).toBeVisible();
  const runtimeRailFromReadiness = runtimeGuideFromReadiness.getByLabel("런타임 가이드 섹션");
  await expect(runtimeRailFromReadiness).toContainText("보안");
  await expect(runtimeRailFromReadiness).toContainText("볼륨");
  await expect(runtimeRailFromReadiness).toContainText("백업");
  await runtimeRailFromReadiness.getByRole("button").filter({ hasText: "백업" }).click();
  await expect(runtimeGuideFromReadiness.getByLabel("백업 및 복구 confidence")).toBeVisible();
  await runtimeGuideFromReadiness.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "Command Palette 열기" }).click();
  const palette = page.getByLabel("필요한 운영 화면으로 바로 이동.");
  await expect(palette).toBeVisible();
  await expect(palette).toContainText("소스 등록");
  await palette.getByLabel("운영, 화면, archive 도구 검색").fill("runtime env");
  await expect(palette).toContainText("Runtime env 가이드");
  await palette.getByRole("button").filter({ hasText: "Runtime env 가이드" }).click();

  const runtimeGuide = page.getByLabel("런타임 env 매니페스트");
  await expect(runtimeGuide).toBeVisible();
  const runtimeRail = runtimeGuide.getByLabel("런타임 가이드 섹션");
  await expect(runtimeRail).toContainText("재시작");
  await expect(runtimeRail).toContainText("Scheduler");
  await runtimeRail.getByRole("button").filter({ hasText: "볼륨" }).click();
  await expect(runtimeGuide).toContainText("Compose smoke 검증");
  await expect(runtimeGuide.getByLabel("NAS 볼륨 마운트 cookbook")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("command-palette-runtime-guide.png"), fullPage: true });
  await runtimeGuide.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "Command Palette 열기" }).click();
  const queuePalette = page.getByLabel("필요한 운영 화면으로 바로 이동.");
  await queuePalette.getByLabel("운영, 화면, archive 도구 검색").fill("queue");
  await expect(queuePalette).toContainText("전역 큐 콘솔");
  await page.screenshot({ path: testInfo.outputPath("command-palette-filtered.png"), fullPage: true });
  await queuePalette.getByRole("button").filter({ hasText: "전체 큐 관제" }).click();
  await expect(page.getByLabel("전체 큐 관제")).toBeVisible();

  expect(errors).toEqual([]);
});

test("url hash deep links restore nav and channel tabs", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await openKoreanVault(page, "/#/channels/downloads?channel=1", false);

  const channelTabs = page.getByLabel("채널 상세 탭");
  await expect(channelTabs.getByRole("button", { name: "다운로드" })).toHaveClass(/active/);
  await expect(page.getByText("다운로드 파동을 드라이런")).toBeVisible();
  await expect(page).toHaveTitle("Signal Lab · 다운로드 · Channel Vault NAS");
  await expect(page).toHaveURL(/#\/channels\/downloads\?channel=1/);

  await channelTabs.getByRole("button", { name: "정책" }).click();
  await expect(channelTabs.getByRole("button", { name: "정책" })).toHaveClass(/active/);
  await expect(page).toHaveTitle("Signal Lab · 정책 · Channel Vault NAS");
  await expect(page).toHaveURL(/#\/channels\/policy\?channel=1/);

  await page.getByRole("button", { name: "큐", exact: true }).click();
  await expect(page.getByLabel("전체 큐 관제")).toBeVisible();
  await expect(page).toHaveTitle("전체 큐 관제 · Channel Vault NAS");
  await expect(page).toHaveURL(/#\/queue\?channel=1/);

  await page.goBack();
  await expect(channelTabs.getByRole("button", { name: "정책" })).toHaveClass(/active/);
  await expect(page).toHaveURL(/#\/channels\/policy\?channel=1/);

  expect(errors).toEqual([]);
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
  await page.getByRole("button", { name: "채널", exact: true }).click();
  const registrationInput = page.getByLabel("채널 URL 또는 ID");
  await expect(registrationInput).toBeVisible();
  await registrationInput.fill("https://www.youtube.com/@e2evault");
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(page.getByText("E2E Vault Signal").first()).toBeVisible();
  await page.getByRole("button", { name: "점화하기" }).click();
  await expect(page.getByRole("button", { name: "등록 완료" })).toBeVisible();
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "다운로드" }).click();
  await expect(page.getByText("다운로드 파동을 드라이런")).toBeVisible();
  expect(errors).toEqual([]);
});

test("queue preflight, bulk queueing, library shelf, and rescan apply stay wired", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = watchBrowserErrors(page);
  let globalWorkerPlanOverride = false;
  const enabledGlobalWorkerPlan = {
    enabled: true,
    dry_run: true,
    channel_id: null,
    limit: 5,
    queued_count: 2,
    claimable_count: 1,
    running_count: 0,
    locked_reason: null,
    running_jobs: [],
    jobs: [
      {
        job: {
          id: 700,
          video_id: 2,
          video_external_id: "newArchive02",
          video_title: "Scheduler found this first",
          channel_id: 1,
          channel_title: "Signal Lab",
          status: "queued",
          progress: 0,
          quality: "1080p",
          priority: 95,
          preflight_status: "ready",
          estimated_bytes: 715000000,
          preflight_checked_at: new Date().toISOString(),
          error_message: null,
          attempt_count: 0,
          archive_path: "channels/@signalvaultlab/2026/Scheduler found this first [newArchive02]",
          started_at: null,
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        archive_dir: "archive/channels/@signalvaultlab/2026/Scheduler found this first [newArchive02]",
        output_template: "video.%(ext)s",
        command_preview: "yt-dlp --no-overwrites -f 1080p https://www.youtube.com/watch?v=newArchive02",
        status_note: "ready for confirmation",
      },
    ],
  };

  await page.route("**/api/jobs/downloads/worker/plan?limit=5", async (route) => {
    if (!globalWorkerPlanOverride) {
      await route.continue();
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(enabledGlobalWorkerPlan) });
  });

  await openKoreanVault(page);
  const opsStorageAction = page.getByLabel("오늘의 아카이브 미션").getByRole("button", { name: "스캔 열기" }).first();
  if ((await opsStorageAction.count()) > 0) {
    await opsStorageAction.click();
    await expect(page.locator(".storage-panel")).toBeVisible();
    await page.getByRole("button", { name: "대시보드", exact: true }).click();
  }
  const growthMission = page.getByLabel("오늘의 아카이브 미션").locator(".ops-mission").filter({ hasText: "급증 채널 점검" });
  await expect(growthMission).toBeVisible();
  await growthMission.getByRole("button", { name: "채널 열기" }).click();
  await expect(page.getByLabel("채널 상세 탭").getByRole("button", { name: "라이브러리" })).toBeVisible();
  const growthMissionLens = page.getByLabel("채널 NAS 발자국");
  await expect(growthMissionLens).toBeVisible();
  await expect(growthMissionLens).toContainText("7/30일 성장 비교");
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await page.getByRole("button", { name: "큐", exact: true }).click();
  const queueConsole = page.getByLabel("전체 큐 관제");
  const refreshQueueButton = queueConsole.getByRole("button", { name: "큐 새로고침" }).first();
  const runFiveButton = queueConsole.getByRole("button", { name: "대기 5개 실행" });
  await expect(queueConsole).toBeVisible();
  await expect(refreshQueueButton).toBeVisible();
  await expect(runFiveButton).toBeDisabled();
  globalWorkerPlanOverride = true;
  await refreshQueueButton.click();
  await expect(runFiveButton).toBeEnabled();
  await runFiveButton.click();
  const queueConfirm = page.getByLabel("전역 큐 실행 확인");
  await expect(queueConfirm).toBeVisible();
  await expect(queueConfirm).toContainText("명령 미리보기");
  await expect(queueConfirm).toContainText("Scheduler found this first");
  await queueConfirm.getByRole("button", { name: "취소" }).click();
  globalWorkerPlanOverride = false;
  await expect(queueConsole.getByLabel("채널 필터")).toBeVisible();
  await expect(queueConsole.locator(".queue-console-row").first()).toBeVisible();
  await queueConsole.locator(".queue-console-row").first().getByRole("button", { name: "작업 상세 열기" }).click();
  await expect(queueConsole.getByText("Worker 실행 계획")).toBeVisible();
  await expect(queueConsole.getByText("인덱스된 파일")).toBeVisible();
  await expect(queueConsole.getByText("최근 작업 로그")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("queue-console.png"), fullPage: true });
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await expect(queueConsole).toBeHidden();

  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByLabel("런타임 설정")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("runtime-console.png"), fullPage: true });
  await page.getByRole("button", { name: "Env 가이드" }).click();
  const runtimeGuide = page.getByLabel("런타임 env 매니페스트");
  await expect(runtimeGuide).toBeVisible();
  await expect(runtimeGuide.locator("strong", { hasText: "CVN_DOWNLOAD_WORKER_ENABLED" })).toBeVisible();
  await expect(runtimeGuide.locator("strong", { hasText: "CVN_METADATA_SYNC_SCHEDULER_ENABLED" })).toBeVisible();
  await expect(runtimeGuide.getByText("다음 tick").first()).toBeVisible();
  await expect(runtimeGuide.getByText("런타임 적용")).toBeVisible();
  await expect(runtimeGuide.getByText("Scheduler tick 로그")).toBeVisible();
  await expect(runtimeGuide.getByText("Metadata tick 로그")).toBeVisible();
  await expect(runtimeGuide.getByText("설정 힌트")).toBeVisible();
  await expect(runtimeGuide.getByLabel("Adapter env 라인")).toContainText("CVN_RESTART");
  await expect(runtimeGuide.getByText("재시작 감사 ledger")).toBeVisible();
  await expect(runtimeGuide.getByRole("button", { name: "이벤트 열기" })).toBeVisible();
  const secureJump = runtimeGuide.getByLabel("공개 전에 먼저 보안 설정");
  await expect(secureJump).toBeVisible();
  await secureJump.getByRole("button", { name: "토큰 설정 열기" }).click();
  const tokenGuard = runtimeGuide.getByLabel("공개 접근 가드");
  await expect(tokenGuard).toBeVisible();
  await expect(tokenGuard).toContainText("공개 접근 가드");
  const generateTokenButton = tokenGuard.getByRole("button", { name: "강력한 토큰 생성" });
  await expect(generateTokenButton).toBeVisible();
  await generateTokenButton.click();
  await expect(tokenGuard).toContainText("CVN_AUTH_TOKEN=");
  const copyTokenButton = tokenGuard.getByRole("button", { name: "토큰 한 번 복사" });
  await expect(copyTokenButton).toBeVisible();
  await copyTokenButton.click();
  await expect(copyTokenButton).toContainText("토큰 복사됨");
  await expect(runtimeGuide.getByText("외부 공개 cookbook")).toBeVisible();
  const exposureCookbook = runtimeGuide.getByLabel("외부 공개 cookbook");
  await expect(exposureCookbook).toContainText("CVN_API_PORT=127.0.0.1:8000");
  await expect(exposureCookbook).toContainText("Nginx");
  await expect(exposureCookbook).toContainText("Caddy");
  await expect(exposureCookbook).toContainText("Cloudflare Tunnel");
  await expect(exposureCookbook).toContainText("Live 배포 smoke");
  await expect(exposureCookbook).toContainText("scripts/deployment-smoke.sh");
  const deploymentSmokeCopyButton = exposureCookbook.getByRole("button", { name: "배포 smoke 복사" });
  await expect(deploymentSmokeCopyButton).toBeVisible();
  await deploymentSmokeCopyButton.click();
  await expect(deploymentSmokeCopyButton).toContainText("복사됨");
  const nginxProxyCopyButton = exposureCookbook.getByRole("button", { name: "프록시 복사 Nginx" });
  await expect(nginxProxyCopyButton).toBeVisible();
  await nginxProxyCopyButton.click();
  await expect(nginxProxyCopyButton).toContainText("복사됨");
  await expect(runtimeGuide.getByText("Restart adapter 프리셋")).toBeVisible();
  await expect(runtimeGuide.getByText("Synology 패키지")).toBeVisible();
  await expect(runtimeGuide.getByText("QNAP 패키지")).toBeVisible();
  await expect(runtimeGuide.getByText("볼륨 분리 cookbook")).toBeVisible();
  const volumeCookbook = runtimeGuide.getByLabel("NAS 볼륨 마운트 cookbook");
  await expect(volumeCookbook).toContainText("CVN_METADATA_HOST_DIR");
  await expect(volumeCookbook).toContainText("CVN_DOWNLOAD_HOST_DIR");
  const volumeEnvCopyButton = runtimeGuide.getByRole("button", { name: "볼륨 env 복사" });
  await expect(volumeEnvCopyButton).toBeVisible();
  await volumeEnvCopyButton.click();
  await expect(volumeEnvCopyButton).toContainText("복사됨");
  const backupRestore = runtimeGuide.getByLabel("백업 및 복구 confidence");
  await expect(backupRestore).toBeVisible();
  await expect(backupRestore).toContainText("Metadata DB");
  await expect(backupRestore).toContainText("Archive + sidecars");
  await expect(backupRestore).toContainText("Runtime overrides");
  const backupCopyButton = backupRestore.getByRole("button", { name: "백업 명령 복사" });
  await expect(backupCopyButton).toBeVisible();
  await backupCopyButton.click();
  await expect(backupCopyButton).toContainText("복사됨");
  const restartPresetCopyButton = runtimeGuide.getByRole("button", { name: "env 복사 Docker Compose" });
  await expect(restartPresetCopyButton).toBeVisible();
  await restartPresetCopyButton.click();
  await expect(restartPresetCopyButton).toContainText("복사됨");
  const runtimeWorkerSummary = runtimeGuide.getByLabel("다운로드 worker summary export");
  await expect(runtimeWorkerSummary).toContainText("/api/jobs/downloads/worker/summary");
  const runtimeWorkerSummaryExport = page.waitForResponse(
    (response) =>
      response.url().includes("/api/jobs/downloads/worker/summary/export") &&
      response.url().includes("format=ndjson") &&
      response.request().method() === "GET",
  );
  await runtimeWorkerSummary.getByRole("button", { name: "NDJSON" }).click();
  expect((await runtimeWorkerSummaryExport).status()).toBe(200);
  await expect(runtimeGuide.getByRole("button", { name: "재시작 요청" })).toBeDisabled();
  await runtimeGuide.getByRole("button", { name: "적용 대기 저장" }).click();
  await expect(runtimeGuide.getByText(/env 저장됨/)).toBeVisible();
  await runtimeGuide.getByRole("button", { name: "로그 열기" }).click();
  const schedulerDrawer = page.getByLabel("Scheduler tick 로그");
  await expect(schedulerDrawer).toBeVisible();
  await schedulerDrawer.locator(".worker-history-filters").getByRole("button", { name: "실패" }).click();
  await expect(schedulerDrawer.locator(".scheduler-tick-list.expanded")).toContainText("fixture retry budget exhausted");
  await schedulerDrawer.getByRole("button", { name: "느린 실행만" }).click();
  await expect(schedulerDrawer.getByText("interval seconds")).toBeVisible();
  await schedulerDrawer.getByRole("button", { name: "JSON 복사" }).click();
  await expect(schedulerDrawer.getByRole("button", { name: "JSON 복사됨" })).toBeVisible();
  const schedulerExport = page.waitForEvent("download");
  await schedulerDrawer.getByRole("button", { name: "NDJSON" }).click();
  expect((await schedulerExport).suggestedFilename()).toContain("download-scheduler-ticks");
  await expect(schedulerDrawer.getByRole("button", { name: "CSV" })).toBeVisible();
  await expect(schedulerDrawer.getByRole("button", { name: "보존 정리" })).toBeVisible();
  await schedulerDrawer.getByRole("button", { name: "필터 초기화" }).click();
  await expect(schedulerDrawer.locator(".worker-history-filters").getByRole("button", { name: "전체" })).toHaveClass(/active/);
  await expect(schedulerDrawer.locator(".scheduler-tick-list.expanded")).toContainText("#");
  await expect(schedulerDrawer.locator(".scheduler-tick-list.expanded")).toContainText("다음 tick");
  await page.screenshot({ path: testInfo.outputPath("scheduler-tick-drawer.png"), fullPage: true });
  await schedulerDrawer.getByRole("button", { name: "닫기" }).click();
  await runtimeGuide.getByRole("button", { name: "Metadata 로그" }).click();
  const metadataDrawer = page.getByLabel("Metadata tick 로그");
  await expect(metadataDrawer).toBeVisible();
  await metadataDrawer.locator(".worker-history-filters").getByRole("button", { name: "완료" }).click();
  await expect(metadataDrawer.locator(".metadata-tick-list")).toContainText("감지 영상");
  await expect(metadataDrawer.locator(".metadata-tick-list")).toContainText("1");
  await metadataDrawer.getByRole("button", { name: "JSON 복사" }).click();
  await expect(metadataDrawer.getByRole("button", { name: "JSON 복사됨" })).toBeVisible();
  await expect(metadataDrawer.getByRole("button", { name: "NDJSON" })).toBeVisible();
  await expect(metadataDrawer.getByRole("button", { name: "CSV" })).toBeVisible();
  await expect(metadataDrawer.getByRole("button", { name: "보존 정리" })).toBeVisible();
  await metadataDrawer.getByRole("button", { name: "필터 초기화" }).click();
  await expect(metadataDrawer.locator(".worker-history-filters").getByRole("button", { name: "전체" })).toHaveClass(/active/);
  await expect(metadataDrawer.locator(".metadata-tick-list")).toContainText("#");
  await expect(metadataDrawer.locator(".metadata-tick-list")).toContainText("다음 tick");
  await page.screenshot({ path: testInfo.outputPath("metadata-tick-drawer.png"), fullPage: true });
  await metadataDrawer.getByRole("button", { name: "닫기" }).click();
  await runtimeGuide.getByRole("button", { name: "매니페스트 복사" }).click();
  await expect(runtimeGuide.getByText("복사됨")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("runtime-env-guide.png"), fullPage: true });
  await page.getByRole("button", { name: "닫기" }).click();
  const dueWatchlist = page.getByLabel("Due 채널 목록").first();
  await expect(dueWatchlist.getByRole("button").first()).toBeVisible();
  await dueWatchlist.getByRole("button").first().click();
  await page.getByRole("button", { name: "채널", exact: true }).click();
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "개요" }).click();
  await expect(page.getByText("다음 sync 예정")).toBeVisible();
  await expect(page.getByText("마지막 자동 sync")).toBeVisible();
  await expect(page.getByText("자동 후보 생성 결과")).toBeVisible();
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "로그" }).click();
  await expect(page.getByLabel("Sync 작업 기록")).toBeVisible();
  await expect(page.locator(".sync-job-ledger").first()).toContainText("감지");
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "개요" }).click();
  await expect(page.getByLabel("Coverage 지표")).toBeVisible();
  await expect(page.getByLabel("업로드 요일 분포")).toBeVisible();
  await expect(page.locator(".coverage-inspector")).toContainText(/1\/[34] 보존/);
  await expect(page.locator(".missing-mini-card")).toContainText("Queue calibration pass");
  await page.getByLabel("Sync 간격 분").fill("120");
  const intervalPatch = page.waitForResponse(
    (response) => response.url().endsWith("/api/channels/1") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "간격 저장" }).click();
  expect((await (await intervalPatch).json()).sync_interval_minutes).toBe(120);
  await expect(page.getByText("120분 간격")).toBeVisible();
  await page.getByRole("button", { name: "인사이트", exact: true }).click();
  await expect(page.getByText("아카이브 루트").first()).toBeVisible();
  const storageTrend = page.getByLabel("스토리지 추세", { exact: true });
  await expect(storageTrend).toContainText("최근 스냅샷");
  await storageTrend.getByRole("button", { name: "스냅샷 저장" }).click();
  await expect(storageTrend.getByRole("button", { name: "저장됨" })).toBeVisible();
  await expect(page.getByText("실제 저장소 트리").first()).toBeVisible();
  await expect(page.locator(".storage-extension-rail").first()).toContainText(".mp4");
  await expect(page.locator(".storage-scan-grid").first()).toContainText("미인덱스 미디어");
  await expect(page.getByText("드리프트 대응")).toBeVisible();
  await expect(page.getByRole("button", { name: "인덱스 복구" }).first()).toBeVisible();
  const storageDriftList = page.getByLabel("인덱스 드리프트");
  if ((await storageDriftList.count()) > 0) {
    await expect(storageDriftList.first()).toContainText("미인덱스 미디어");
    await storageDriftList.first().getByRole("button", { name: "인덱스 복구" }).first().click();
    const driftPreview = page.getByLabel("드리프트 작업 미리보기");
    await expect(driftPreview).toBeVisible();
    await expect(driftPreview).toContainText("예정 변경");
    await expect(driftPreview).toContainText("Sidecar 구성");
    await driftPreview.getByRole("button", { name: "취소" }).click();
  }
  await expect(page.locator(".storage-tree-panel").first()).toContainText("@signalvaultlab");
  await expect(page.locator(".storage-orphan-list").first()).toContainText("video.ko.srt");
  await page.locator(".storage-orphan-list").first().getByRole("button", { name: "격리 계획" }).first().click();
  const orphanQuarantine = page.getByLabel("Orphan sidecar 격리");
  await expect(orphanQuarantine).toBeVisible();
  await expect(orphanQuarantine).toContainText(".channel-vault-quarantine");
  await orphanQuarantine.getByRole("button", { name: "취소" }).click();
  await page.getByLabel("Orphan 종류 필터").getByRole("button", { name: "subtitle" }).click();
  await expect(page.getByLabel("Orphan sidecar 목록")).toContainText("subtitle");
  const storageTriage = page.getByLabel("Storage triage console");
  await expect(storageTriage).toContainText("청소 후보");
  await storageTriage.getByRole("button", { name: "격리 보관함" }).click();
  const quarantineVault = page.getByLabel("Sidecar 격리 보관함");
  await expect(quarantineVault).toBeVisible();
  await expect(quarantineVault).toContainText("restorable-sidecar");
  await expect(quarantineVault).toContainText("보관 기간");
  await expect(quarantineVault).toContainText("오래된 격리 파일 삭제");
  await quarantineVault.getByRole("button", { name: "삭제 계획" }).click();
  await expect(quarantineVault).toContainText("삭제 후보");
  await expect(quarantineVault).toContainText("old-held-sidecar");
  await expect(quarantineVault.getByRole("button", { name: "영구 삭제" })).toBeDisabled();
  const quarantineExport = page.waitForEvent("download");
  await quarantineVault.getByRole("button", { name: "CSV" }).click();
  expect((await quarantineExport).suggestedFilename()).toContain("storage-quarantine");
  await expect(quarantineVault.getByRole("button", { name: "NDJSON" })).toBeVisible();
  await quarantineVault
    .locator(".storage-quarantine-list article")
    .filter({ hasText: "restorable-sidecar" })
    .getByRole("button", { name: "복원 계획" })
    .click();
  await expect(quarantineVault).toContainText("channels/@signalvaultlab [UC_CVN_E2E]/2026/restorable-sidecar/video.en.srt");
  await quarantineVault.getByRole("button", { name: "닫기" }).last().click();
  await storageTriage.getByRole("button", { name: "Sidecar 누락 보기" }).click();
  await storageTriage.getByRole("button", { name: "보고서 복사" }).click();
  await expect(storageTriage.getByRole("button", { name: "복사됨" })).toBeVisible();
  const storageExport = page.waitForEvent("download");
  await storageTriage.getByRole("button", { name: "CSV 저장" }).click();
  expect((await storageExport).suggestedFilename()).toContain("storage-scan");
  await page.getByRole("button", { name: "채널", exact: true }).click();
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "라이브러리" }).click();
  const channelStorageLens = page.getByLabel("채널 NAS 발자국");
  await expect(channelStorageLens).toBeVisible();
  await expect(channelStorageLens).toContainText("아카이브 점유");
  await expect(channelStorageLens).toContainText("미디어");
  await expect(channelStorageLens).toContainText("Footprint 추세");
  await expect(channelStorageLens).toContainText("7/30일 성장 비교");
  await expect(channelStorageLens).toContainText("폴더 확인 명령");
  const storagePathCopyButton = channelStorageLens.getByRole("button", { name: "경로 복사" });
  const storageCommandCopyButton = channelStorageLens.getByRole("button", { name: "명령 복사" });
  await storagePathCopyButton.click();
  await expect(storagePathCopyButton).toContainText("복사됨");
  await storageCommandCopyButton.click();
  await expect(storageCommandCopyButton).toContainText("복사됨");
  await expect(page.getByLabel("활성 라이브러리 뷰")).toContainText("아무거나");
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await expect(page.getByLabel("활성 라이브러리 뷰")).toContainText("전체 라이브러리");
  await expect(page.getByText("Queue calibration pass").first()).toBeVisible();
  await expect(page.getByText("Golden hour archive").first()).toBeVisible();
  await expect(page.locator(".saved-view-pill").filter({ hasText: "Media only triage" })).toBeVisible();
  await page.locator(".library-preset-group").getByRole("button", { name: "1080p h264" }).click();
  await expect(page.locator(".library-card").filter({ hasText: "Golden hour archive" })).toBeVisible();
  await page.getByLabel("저장할 뷰 이름").fill("무자막 h264");
  await page.getByRole("button", { name: "뷰 저장" }).click();
  await expect(page.locator(".saved-view-pill").filter({ hasText: "무자막 h264" })).toBeVisible();
  await expect(page.locator(".saved-view-pill.active").filter({ hasText: "무자막 h264" })).toBeVisible();
  const overwrittenView = page.waitForResponse(
    (response) => response.url().endsWith("/api/library/views") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "덮어쓰기" }).click();
  expect((await (await overwrittenView).json()).name).toBe("무자막 h264");
  await expect(page.getByLabel("활성 라이브러리 뷰")).toContainText("h264 1080p");
  await page.screenshot({ path: testInfo.outputPath("library-filtered.png"), fullPage: true });
  await page.locator(".library-card").filter({ hasText: "Golden hour archive" }).click();
  await expect(page.getByLabel("미디어 파일 상세")).toBeVisible();
  await expect(page.locator(".library-file-card").first()).toContainText("1080p");
  await expect(page.locator(".library-sidecar-grid").first()).toContainText("자막");
  await page.screenshot({ path: testInfo.outputPath("library-detail.png"), fullPage: true });
  await page.getByRole("button", { name: "닫기" }).click();
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "정책" }).click();
  await expect(page.getByText("정책 콘솔")).toBeVisible();
  await page.getByRole("button", { name: "워커 정지" }).click();
  await expect(page.getByRole("button", { name: "워커 재개" })).toBeVisible();
  await page.getByRole("button", { name: "워커 재개" }).click();
  await expect(page.getByRole("button", { name: "워커 정지" })).toBeVisible();
  await page.getByLabel("채널 상세 탭").getByRole("button", { name: "다운로드" }).click();
  await expect(page.getByText("워커 관제실")).toBeVisible();
  await expect(page.locator(".worker-guardrails")).toContainText("안전 설계");
  await expect(page.getByText("잠김").first()).toBeVisible();
  const workerRun = page.waitForResponse(
    (response) => response.url().endsWith("/api/jobs/downloads/worker/run-once") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "드라이런" }).click();
  const workerRunPayload = (await (await workerRun).json()) as { dry_run: boolean; started: number };
  expect(workerRunPayload.dry_run).toBe(true);
  expect(workerRunPayload.started).toBe(0);
  await expect(page.getByText("최근 워커 실행")).toBeVisible();
  await expect(page.locator(".worker-run-ledger").getByText("locked").first()).toBeVisible();
  await page.locator(".worker-run-ledger").getByRole("button", { name: "요약" }).click();
  const downloadSummary = page.getByLabel("다운로드 실행 요약");
  await expect(downloadSummary).toContainText("archive.txt staged");
  await expect(downloadSummary).toContainText("최근 worker pass");
  await downloadSummary.getByRole("button", { name: "JSON 복사" }).click();
  await expect(downloadSummary.getByRole("button", { name: "JSON 복사됨" })).toBeVisible();
  const workerSummaryExportResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/jobs/downloads/worker/summary/export") &&
      response.url().includes("format=ndjson") &&
      response.request().method() === "GET",
  );
  await downloadSummary.getByRole("button", { name: "NDJSON" }).click();
  expect((await workerSummaryExportResponse).status()).toBe(200);
  await page.screenshot({ path: testInfo.outputPath("download-run-summary.png"), fullPage: true });
  await downloadSummary.getByRole("button", { name: "닫기" }).click();
  await page.locator(".worker-run-ledger").getByRole("button", { name: "열기" }).click();
  await expect(page.getByLabel("워커 히스토리")).toBeVisible();
  await page.locator(".worker-history-filters").getByRole("button", { name: "드라이런" }).click();
  await expect(page.locator(".worker-history-card").first()).toContainText("locked");
  await page.screenshot({ path: testInfo.outputPath("worker-history.png"), fullPage: true });
  await page.getByRole("button", { name: "닫기" }).click();

  await expect(page.getByLabel("Queue 레이더")).toBeVisible();
  await expect(page.getByRole("button", { name: "선택 재시도" })).toBeDisabled();
  const queueFilters = page.getByLabel("Queue 상태 필터");
  await expect(queueFilters).toBeVisible();
  await queueFilters.getByRole("button", { name: "대기" }).click();
  await expect(page.locator(".queue-status-pill.queued").first()).toBeVisible();
  await queueFilters.getByRole("button", { name: "실행 가능" }).click();

  await page.getByRole("button", { name: "프리플라이트" }).click();
  await expect(page.locator(".command-lines code").filter({ hasText: "yt-dlp" }).first()).toBeVisible();
  await page.getByRole("button", { name: "명령 복사" }).click();
  await expect(page.getByRole("button", { name: "복사됨" })).toBeVisible();
  await expect(page.locator(".preflight-pill.ready").first()).toBeVisible();
  await expect(page.getByLabel("프리플라이트 런웨이")).toContainText("DB만 무장");
  await expect(page.getByLabel("선택 작업 요약")).toContainText("선택 용량");
  const preflightFilter = page.getByLabel("프리플라이트 필터");
  await expect(preflightFilter).toContainText("미점검");
  await preflightFilter.getByRole("button", { name: /준비됨/ }).click();
  await expect(page.locator(".preflight-pill.ready").first()).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("launch-control.png"), fullPage: true });

  const bulkResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/jobs/downloads/bulk") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "선택 큐 등록" }).click();
  const bulkPayload = (await (await bulkResponse).json()) as { updated: number };
  expect(bulkPayload.updated).toBeGreaterThanOrEqual(2);

  await page.goto("/#/channels/downloads?channel=1&events=open");
  const eventLog = page.getByLabel("운영 이벤트 로그");
  await expect(eventLog).toBeVisible();
  await expect(eventLog.getByRole("button", { name: "다운로드" })).toBeVisible();
  await expect(eventLog.getByRole("button", { name: "스토리지" })).toBeVisible();
  await expect(eventLog.getByRole("button", { name: "런타임" })).toBeVisible();
  await eventLog.getByRole("button", { name: "다운로드" }).click();
  await expect(eventLog.locator(".event-log-card").first()).toBeVisible();
  await expect(eventLog).toContainText("download.");
  await eventLog.locator(".event-log-card").first().getByRole("button", { name: "상세" }).click();
  const eventDetail = eventLog.getByRole("region", { name: "이벤트 상세" });
  await expect(eventDetail).toBeVisible();
  await expect(eventDetail).toContainText("download.");
  await eventDetail.getByRole("button", { name: "이 이벤트 복사" }).click();
  await expect(eventDetail.getByRole("button", { name: "복사됨" })).toBeVisible();
  await eventDetail.getByRole("button", { name: "curl 복사" }).click();
  await expect(eventDetail.getByRole("button", { name: "curl 복사됨" })).toBeVisible();
  await expect(eventDetail.getByRole("button", { name: "큐에서 보기" })).toBeVisible();
  const eventDetailExport = page.waitForEvent("download");
  await eventDetail.getByRole("button", { name: "NDJSON" }).click();
  expect((await eventDetailExport).suggestedFilename()).toContain("archive-event-log");
  await eventDetail.getByRole("button", { name: "상세 닫기" }).click();
  await expect(eventDetail).toBeHidden();
  const eventExport = page.waitForEvent("download");
  await eventLog.getByRole("button", { name: "CSV" }).click();
  expect((await eventExport).suggestedFilename()).toContain("archive-event-log");
  await expect(eventLog.getByRole("button", { name: "NDJSON" })).toBeVisible();
  await expect(eventLog.getByRole("button", { name: "보존 정리" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("event-log.png"), fullPage: true });
  await eventLog.getByRole("button", { name: "닫기", exact: true }).click();

  const archivePathway = page.getByLabel("새 영상 확인, 기존 영상 스킵, 큐 진행 보기");
  await expect(archivePathway).toContainText("스킵 장부");
  await expect(archivePathway).toContainText("큐 런웨이");
  const archiveTxtConsole = page.getByLabel("archive.txt 스킵 장부");
  await expect(archiveTxtConsole).toBeVisible();
  await expect(archiveTxtConsole.getByLabel("archive.txt 가져오기 단계")).toContainText("소스 입력");
  const archiveTxtUnknownId = testInfo.project.name === "chromium" ? "cvnCHRM001A" : "cvnMOBL001A";
  await archiveTxtConsole.getByLabel("archive.txt 파일 선택").setInputFiles({
    name: "archive.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(`youtube ${archiveTxtUnknownId}\nhttps://youtu.be/${archiveTxtUnknownId}\nnot a usable line`),
  });
  await expect(archiveTxtConsole.getByLabel("archive.txt 내용")).toHaveValue(
    `youtube ${archiveTxtUnknownId}\nhttps://youtu.be/${archiveTxtUnknownId}\nnot a usable line`,
  );
  await expect(archiveTxtConsole.getByLabel("archive.txt 가져오기 단계")).toContainText("3줄 준비됨");
  await archiveTxtConsole.getByRole("button", { name: "스킵 미리보기" }).click();
  await expect(archiveTxtConsole).toContainText("볼트 신규");
  await expect(archiveTxtConsole).toContainText("중복");
  await expect(archiveTxtConsole).toContainText("새 항목");
  await expect(archiveTxtConsole.getByLabel("archive.txt 가져오기 단계")).toContainText("스킵 0 · 미보관 0 · 신규 1");
  const archiveTxtStageResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/imports/archive-txt/stage") && response.request().method() === "POST",
  );
  await archiveTxtConsole.getByRole("button", { name: "새 항목 후보 만들기" }).click();
  const archiveTxtStagePayload = (await (await archiveTxtStageResponse).json()) as {
    videos_created: number;
    candidates_created: number;
    preview: { unknown_count: number };
  };
  expect(archiveTxtStagePayload.videos_created).toBe(1);
  expect(archiveTxtStagePayload.candidates_created).toBe(1);
  expect(archiveTxtStagePayload.preview.unknown_count).toBe(0);
  await expect(archiveTxtConsole).toContainText("영상 생성");
  await expect(archiveTxtConsole).toContainText("후보 생성");
  await expect(archiveTxtConsole).toContainText("제목/날짜 보강");
  await expect(archiveTxtConsole.getByRole("button", { name: "metadata sync 실행" })).toBeVisible();
  await expect(archiveTxtConsole).toContainText("검토 대기");
  await expect(archiveTxtConsole).toContainText(archiveTxtUnknownId);
  await expect(archiveTxtConsole).toContainText("큐로 넘기기");
  await expect(archiveTxtConsole.getByRole("button", { name: "큐에서 보기" })).toBeVisible();
  await expect(archiveTxtConsole.getByRole("button", { name: "최대 5개 실행 준비" })).toBeVisible();
  await archiveTxtConsole.getByRole("button", { name: "준비 후 실행" }).click();
  const archiveTxtRunModal = page.getByLabel("archive.txt 신규 후보 실행");
  await expect(archiveTxtRunModal).toContainText("최대 5개만 실제 다운로드");
  await expect(archiveTxtRunModal).toContainText("이미 받은 영상은 건너뜀");
  await expect(archiveTxtRunModal.getByRole("button", { name: "준비하고 시작" })).toBeDisabled();
  await archiveTxtRunModal.getByRole("button", { name: "취소" }).click();
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
  const rescanResultPanel = page.locator(".rescan-result");
  await expect(rescanResultPanel).toContainText("폴더");
  await expect(rescanResultPanel).toContainText("파일");
  await expect(rescanResultPanel).toContainText("경고");

  await page.screenshot({ path: testInfo.outputPath("rescan-apply.png"), fullPage: true });
  expect(errors).toEqual([]);
});
