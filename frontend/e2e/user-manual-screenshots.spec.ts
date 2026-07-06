import { expect, type Page, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const captureEnabled = process.env.CVN_CAPTURE_USER_MANUAL_SCREENSHOTS === "true";
const __dirname = dirname(fileURLToPath(import.meta.url));
const lang = process.env.CVN_MANUAL_LANG === "ko" ? "ko" : "en";
const screenshotDir = resolve(__dirname, `../../docs/assets/user-manual/${lang}`);
const locale: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, `../src/locales/${lang}.json`), "utf8"),
);

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
}

async function openEnglishVault(page: Page, path: string, expectedText: string | RegExp) {
  await page.goto(path);
  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
  await expect(page.getByText(expectedText).first()).toBeVisible();
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

test.beforeEach(async ({ page }) => {
  await installEnglishSession(page);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("capture user-manual screenshots", async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });

  await openEnglishVault(page, "/#/dashboard?channel=1", t("dashboard.title"));
  await expect(page.getByLabel(t("dashboard.cockpit.aria"))).toBeVisible();
  await capture(page, "01-dashboard-cockpit.png");

  await openEnglishVault(page, "/#/channels/overview?channel=1", t("detail.syncOps.next"));
  await expect(page.getByLabel(t("detail.tabs.aria")).getByRole("button", { name: t("detail.tabs.overview") })).toHaveClass(/active/);
  await capture(page, "02-channel-overview.png");

  await openEnglishVault(page, "/#/channels/downloads?channel=1", t("launch.title"));
  await expect(page.getByLabel(t("launch.signal.title"))).toBeVisible();
  await capture(page, "03-download-launch-control.png");

  const schedulePanel = page.locator(".channel-automation-panel");
  await schedulePanel.scrollIntoViewIfNeeded();
  await expect(page.getByText(t("detail.automation.title")).first()).toBeVisible();
  await expect(page.getByRole("button", { name: t("detail.automation.register") })).toBeVisible();
  await schedulePanel.screenshot({
    animations: "disabled",
    path: resolve(screenshotDir, "04-download-confirm-modal.png"),
  });

  await openEnglishVault(page, "/#/queue?channel=1", t("queue.console.title"));
  await expect(page.getByLabel(t("queue.console.title")).first()).toBeVisible();
  await capture(page, "05-queue-console.png");

  await openEnglishVault(page, "/#/library?channel=1", t("library.title"));
  await expect(page.getByLabel(t("library.filter.title"))).toBeVisible();
  await capture(page, "06-library-coverage.png");

  await openEnglishVault(page, "/#/channels/logs?channel=1", t("detail.syncJobs.title"));
  await expect(page.getByLabel(t("detail.syncJobs.title"))).toBeVisible();
  await capture(page, "07-channel-logs.png");

  await openEnglishVault(page, "/#/channels/policy?channel=1", t("policy.console"));
  await expect(page.getByText(t("policy.console")).first()).toBeVisible();
  await capture(page, "08-channel-policy.png");

  await openEnglishVault(page, "/#/insights?channel=1", t("storage.scan.root"));
  await expect(page.getByLabel(t("storage.pressure.title"), { exact: true })).toBeVisible();
  await capture(page, "09-insights-storage.png");

  await openEnglishVault(page, "/#/settings?runtime=guide", t("runtime.guide.title"));
  await expect(page.getByLabel(t("runtime.guide.title"))).toBeVisible();
  await capture(page, "10-settings-runtime.png");

  await page.setViewportSize({ width: 390, height: 900 });
  await openEnglishVault(page, "/#/dashboard?channel=1", t("dashboard.title"));
  await expect(page.getByLabel(t("dashboard.cockpit.aria"))).toBeVisible();
  await capture(page, "11-mobile-dashboard.png");
});
