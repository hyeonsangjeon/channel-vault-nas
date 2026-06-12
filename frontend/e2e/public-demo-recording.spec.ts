import { expect, type Browser, type Page, test } from "@playwright/test";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const captureEnabled = process.env.CVN_CAPTURE_PUBLIC_DEMO === "true";
const frontendPort = process.env.CVN_E2E_FRONTEND_PORT ?? "5174";
const frontendUrl = process.env.CVN_PUBLIC_DEMO_FRONTEND_URL ?? `http://127.0.0.1:${frontendPort}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const videoDir = resolve(repoRoot, "frontend/test-results/public-demo-video");
const outputPath = resolveOutputPath(process.env.CVN_PUBLIC_DEMO_OUTPUT ?? "docs/assets/demo/channel-vault-public-alpha.webm");

test.skip(!captureEnabled, "Set CVN_CAPTURE_PUBLIC_DEMO=true to record the public demo video.");
test.setTimeout(120_000);

async function openEnglishVault(page: Page, path = "/") {
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
  await page.goto(`${frontendUrl}${path}`);
  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
}

async function hold(page: Page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function go(page: Page, hashPath: string) {
  await page.goto(`${frontendUrl}${hashPath}`);
  await hold(page);
}

async function recordDemo(browser: Browser) {
  mkdirSync(videoDir, { recursive: true });
  mkdirSync(dirname(outputPath), { recursive: true });

  const context = await browser.newContext({
    locale: "en-US",
    recordVideo: {
      dir: videoDir,
      size: { width: 1440, height: 1000 },
    },
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  await openEnglishVault(page);
  await expect(page.getByLabel("Dashboard operating cockpit")).toContainText("Know what needs attention");
  await hold(page, 1300);

  await go(page, "/#/channels/downloads?channel=1");
  await expect(page.getByLabel("Channel detail tabs").getByRole("button", { name: "Downloads" })).toHaveClass(/active/);
  await expect(page.getByText("Dry-run the download wave")).toBeVisible();

  await go(page, "/#/queue?channel=1");
  await expect(page.getByLabel("Global queue control")).toContainText("Download operations");

  await go(page, "/#/channels/library?channel=1");
  await expect(page.getByText("Indexed media shelf")).toBeVisible();
  await hold(page, 1000);

  await go(page, "/#/insights");
  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Volume Map" })).toBeVisible();
  await hold(page, 1000);

  await go(page, "/#/settings?runtime=guide");
  const runtimeGuide = page.getByLabel("Runtime env manifest");
  await expect(runtimeGuide).toBeVisible();
  await expect(runtimeGuide).toContainText("Live deployment smoke");
  await runtimeGuide.getByLabel("External exposure cookbook").scrollIntoViewIfNeeded();
  await hold(page, 1300);

  await go(page, "/#/dashboard");
  await expect(page.getByLabel("Release readiness checklist")).toContainText("Public readiness");
  await expect(page.getByLabel("Beta onboarding proof")).toBeVisible();
  await hold(page, 1000);

  const video = page.video();
  await page.close();
  await context.close();

  const videoPath = await video?.path();
  if (!videoPath) {
    throw new Error("Playwright did not produce a demo video.");
  }
  copyFileSync(videoPath, outputPath);
  const { size } = statSync(outputPath);
  if (size <= 0) {
    throw new Error(`Demo video is empty: ${outputPath}`);
  }
  console.log(`public demo video: ${outputPath} (${size} bytes)`);
}

test("record public alpha demo video", async ({ browser }) => {
  await recordDemo(browser);
});

function resolveOutputPath(value: string) {
  return isAbsolute(value) ? value : resolve(repoRoot, value);
}
