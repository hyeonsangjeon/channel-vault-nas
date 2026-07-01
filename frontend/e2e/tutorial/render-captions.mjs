// Render burned-in caption strips with a real browser (perfect CJK glyphs).
// Output: $CVN_TUT_WORK/captions/<lang>/<segid>.png  (1440x150, transparent)
// Usage:  node frontend/e2e/tutorial/render-captions.mjs
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const WORK = process.env.CVN_TUT_WORK || resolve(repoRoot, ".tutorial-build");
const outRoot = join(WORK, "captions");
const data = JSON.parse(readFileSync(resolve(__dirname, "narration.json"), "utf8"));
const { langs } = data.meta;

const STRIP_W = 1440;
const STRIP_H = 150;
const fontFor = {
  en: `-apple-system, "Helvetica Neue", Arial, sans-serif`,
  ko: `"Apple SD Gothic Neo", "Helvetica Neue", sans-serif`,
  ja: `"Hiragino Sans", "Hiragino Kaku Gothic Pro", sans-serif`,
  zh: `"PingFang SC", "Hiragino Sans GB", sans-serif`,
};
const fallbackFont = `-apple-system, "Apple SD Gothic Neo", "Hiragino Sans", "PingFang SC", sans-serif`;

function html(text, fontFamily) {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${STRIP_W}px;height:${STRIP_H}px;background:transparent}
    .wrap{width:${STRIP_W}px;height:${STRIP_H}px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:22px}
    .bar{max-width:1220px;background:rgba(7,11,19,0.86);border:1px solid rgba(125,165,225,0.40);
      box-shadow:0 6px 26px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.05);border-radius:16px;
      padding:13px 30px;color:#eef4ff;font-family:${fontFamily};font-size:31px;font-weight:600;
      line-height:1.32;text-align:center;letter-spacing:0.1px;text-shadow:0 1px 2px rgba(0,0,0,0.5)}
  </style></head><body><div class="wrap"><div class="bar">${safe}</div></div></body></html>`;
}

for (const l of langs) mkdirSync(join(outRoot, l), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: STRIP_W, height: STRIP_H }, deviceScaleFactor: 1 });
let n = 0;
for (const seg of data.segments) {
  for (const l of langs) {
    await page.setContent(html(seg.caption[l], fontFor[l] || fallbackFont), { waitUntil: "networkidle" });
    await page.waitForTimeout(60);
    await page.screenshot({
      path: join(outRoot, l, `${seg.id}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: STRIP_W, height: STRIP_H },
    });
    n++;
  }
}
await browser.close();
console.log(`rendered ${n} caption PNGs -> ${outRoot}`);
