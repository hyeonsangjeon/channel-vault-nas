// Trim each recorded webm to its exact plan duration, normalise, and concat into
// the language-neutral RAW master. Also keeps per-screen segments for re-editing.
// Input:  $CVN_TUT_WORK/segments-webm/<id>.webm
// Output: $CVN_TUT_WORK/RAW/{channel-vault-nas-guide-RAW-master.mp4, segments/, segments-source-webm/}
// Usage:  node frontend/e2e/tutorial/build-master.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const WORK = process.env.CVN_TUT_WORK || resolve(repoRoot, ".tutorial-build");
const plan = JSON.parse(readFileSync(resolve(__dirname, "final-plan.json"), "utf8"));

const inDir = join(WORK, "segments-webm");
const rawDir = join(WORK, "RAW");
const segDir = join(rawDir, "segments");
const srcDir = join(rawDir, "segments-source-webm");
mkdirSync(segDir, { recursive: true });
mkdirSync(srcDir, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

const concat = [];
for (const s of plan.segments) {
  const src = join(inDir, `${s.id}.webm`);
  const out = join(segDir, `${s.id}.mp4`);
  copyFileSync(src, join(srcDir, `${s.id}.webm`));
  ff([
    "-i", src, "-t", String(s.dur), "-an",
    "-vf", "scale=1440:1000:flags=lanczos,fps=30,format=yuv420p,setsar=1",
    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out,
  ]);
  concat.push(`file 'segments/${s.id}.mp4'`);
  console.log(`trimmed ${s.id} -> ${s.dur}s`);
}
const listFile = join(rawDir, "concat.txt");
writeFileSync(listFile, concat.join("\n") + "\n");
const master = join(rawDir, "channel-vault-nas-guide-RAW-master.mp4");
ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", master]);
console.log(`RAW master -> ${master}`);
