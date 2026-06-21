import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const captureEnabled = process.env.CVN_CAPTURE_PUBLIC_SCREENSHOTS === "true";
const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = resolve(__dirname, "../../docs/assets/screenshots");

test.skip(!captureEnabled, "Set CVN_CAPTURE_PUBLIC_SCREENSHOTS=true to refresh public README screenshots.");
test.setTimeout(90_000);

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

test("capture public alpha screenshots", async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });

  await openEnglishVault(page);
  const cockpit = page.getByLabel("Dashboard operating cockpit");
  await expect(cockpit).toContainText("Know what needs attention");
  await expect(page.getByLabel("Release readiness checklist")).toContainText("Public readiness");
  await capture(page, "dashboard-cockpit.png");

  await page.goto("/#/channels/downloads?channel=1");
  const channelTabs = page.getByLabel("Channel detail tabs");
  await expect(channelTabs.getByRole("button", { name: "Downloads" })).toHaveClass(/active/);
  await expect(page.getByText("Dry-run the download wave")).toBeVisible();
  await expect(page.getByLabel("Queue radar")).toBeVisible();
  await capture(page, "channel-downloads.png");

  await page.goto("/#/queue?channel=1");
  const queueConsole = page.getByLabel("Global queue control");
  await expect(queueConsole).toBeVisible();
  await expect(queueConsole).toContainText("Download operations");
  await expect(queueConsole.locator(".queue-console-row").first()).toBeVisible();
  await capture(page, "queue-console.png");

  await page.goto("/#/library?channel=1");
  await expect(page.getByText("Indexed media shelf")).toBeVisible();
  await expect(page.getByLabel("Library filters")).toBeVisible();
  await expect(page.getByLabel("Saved views")).toBeVisible();
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
