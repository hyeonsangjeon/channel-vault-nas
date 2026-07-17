import { expect, type Page, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const captureEnabled = process.env.CVN_CAPTURE_USER_MANUAL_SCREENSHOTS === "true";
const __dirname = dirname(fileURLToPath(import.meta.url));
const lang = process.env.CVN_MANUAL_LANG === "ko" ? "ko" : "en";
const backendPort = Number(process.env.CVN_E2E_BACKEND_PORT ?? 8011);
const screenshotDir = resolve(__dirname, `../../docs/assets/user-manual/${lang}`);
const locale: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, `../src/locales/${lang}.json`), "utf8"),
);
const manualProbe = {
  title: "Channel Vault Guide",
  external_id: "UC_CVN_MANUAL_GUIDE",
  handle: "@channelvaultguide",
  source_url: "https://www.youtube.com/@channelvaultguide",
  channel_url: "https://www.youtube.com/channel/UC_CVN_MANUAL_GUIDE",
  description: "Deterministic verified channel for the user manual.",
  thumbnail_url: null,
  banner_url: null,
  follower_count: 1_250,
  video_count: 12,
  videos: [],
  storage_forecast: {
    video_count: 12,
    max_quality: "1080p",
    audio_only: false,
    estimated_bytes: 8_400_000_000,
    estimated_label: "7.8 GB",
    confidence: "medium",
  },
  folder_preview: {
    root: "/archive",
    channel_dir: "channels/@channelvaultguide [UC_CVN_MANUAL_GUIDE]",
    example_video_dir: "channels/@channelvaultguide [UC_CVN_MANUAL_GUIDE]/2026/Guide video [cvnGuide01]",
    sidecars: ["video.info.json", "thumbnail.jpg", "video.nfo"],
  },
  already_registered: false,
  existing_channel_id: null,
  normalized: {
    original: "https://www.youtube.com/@channelvaultguide",
    source_type: "channel",
    identifier_type: "handle",
    identifier: "@channelvaultguide",
    canonical_url: "https://www.youtube.com/@channelvaultguide",
    probe_url: "https://www.youtube.com/@channelvaultguide/videos",
    tracking_query_removed: false,
  },
};

function t(key: string): string {
  const value = locale[key];
  if (!value) {
    throw new Error(`Missing locale key "${key}" for language "${lang}"`);
  }
  return value;
}

test.skip(!captureEnabled, "Set CVN_CAPTURE_USER_MANUAL_SCREENSHOTS=true to refresh user-manual screenshots.");
test.setTimeout(120_000);

async function installEnglishSession(page: Page) {
  await page.addInitScript((language) => {
    localStorage.setItem("channel-vault-language", language);
    let clipboardText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => clipboardText,
        writeText: async (value: string) => {
          clipboardText = value;
        },
      },
    });
  }, lang);
  await page.route("**/api/dashboard", async (route) => {
    try {
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
    } catch {
      await route.continue();
    }
  });
  await page.route("**/api/settings/runtime", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    try {
      const response = await route.fetch();
      const payload = await response.json();
      if (Array.isArray(payload.binaries)) {
        payload.binaries = payload.binaries.map((binary: { name?: string; path?: string | null }) => ({
          ...binary,
          path:
            binary.name === "yt-dlp"
              ? "/usr/local/bin/yt-dlp"
              : binary.name === "ffprobe"
                ? "/usr/bin/ffprobe"
                : binary.path,
        }));
      }
      await route.fulfill({ response, json: payload });
    } catch {
      await route.continue();
    }
  });
  await page.route("**/api/channels/_probe", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(manualProbe) });
  });
}

async function openEnglishVault(page: Page, path: string, expectedText?: string | RegExp) {
  await page.goto(path);
  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
  if (expectedText) {
    await expect(page.getByText(expectedText).first()).toBeVisible();
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function capture(page: Page, filename: string) {
  await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: resolve(screenshotDir, filename),
  });
}

async function openChannelAdvanced(page: Page) {
  const details = page.locator("details.channel-advanced-details");
  await expect(details).toBeVisible();
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
}

