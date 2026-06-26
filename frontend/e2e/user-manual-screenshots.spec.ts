import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const captureEnabled = process.env.CVN_CAPTURE_USER_MANUAL_SCREENSHOTS === "true";
const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, "../../docs/assets/user-manual/en");

test.skip(!captureEnabled, "Set CVN_CAPTURE_USER_MANUAL_SCREENSHOTS=true to refresh English user-manual screenshots.");
test.setTimeout(120_000);

async function installEnglishSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "en");
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
  });
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

test("capture English user-manual screenshots", async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });

  await openEnglishVault(page, "/#/dashboard?channel=1", "Know what needs attention");
  await expect(page.getByLabel("Dashboard overview")).toBeVisible();
  await capture(page, "01-dashboard-cockpit.png");

  await openEnglishVault(page, "/#/channels/overview?channel=1", "Next sync due");
  await expect(page.getByLabel("Channel detail tabs").getByRole("button", { name: "Overview" })).toHaveClass(/active/);
  await capture(page, "02-channel-overview.png");

  await openEnglishVault(page, "/#/channels/downloads?channel=1", "Preview the download batch");
  await expect(page.getByLabel("Queue radar")).toBeVisible();
  await capture(page, "03-download-launch-control.png");

  await page.getByRole("button", { name: "Download new only" }).first().click();
  await expect(page.getByLabel("Download new videos")).toBeVisible();
  await capture(page, "04-download-confirm-modal.png");
  await page.getByLabel("Download new videos").getByRole("button", { name: "Cancel" }).click();

  await openEnglishVault(page, "/#/queue?channel=1", "Global queue control");
  await expect(page.getByLabel("Global queue control")).toBeVisible();
  await capture(page, "05-queue-console.png");

  await openEnglishVault(page, "/#/library?channel=1", "Indexed media shelf");
  await expect(page.getByLabel("Library filters")).toBeVisible();
  await capture(page, "06-library-coverage.png");

  await openEnglishVault(page, "/#/channels/logs?channel=1", "Sync job ledger");
  await expect(page.getByLabel("Sync job ledger")).toBeVisible();
  await capture(page, "07-channel-logs.png");

  await openEnglishVault(page, "/#/channels/policy?channel=1", "Policy console");
  await expect(page.getByText("Policy console").first()).toBeVisible();
  await capture(page, "08-channel-policy.png");

  await openEnglishVault(page, "/#/insights?channel=1", "archive root");
  await expect(page.getByLabel("Storage trend", { exact: true })).toBeVisible();
  await capture(page, "09-insights-storage.png");

  await openEnglishVault(page, "/#/settings?runtime=guide", "Runtime env manifest");
  await expect(page.getByLabel("Runtime env manifest")).toBeVisible();
  await capture(page, "10-settings-runtime.png");

  await page.setViewportSize({ width: 390, height: 900 });
  await openEnglishVault(page, "/#/dashboard?channel=1", "Know what needs attention");
  await expect(page.getByLabel("Dashboard overview")).toBeVisible();
  await capture(page, "11-mobile-dashboard.png");
});
