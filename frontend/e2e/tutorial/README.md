# Install / usage tutorial video harness

Reproducible, per-screen, multilingual walkthrough of **install → register a channel →
watch the backup progress**, recorded against the app's built-in **safe demo data**
(no real downloads, no live YouTube calls). Every screen is captured on its own so a
future UI change only requires re-recording the screens that changed.

## Output

| Artefact | Path (under `$CVN_TUT_WORK`) | Notes |
|---|---|---|
| Language-neutral RAW master | `RAW/channel-vault-nas-guide-RAW-master.mp4` | No captions/audio — reuse to add languages |
| Per-screen (neutral) | `RAW/segments/<id>.mp4` | Trimmed, exact durations |
| Per-screen (source) | `RAW/segments-source-webm/<id>.webm` | Original recordings, re-trimmable |
| Per-language final | `final/channel-vault-nas-guide-<lang>.mp4` | Captions + narration, ~5:09 each |

`$CVN_TUT_WORK` defaults to `<repo>/.tutorial-build` (git-ignored). The MP4/WebM
binaries are **not** committed — attach them to a GitHub release or a docs host.

## Requirements (macOS)

- `ffmpeg` + `ffprobe` (the bundled build needs only `overlay`; no libass/drawtext required)
- Playwright chromium (`cd frontend && npx playwright install chromium`)
- macOS `say` TTS voices: Samantha (en), Yuna (ko), Kyoko (ja), Tingting (zh)

## Run

```bash
# full pipeline (record → tts → captions → master → final)
scripts/capture-tutorial.sh

# or one stage at a time
scripts/capture-tutorial.sh record     # per-screen webm (auto-boots backend+frontend, seeds demo)
scripts/capture-tutorial.sh tts        # narration audio
scripts/capture-tutorial.sh captions   # burned caption strips (browser-rendered, crisp CJK)
scripts/capture-tutorial.sh master     # RAW language-neutral master
scripts/capture-tutorial.sh final      # one MP4 per language
```

## Files

| File | Role |
|---|---|
| `../tutorial-recording.spec.ts` | Drives the app + records one webm per screen (one `{ }` block per screen) |
| `overlay.js` | Language-neutral annotation engine (fake cursor, highlight ring, STEP badge, terminal + progress cards, title/end cards) |
| `narration.json` | Source of truth: per-language captions + narration + `say` voices |
| `final-plan.json` | Timeline: each screen's `start` / `dur` (seconds) and `leadIn` |
| `tts.mjs` | `say` → `audio/<lang>/<id>.aiff` |
| `render-captions.mjs` | Browser → `captions/<lang>/<id>.png` |
| `build-master.mjs` | Trim + concat → RAW master |
| `build-final.mjs` | Overlay captions + mix narration → per-language MP4 |

## Editing

- **Change wording / add a language** — edit `narration.json` (and `meta.langs` /
  `meta.voices`), then re-run `tts`, `captions`, `final`.
- **Re-time a screen** — edit its `dur` in `final-plan.json` and the matching `DUR`
  entry in `tutorial-recording.spec.ts`, then re-run `record` (that screen), `master`, `final`.
- **UI moved** — update the selectors in the matching screen block in
  `tutorial-recording.spec.ts`, re-run `record`, `master`, `final`.

## Copy the RAW master to external storage (for future multilingual re-use)

```bash
cp -R "$CVN_TUT_WORK/RAW" "/Volumes/<your-drive>/channel-vault-nas-guide-RAW"
```