test.beforeEach(async ({ page }) => {
  await installEnglishSession(page);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("capture user-manual screenshots", async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });

  const initialPause = await page.request.patch(`http://127.0.0.1:${backendPort}/api/channels/1/policy`, {
    data: {
      worker_paused: true,
      worker_pause_reason: "user_manual_capture",
    },
  });
  expect(initialPause.ok()).toBeTruthy();

  await openEnglishVault(page, "/#/dashboard?channel=1", t("dashboard.title"));
  const home = page.locator(".simple-home");
  await expect(home.getByRole("heading", { name: t("simpleHome.title") })).toBeVisible();
  await expect(home.locator(".simple-home-step")).toHaveCount(3);
  await expect(home.locator(".channel-backup-overview")).toBeVisible();
  await capture(page, "01-home.png");

  await openEnglishVault(page, "/#/channels/overview?channel=1", t("detail.simple.interval"));
  const backupOverview = page.locator(".channel-backup-overview");
  await expect(backupOverview).toBeVisible();
  await expect(backupOverview.getByLabel(t("detail.simple.interval"))).toBeVisible();
  await expect(backupOverview.getByLabel(t("detail.simple.batch"))).toBeVisible();

  await page.getByRole("button", { name: t("channel.switcher.add") }).click();
  const registrationPanel = page.locator(".channel-registration-panel");
  await expect(registrationPanel).toBeVisible();
  await expect(page.getByRole("heading", { name: t("registration.addAnother") })).toBeVisible();
  await registrationPanel.getByLabel(t("registration.input.aria")).fill(manualProbe.source_url);
  await registrationPanel.getByRole("button", { name: t("registration.probe") }).click();
  await expect(registrationPanel).toContainText(t("registration.verifiedResult"));
  await expect(registrationPanel).toContainText(manualProbe.title);
  await expect(registrationPanel.getByRole("button", { name: t("registration.commit") })).toBeVisible();
  await registrationPanel.screenshot({
    animations: "disabled",
    path: resolve(screenshotDir, "03-channel-registration.png"),
  });

  await registrationPanel.locator(".icon-button").click();
  await backupOverview.scrollIntoViewIfNeeded();
  await expect(backupOverview).toBeVisible();
  await expect(backupOverview.getByRole("button", { name: new RegExp(t("detail.simple.start"), "i") })).toBeVisible();
  await backupOverview.screenshot({
    animations: "disabled",
    path: resolve(screenshotDir, "04-backup-schedule.png"),
  });
  await backupOverview.getByRole("button", { name: new RegExp(t("detail.simple.start"), "i") }).click();
  await expect(backupOverview.getByRole("button", { name: t("detail.simple.pause"), exact: true })).toBeVisible();
  await capture(page, "02-channel-overview.png");
  await backupOverview.getByRole("button", { name: t("detail.simple.pause"), exact: true }).click();
  await expect(backupOverview.getByRole("button", { name: new RegExp(t("detail.simple.start"), "i") })).toBeVisible();

  await openEnglishVault(page, "/#/queue?channel=1", t("queue.console.title"));
  await expect(page.getByLabel(t("queue.console.title")).first()).toBeVisible();
  await capture(page, "05-queue-console.png");

  await openEnglishVault(page, "/#/library?channel=1", t("library.title"));
  await expect(page.getByLabel(t("library.search"))).toBeVisible();
  await expect(page.getByText(t("library.advanced.title"), { exact: true })).toBeVisible();
  await capture(page, "06-library-coverage.png");

  await openEnglishVault(page, "/#/channels/logs?channel=1");
  await openChannelAdvanced(page);
  await expect(page.getByLabel(t("detail.syncJobs.title"))).toBeVisible();
  await capture(page, "07-channel-logs.png");

  await openEnglishVault(page, "/#/channels/policy?channel=1");
  await openChannelAdvanced(page);
  await expect(page.getByText(t("policy.console")).first()).toBeVisible();
  await capture(page, "08-channel-policy.png");

  await openEnglishVault(page, "/#/insights?channel=1", t("storage.scan.root"));
  await expect(page.getByLabel(t("storage.pressure.title"), { exact: true })).toBeVisible();
  await capture(page, "09-insights-storage.png");

  await openEnglishVault(page, "/#/settings", t("simpleSettings.title"));
  const simpleSettings = page.getByLabel(t("simpleSettings.aria"));
  await expect(simpleSettings).toBeVisible();
  await expect(simpleSettings.getByLabel(t("simpleSettings.language.label"))).toBeVisible();
  await expect(simpleSettings.getByRole("button", { name: t("simpleSettings.guide.open") })).toBeVisible();
  await expect(page.getByLabel(t("runtime.title"))).toBeHidden();
  await capture(page, "10-settings.png");

  await page.setViewportSize({ width: 390, height: 900 });
  await openEnglishVault(page, "/#/dashboard?channel=1", t("dashboard.title"));
  await expect(page.locator(".simple-home").getByRole("heading", { name: t("simpleHome.title") })).toBeVisible();
  await expect(page.locator(".simple-home-step")).toHaveCount(3);
  await capture(page, "11-mobile-dashboard.png");
});
