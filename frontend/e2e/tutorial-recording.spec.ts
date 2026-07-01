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
  "03-firstrun": 22,
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

test("record tutorial segments", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });

  // ---- 03-firstrun (empty first run -> Load safe demo) -------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/dashboard");
    await page.getByText("See the full NAS console").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    const sel = "#cvn-anchor-demo";
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => /load safe demo/i.test(b.textContent || ""));
      if (btn) btn.id = "cvn-anchor-demo";
    });
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(2);
      await c.__cvn.moveToSel("#cvn-anchor-demo", 1100);
      c.__cvn.ringSel("#cvn-anchor-demo", 8, 12);
    });
    await page.waitForTimeout(1400);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.ripple());
    await page.waitForTimeout(250);
    await page.locator(sel).click();
    await page.getByText("Safe demo workspace").first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "03-firstrun", t);
  }

  // ---- 03b-overview (dashboard runway) ----------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/dashboard?channel=1");
    await page.getByText("archive command deck").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(null);
      const runway = document.querySelector('[aria-label="First run launch runway"]') || document.querySelector(".launch-runway");
      if (runway) runway.scrollIntoView({ block: "center", behavior: "smooth" });
      await c.__cvn.sleep(900);
      if (runway) {
        runway.id = "cvn-anchor-runway";
        await c.__cvn.moveToSel("#cvn-anchor-runway", 1000);
        c.__cvn.ringSel("#cvn-anchor-runway", 10, 18);
      }
    });
    await page.waitForTimeout(2600);
    // pan cursor across the 5 step chips
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const steps = Array.from(document.querySelectorAll(".launch-runway .runway-step, .launch-runway article")).slice(0, 5);
      for (const s of steps) {
        (s as HTMLElement).id = (s as HTMLElement).id || "cvn-rw-" + Math.random().toString(36).slice(2, 7);
        await c.__cvn.moveToSel("#" + (s as HTMLElement).id, 520);
        await c.__cvn.sleep(180);
      }
    });
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "03b-overview", t);
  }

  // ---- 04-register ------------------------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/channels/overview?channel=1");
    await page.locator(".registration-panel").first().waitFor({ timeout: 15000 });
    await page.evaluate(() => document.querySelector(".registration-panel")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(700);
    const input = page.locator(".registration-panel input").first();
    await page.evaluate(() => {
      const el = document.querySelector(".registration-panel input");
      if (el) (el as HTMLElement).id = "cvn-anchor-src";
    });
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(3);
      await c.__cvn.moveToSel("#cvn-anchor-src", 1000);
      c.__cvn.ringSel("#cvn-anchor-src", 6, 12);
    });
    await input.click();
    await input.fill("");
    await page.waitForTimeout(150);
    await input.pressSequentially("https://www.youtube.com/@wingnut0310", { delay: 45 });
    await page.waitForTimeout(700);
    // highlight quality segment
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const q = document.querySelector(".quality-segment");
      if (q) {
        (q as HTMLElement).id = "cvn-anchor-q";
        await c.__cvn.moveToSel("#cvn-anchor-q", 800);
        c.__cvn.ringSel("#cvn-anchor-q", 6, 12);
      }
    });
    await page.waitForTimeout(1500);
    // highlight the submit / register button (do NOT click — avoids a live network probe)
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      const form = document.querySelector(".registration-command") as HTMLElement | null;
      let btn: HTMLElement | null = form ? (form.querySelector('button[type="submit"]') as HTMLElement) : null;
      if (!btn && form) btn = Array.from(form.querySelectorAll("button")).pop() as HTMLElement;
      if (btn) {
        btn.id = "cvn-anchor-reg";
        await c.__cvn.moveToSel("#cvn-anchor-reg", 900);
        c.__cvn.ringSel("#cvn-anchor-reg", 6, 12);
        await c.__cvn.sleep(700);
        c.__cvn.ripple();
      }
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.clearRing());
    await finish(page, context, "04-register", t);
  }

  // ---- 05-progress (queue + animated download card) ---------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/queue?channel=1");
    await page.getByText("Global queue control").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      const c = window as unknown as { __cvn: any };
      c.__cvn.setBadge(4);
      // point at the queue list, then show a live download card climbing 0 -> 100%
      const list = document.querySelector(".queue-console, .queue-list, main") as HTMLElement | null;
      if (list) {
        list.id = list.id || "cvn-anchor-queue";
        await c.__cvn.moveToSel("#cvn-anchor-queue", 800);
      }
      await c.__cvn.moveTo(740, 705, 700);
      const card = await c.__cvn.progressCard({ seconds: 34, totalMB: 715, title: "Queue calibration pass", sub: "Signal Lab · 1080p · h264/aac", x: 316, y: 636, w: 862 });
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
    await page.getByText("archive command deck").first().waitFor({ timeout: 15000 });
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.titleCard());
    await finish(page, context, "01-intro", t);
  }

  // ---- 02-install (typed terminal) --------------------------------------
  {
    const { context, page } = await newRec(browser, "en");
    const t = Date.now();
    await goto(page, "#/dashboard?channel=1");
    await page.getByText("archive command deck").first().waitFor({ timeout: 15000 });
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
    await page.getByText("archive command deck").first().waitFor({ timeout: 15000 });
    await page.evaluate(() => (window as unknown as { __cvn: any }).__cvn.endCard());
    await finish(page, context, "09-outro", t);
  }
});
