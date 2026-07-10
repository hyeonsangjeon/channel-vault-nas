#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${CVN_USER_MANUAL_SCREENSHOT_PROJECT:-chromium}"

cd "$ROOT_DIR/frontend"

for LANG in en ko; do
  CVN_CAPTURE_USER_MANUAL_SCREENSHOTS=true \
  CVN_MANUAL_LANG="$LANG" \
  npx playwright test e2e/user-manual-screenshots.spec.ts --project="$PROJECT"
done

cat <<EOF

English and Korean user-manual screenshots refreshed.
Output: $ROOT_DIR/docs/assets/user-manual/{en,ko}/
EOF
