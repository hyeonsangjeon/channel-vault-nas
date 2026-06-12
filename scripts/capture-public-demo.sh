#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="${CVN_PUBLIC_DEMO_OUTPUT:-docs/assets/demo/channel-vault-public-alpha.webm}"
PROJECT="${CVN_PUBLIC_DEMO_PROJECT:-chromium}"
if [[ "$OUTPUT" = /* ]]; then
  OUTPUT_DISPLAY="$OUTPUT"
else
  OUTPUT_DISPLAY="$ROOT_DIR/$OUTPUT"
fi

cd "$ROOT_DIR/frontend"

CVN_CAPTURE_PUBLIC_DEMO=true \
CVN_PUBLIC_DEMO_OUTPUT="$OUTPUT" \
npx playwright test e2e/public-demo-recording.spec.ts --project="$PROJECT"

cat <<EOF

Public demo recording complete.
Output: $OUTPUT_DISPLAY

The generated WebM is ignored by git by default. Review it locally, then attach
it to a GitHub release, convert it to a GIF/MP4, or explicitly add the final
asset when you are ready to publish it.
EOF
