import { chromium } from "@playwright/test";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(frontendDir, "..");
const docsOutput = path.join(repoRoot, "docs/assets/social-preview.png");
const publicOutput = path.join(frontendDir, "public/social-preview.png");

const toDataUrl = (buffer, mimeType) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const logo = toDataUrl(
  await readFile(path.join(repoRoot, "docs/assets/producthunt-thumbnail.png")),
  "image/png",
);
const screen = toDataUrl(
  await readFile(path.join(repoRoot, "docs/assets/screenshots/channel-downloads.png")),
  "image/png",
);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1280px; height: 640px; overflow: hidden; }
      body {
        position: relative;
        background: #07090d;
        color: #f8fafc;
        font-family: Inter, "SF Pro Display", "Segoe UI", Arial, sans-serif;
      }
      .rule { position: absolute; left: 0; top: 0; width: 12px; height: 640px; background: #22d3ee; }
      .rule-green { position: absolute; left: 12px; top: 426px; width: 4px; height: 214px; background: #34d399; }
      .copy { position: absolute; left: 58px; top: 48px; width: 480px; z-index: 2; }
      .brand { display: flex; align-items: center; gap: 16px; }
      .brand img { width: 58px; height: 58px; border-radius: 8px; }
      .brand-name { font-size: 25px; font-weight: 800; letter-spacing: 0; }
      .brand-note { margin-top: 4px; color: #94a3b8; font-size: 15px; font-weight: 600; }
      .eyebrow { margin-top: 54px; color: #38bdf8; font-size: 17px; font-weight: 800; text-transform: uppercase; }
      h1 { margin: 16px 0 0; width: 470px; font-size: 58px; line-height: 1.02; letter-spacing: 0; }
      .summary { margin-top: 24px; width: 455px; color: #cbd5e1; font-size: 21px; line-height: 1.42; font-weight: 550; }
      .proof { margin-top: 26px; color: #a7f3d0; font-size: 16px; font-weight: 750; }
      .url { position: absolute; left: 58px; bottom: 38px; color: #94a3b8; font-size: 16px; font-weight: 650; }
      .screen {
        position: absolute;
        left: 560px;
        top: 70px;
        width: 840px;
        height: 540px;
        overflow: hidden;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #0b0d12;
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.48);
      }
      .screen img { width: 840px; height: 642px; object-fit: cover; object-position: left top; display: block; }
      .screen-label {
        position: absolute;
        top: 38px;
        right: 160px;
        padding: 9px 12px;
        border: 1px solid #0e7490;
        border-radius: 6px;
        background: #082f49;
        color: #cffafe;
        font-size: 14px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <div class="rule"></div>
    <div class="rule-green"></div>
    <main class="copy">
      <div class="brand">
        <img src="${logo}" alt="">
        <div>
          <div class="brand-name">Channel Vault NAS</div>
          <div class="brand-note">Open-source archive console</div>
        </div>
      </div>
      <div class="eyebrow">YouTube channel backup for NAS</div>
      <h1>Your channel, backed up.</h1>
      <div class="summary">Reuse archive.txt and existing media. Download only what is missing. Recover the library from disk.</div>
      <div class="proof">Docker Compose | AMD64 + ARM64 | MIT</div>
    </main>
    <div class="url">github.com/hyeonsangjeon/channel-vault-nas</div>
    <section class="screen">
      <img src="${screen}" alt="">
      <div class="screen-label">Missing-only automatic backup</div>
    </section>
  </body>
</html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: docsOutput, type: "png" });
  await copyFile(docsOutput, publicOutput);
} finally {
  await browser.close();
}

console.log(`wrote ${path.relative(repoRoot, docsOutput)}`);
console.log(`wrote ${path.relative(repoRoot, publicOutput)}`);
