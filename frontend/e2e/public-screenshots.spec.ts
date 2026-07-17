import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const captureEnabled = process.env.CVN_CAPTURE_PUBLIC_SCREENSHOTS === "true";
const __dirname = dirname(fileURLToPath(import.meta.url));
const backendPort = Number(process.env.CVN_E2E_BACKEND_PORT ?? 8011);
const repositoryRoot = resolve(__dirname, "../..");
const screenshotDir = resolve(__dirname, "../../docs/assets/screenshots");

test.skip(!captureEnabled, "Set CVN_CAPTURE_PUBLIC_SCREENSHOTS=true to refresh public README screenshots.");
test.setTimeout(90_000);
test.use({ locale: "en-US" });

function sanitizePublicPaths(value: unknown): unknown {
  if (typeof value === "string") return value.replaceAll(repositoryRoot, "/opt/channel-vault");
  if (Array.isArray(value)) return value.map(sanitizePublicPaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizePublicPaths(item)]));
  }
  return value;
}

async function openEnglishVault(page: Page, path = "/#/dashboard?channel=1") {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "en");
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
  await page.route("**/api/settings/runtime", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const payload = sanitizePublicPaths(await response.json());
    await route.fulfill({ response, json: payload });
  });
  await page.goto(path);
  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
}

async function capture(page: Page, filename: string) {
  await page.screenshot({
    path: resolve(screenshotDir, filename),
    fullPage: false,
  });
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("capture public screenshots", async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });

  const initialPause = await page.request.patch(`http://127.0.0.1:${backendPort}/api/channels/1/policy`, {
    data: {
      worker_paused: true,
      worker_pause_reason: "public_screenshot_capture",
    },
  });
  expect(initialPause.ok()).toBeTruthy();

  await openEnglishVault(page);
  const home = page.locator(".simple-home");
  await expect(home.getByRole("heading", { name: "Keep your channels safe automatically" })).toBeVisible();
  await expect(home.locator(".simple-home-step")).toHaveCount(3);
  await expect(home.locator(".channel-backup-overview")).toBeVisible();
  await expect(page.locator(".simple-home")).toBeVisible();
  await capture(page, "home.png");

  await page.getByRole("button", { name: "Channels", exact: true }).click();
  await expect(page.locator(".channel-registration-panel")).toHaveCount(0);
  await expect(page.locator(".channel-backup-overview")).toBeVisible();
  const backupOverview = page.locator(".channel-backup-overview");
  await expect(backupOverview).toBeVisible();
  await expect(backupOverview).toContainText("Total videos");
  await expect(backupOverview).toContainText("Downloaded");
  await expect(backupOverview).toContainText("Remaining");
  await expect(backupOverview.getByLabel("All-channel check interval")).toBeVisible();
  await expect(backupOverview.getByRole("button", { name: /automatic backup/i })).toBeVisible();
  await capture(page, "channel-downloads.png");

  await page.getByRole("button", { name: "Add channel" }).click();
  const registrationPanel = page.locator(".channel-registration-panel");
  await expect(registrationPanel).toBeVisible();
  await expect(registrationPanel.getByRole("heading", { name: "Add another channel" })).toBeVisible();
  await capture(page, "channel-registration.png");
  await registrationPanel.locator(".icon-button").click();

  await page.goto("/#/channels/downloads?channel=1");
  const importKit = page.locator(".quick-panel");
  await expect(importKit).toBeVisible();
  await importKit.scrollIntoViewIfNeeded();
  await expect(importKit).toContainText("Import kit");
  await expect(importKit).toContainText("Existing NAS folder");
  await expect(importKit).toHaveCSS("opacity", "1");
  await importKit.screenshot({ animations: "disabled", path: resolve(screenshotDir, "existing-archive-import.png") });

  await page.goto("/#/queue?channel=1");
  const queueConsole = page.getByLabel("Download queue").first();
  await expect(queueConsole).toBeVisible();
  await capture(page, "queue-console.png");

  await page.goto("/#/library?channel=1");
  await expect(page.getByRole("heading", { name: "Your saved videos" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search by title or channel" })).toBeVisible();
  await expect(page.getByText("Advanced filters", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Library filters")).toBeHidden();
  await capture(page, "library-shelf.png");

  await page.goto("/#/settings?runtime=guide");
  const runtimeGuide = page.getByLabel("Runtime env manifest");
  await expect(runtimeGuide).toBeVisible();
  await expect(runtimeGuide).toContainText("Compose smoke verification");
  await expect(runtimeGuide).toContainText("Restart adapter presets");
  const publicAccessGuard = runtimeGuide.getByLabel("Public access guard");
  await expect(publicAccessGuard).toBeVisible();
  await publicAccessGuard.scrollIntoViewIfNeeded();
  await capture(page, "runtime-guide.png");
});
