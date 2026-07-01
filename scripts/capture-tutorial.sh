#!/usr/bin/env bash
# Regenerate the multilingual install/usage tutorial video from scratch.
#
# Pipeline (macOS; needs ffmpeg + the `say` TTS engine + Playwright chromium):
#   1. record   - drive the app with the safe demo data, record one webm per screen
#   2. tts      - synthesise narration per language with `say`
#   3. captions - render burned-in caption strips with a real browser (crisp CJK)
#   4. master   - trim + concat the language-neutral RAW master (reusable)
#   5. final    - compose one MP4 per language (captions + narration on the master)
#
# All artefacts land in $CVN_TUT_WORK (default: <repo>/.tutorial-build, git-ignored).
# Screens are stored individually so a UI change only needs the affected screen
# re-recorded (edit the matching block in e2e/tutorial-recording.spec.ts), then
# re-run `master` + `final`.
#
# Usage:  scripts/capture-tutorial.sh [all|record|tts|captions|master|final]
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${1:-all}"
export CVN_TUT_WORK="${CVN_TUT_WORK:-$ROOT_DIR/.tutorial-build}"
PROJECT="${CVN_TUT_PROJECT:-chromium}"
TUT="$ROOT_DIR/frontend/e2e/tutorial"
mkdir -p "$CVN_TUT_WORK"

run_record() {
  echo "== [1/5] recording per-screen webm segments =="
  ( cd "$ROOT_DIR/frontend" && \
    CVN_RECORD_TUTORIAL=true CVN_E2E_SKIP_SEED=true \
    CVN_TUT_OUT="$CVN_TUT_WORK/segments-webm" \
    npx playwright test e2e/tutorial-recording.spec.ts --project="$PROJECT" )
}
run_tts()      { echo "== [2/5] narration (say) ==";      node "$TUT/tts.mjs"; }
run_captions() { echo "== [3/5] caption strips (browser) =="; node "$TUT/render-captions.mjs"; }
run_master()   { echo "== [4/5] RAW master ==";           node "$TUT/build-master.mjs"; }
run_final()    { echo "== [5/5] per-language MP4s ==";    node "$TUT/build-final.mjs"; }

case "$STAGE" in
  record) run_record ;;
  tts) run_tts ;;
  captions) run_captions ;;
  master) run_master ;;
  final) run_final ;;
  all) run_record; run_tts; run_captions; run_master; run_final ;;
  *) echo "unknown stage: $STAGE" >&2; exit 2 ;;
esac

cat <<EOF

Tutorial build stage '$STAGE' complete.
Work dir : $CVN_TUT_WORK
RAW master   : $CVN_TUT_WORK/RAW/channel-vault-nas-guide-RAW-master.mp4
Per-screen   : $CVN_TUT_WORK/RAW/segments/ (+ segments-source-webm/)
Per-language : $CVN_TUT_WORK/final/channel-vault-nas-guide-<lang>.mp4

Video binaries are git-ignored. Attach them to a GitHub release or docs host;
do not commit the large MP4/WebM files.
EOF
