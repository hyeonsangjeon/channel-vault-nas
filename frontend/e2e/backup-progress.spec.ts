import { expect, test } from "@playwright/test";

import type { ChannelCoverage } from "../src/api/channels";
import { backupProgress } from "../src/components/channel/backup-progress";

function coverage(overrides: Partial<ChannelCoverage> = {}): ChannelCoverage {
  return {
    channel_id: "1",
    scope: "tracked_videos",
    probe_limit: 500,
    source: 3,
    archived: 1,
    missing: 2,
    removed_saved: 0,
    percent: 33.3,
    updated_at: "2026-09-26T00:00:00Z",
    ...overrides,
  };
}

test("only disk-aware tracked coverage determines backup completion", () => {
  expect(backupProgress(null)).toMatchObject({ checked: false, complete: false });
  expect(backupProgress(coverage())).toMatchObject({ total: 3, downloaded: 1, remaining: 2, complete: false });
  expect(backupProgress(coverage({ archived: 3, missing: 0 }))).toMatchObject({ complete: true, unavailable: 0 });
  expect(backupProgress(coverage({ archived: 3, missing: 1 }))).toMatchObject({ complete: false });
  expect(backupProgress(coverage({ archived: 1, missing: 0 }))).toMatchObject({ complete: false, unavailable: 2 });
  expect(backupProgress(coverage({ source: 0, archived: 0, missing: 0 }))).toMatchObject({ complete: false });
});

for (const state of ["saved", "unavailable", "empty"] as const) {
  test(`shows tracked scope without a whole-channel claim: ${state}`, async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem("channel-vault-language", "en"));
    const snapshot = state === "empty"
      ? coverage({ source: 0, archived: 0, missing: 0 })
      : coverage({ source: 500, archived: state === "saved" ? 500 : 499, missing: 0 });
    await page.route("**/api/channels/*/coverage", async (route) => {
      await route.fulfill({ json: snapshot });
    });
    await page.route("**/api/channels/1", async (route) => {
      const response = await route.fetch();
      const detail = await response.json();
      await route.fulfill({ response, json: { ...detail, video_count: 1200, coverage: snapshot } });
    });
    await page.goto("/#/dashboard?channel=1");
    const overview = page.locator(".channel-backup-overview").first();
    await expect(overview.getByText("Tracked videos", { exact: true })).toBeVisible();
    await expect(overview.locator(".channel-backup-counts div").filter({ hasText: "Tracked videos" }).locator("dd"))
      .toHaveText(state === "empty" ? "0" : "500");
    await expect(overview).toContainText("Each channel check reads up to 500 uploads");
    await expect(overview).not.toContainText("Every video on this channel is backed up");
    if (state === "saved") {
      await expect(overview.getByRole("heading", { name: "Tracked videos are backed up", exact: true })).toBeVisible();
      await expect(overview).toContainText("This does not confirm that the entire channel has been scanned");
    } else if (state === "unavailable") {
      await expect(overview.getByRole("heading", { name: "Some tracked videos have no local copy" })).toBeVisible();
      await expect(overview.getByRole("status").filter({ hasText: "no local media: 1" })).toBeVisible();
      await expect(overview).not.toContainText("Tracked videos are backed up");
    } else {
      await expect(overview.getByRole("heading", { name: "No videos have been indexed yet" })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("backup-progress.png"), fullPage: true });
  });
}
