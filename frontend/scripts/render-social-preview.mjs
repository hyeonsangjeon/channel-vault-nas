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
  await readFile(path.join(repoRoot, "docs/assets/user-manual/en/01-home.png")),
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
        background: #f6f7fb;
        color: #172033;
        font-family: Inter, "SF Pro Display", "Segoe UI", Arial, sans-serif;
      }
      .glow {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 7% 10%, rgba(109, 94, 252, 0.12), transparent 32%),
          radial-gradient(circle at 86% 92%, rgba(21, 173, 131, 0.10), transparent 34%);
      }
      .copy { position: absolute; left: 58px; top: 52px; width: 480px; z-index: 2; }
      .brand { display: flex; align-items: center; gap: 16px; }
      .brand img { width: 58px; height: 58px; border-radius: 15px; box-shadow: 0 10px 24px rgba(23, 32, 51, 0.16); }
      .brand-name { font-size: 25px; font-weight: 800; letter-spacing: 0; }
      .brand-note { margin-top: 4px; color: #697386; font-size: 15px; font-weight: 650; }
      .eyebrow { margin-top: 52px; color: #6557e8; font-size: 16px; font-weight: 850; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 { margin: 16px 0 0; width: 470px; font-size: 56px; line-height: 1.04; letter-spacing: -0.035em; }
      .summary { margin-top: 24px; width: 455px; color: #566176; font-size: 21px; line-height: 1.42; font-weight: 560; }
      .steps { display: flex; gap: 10px; margin-top: 28px; }
      .steps span {
        padding: 9px 12px;
        border: 1px solid #dce0ea;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.82);
        color: #475267;
        font-size: 14px;
        font-weight: 760;
      }
      .url { position: absolute; left: 58px; bottom: 38px; color: #7b8496; font-size: 16px; font-weight: 650; }
      .screen {
        position: absolute;
        left: 560px;
        top: 66px;
        width: 846px;
        height: 548px;
        overflow: hidden;
        border: 1px solid #d5d9e4;
        border-radius: 20px;
        background: #ffffff;
        box-shadow: 0 28px 70px rgba(59, 65, 84, 0.18);
      }
      .screen img { width: 846px; height: 548px; object-fit: cover; object-position: left top; display: block; }
      .screen-label {
        position: absolute;
        top: 26px;
        right: 132px;
        padding: 10px 14px;
        border: 1px solid #d7d0ff;
        border-radius: 999px;
        background: #f1efff;
        color: #5145c8;
        font-size: 14px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <div class="glow"></div>
    <main class="copy">
      <div class="brand">
        <img src="${logo}" alt="">
        <div>
          <div class="brand-name">Channel Vault NAS</div>
          <div class="brand-note">Automatic video backup for NAS</div>
        </div>
      </div>
      <div class="eyebrow">YouTube channel backup for NAS</div>
      <h1>Your channel, backed up.</h1>
      <div class="summary">Reuse archive.txt and existing media. Download only what is missing. Recover the library from disk.</div>
      <div class="steps"><span>1 Add channel</span><span>2 Set schedule</span><span>3 Check status</span></div>
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
