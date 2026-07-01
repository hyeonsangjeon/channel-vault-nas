// Compose a per-language MP4: burn timed caption strips + place narration audio
// on the language-neutral RAW master.
// Inputs (under $CVN_TUT_WORK): RAW/channel-vault-nas-guide-RAW-master.mp4,
//   captions/<lang>/<id>.png, audio/<lang>/<id>.aiff
// Output: $CVN_TUT_WORK/final/channel-vault-nas-guide-<lang>.mp4
// Usage:  node frontend/e2e/tutorial/build-final.mjs <lang>   (default: all meta.langs)
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const WORK = process.env.CVN_TUT_WORK || resolve(repoRoot, ".tutorial-build");
const plan = JSON.parse(readFileSync(resolve(__dirname, "final-plan.json"), "utf8"));
const meta = JSON.parse(readFileSync(resolve(__dirname, "narration.json"), "utf8")).meta;

const segs = plan.segments;
const TOTAL = plan.total;
const LEAD = plan.leadIn;
const N = segs.length;
const CAPTION_Y = 850; // strip is 1440x150 on a 1440x1000 frame

const raw = join(WORK, "RAW", "channel-vault-nas-guide-RAW-master.mp4");
const outDir = join(WORK, "final");
mkdirSync(outDir, { recursive: true });

function build(lang) {
  const capDir = join(WORK, "captions", lang);
  const audDir = join(WORK, "audio", lang);
  const out = join(outDir, `channel-vault-nas-guide-${lang}.mp4`);

  const inputs = ["-i", raw];
  for (const s of segs) inputs.push("-i", join(capDir, `${s.id}.png`));
  for (const s of segs) inputs.push("-i", join(audDir, `${s.id}.aiff`));
  inputs.push("-f", "lavfi", "-t", String(TOTAL), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  const baseIdx = 1 + 2 * N;

  let f = "";
  let prev = "0:v";
  segs.forEach((s, k) => {
    const label = k === N - 1 ? "vout" : `v${k + 1}`;
    f += `[${prev}][${1 + k}:v]overlay=0:${CAPTION_Y}:enable='between(t,${s.start},${s.start + s.dur})'[${label}];`;
    prev = label;
  });
  segs.forEach((s, k) => {
    const delay = (s.start + LEAD) * 1000;
    f += `[${1 + N + k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${delay}|${delay}[a${k + 1}];`;
  });
  f += `[${baseIdx}:a]`;
  for (let k = 0; k < N; k++) f += `[a${k + 1}]`;
  f += `amix=inputs=${N + 1}:normalize=0:dropout_transition=0[aout]`;

  console.log(`[${lang}] encoding -> ${out}`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", ...inputs,
    "-filter_complex", f, "-map", "[vout]", "-map", "[aout]", "-t", String(TOTAL),
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out,
  ], { stdio: "inherit" });
  console.log(`[${lang}] done`);
}

const langs = process.argv[2] ? [process.argv[2]] : meta.langs;
for (const l of langs) build(l);
