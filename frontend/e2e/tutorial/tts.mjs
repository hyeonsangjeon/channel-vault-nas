// Generate narration audio with the macOS `say` TTS engine.
// Output: $CVN_TUT_WORK/audio/<lang>/<segid>.aiff  (+ durations.json)
// Usage:  node frontend/e2e/tutorial/tts.mjs
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const WORK = process.env.CVN_TUT_WORK || resolve(repoRoot, ".tutorial-build");
const data = JSON.parse(readFileSync(resolve(__dirname, "narration.json"), "utf8"));
const { voices, langs } = data.meta;
const outRoot = join(WORK, "audio");
mkdirSync(outRoot, { recursive: true });

const dur = (f) =>
  parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(f)}`).toString().trim());

const durations = {};
for (const seg of data.segments) {
  durations[seg.id] = {};
  for (const lang of langs) {
    const dir = join(outRoot, lang);
    mkdirSync(dir, { recursive: true });
    const aiff = join(dir, `${seg.id}.aiff`);
    const tf = join(dir, `${seg.id}.txt`);
    writeFileSync(tf, seg.narration[lang], "utf8");
    execSync(`say -v ${JSON.stringify(voices[lang])} -o ${JSON.stringify(aiff)} -f ${JSON.stringify(tf)}`);
    durations[seg.id][lang] = Math.round(dur(aiff) * 100) / 100;
  }
}
writeFileSync(join(WORK, "durations.json"), JSON.stringify(durations, null, 2));
console.log("TTS complete ->", outRoot);
for (const seg of data.segments)
  console.log(seg.id.padEnd(13), langs.map((l) => `${l}:${durations[seg.id][l]}`).join("  "));
