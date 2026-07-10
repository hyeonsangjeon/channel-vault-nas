#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="${CVN_PUBLIC_DEMO_OUTPUT:-docs/assets/demo/channel-vault-public-alpha.webm}"
GIF_OUTPUT="${CVN_PUBLIC_DEMO_GIF_OUTPUT:-docs/assets/demo/channel-vault-public-alpha.gif}"
PROJECT="${CVN_PUBLIC_DEMO_PROJECT:-chromium}"
if [[ "$OUTPUT" = /* ]]; then
  OUTPUT_DISPLAY="$OUTPUT"
else
  OUTPUT_DISPLAY="$ROOT_DIR/$OUTPUT"
fi
if [[ "$GIF_OUTPUT" = /* ]]; then
  GIF_DISPLAY="$GIF_OUTPUT"
else
  GIF_DISPLAY="$ROOT_DIR/$GIF_OUTPUT"
fi

cd "$ROOT_DIR/frontend"

CVN_CAPTURE_PUBLIC_DEMO=true \
CVN_PUBLIC_DEMO_OUTPUT="$OUTPUT" \
npx playwright test e2e/public-demo-recording.spec.ts --project="$PROJECT"

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -ss 0.35 -i "$OUTPUT_DISPLAY" \
    -filter_complex "[0:v]fps=8,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    "$GIF_DISPLAY" >/dev/null 2>&1
else
  echo "ffmpeg not found; skipped GIF refresh: $GIF_DISPLAY" >&2
fi

cat <<EOF

Public demo recording complete.
Output: $OUTPUT_DISPLAY
README GIF: $GIF_DISPLAY

The generated WebM is ignored by git by default. The compact GIF is refreshed
for the GitHub README when ffmpeg is available.
EOF
