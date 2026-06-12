#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PY="${CVN_PUBLIC_ALPHA_BACKEND_PY:-$ROOT_DIR/backend/.venv/bin/python}"
BACKEND_RUFF="${CVN_PUBLIC_ALPHA_RUFF:-$ROOT_DIR/backend/.venv/bin/ruff}"
BACKEND_PYTEST="${CVN_PUBLIC_ALPHA_PYTEST:-$ROOT_DIR/backend/.venv/bin/pytest}"
PLAYWRIGHT_PROJECT="${CVN_PUBLIC_ALPHA_BROWSER_PROJECT:-chromium}"
PUBLIC_ALPHA_AUTH_TOKEN="${CVN_PUBLIC_ALPHA_AUTH_TOKEN:-cvn-public-alpha-check-operator-token}"

run_step() {
  local label="$1"
  shift
  printf "\n==> %s\n" "$label"
  "$@"
}

require_file() {
  local label="$1"
  local path="$2"
  if [[ ! -x "$path" ]]; then
    printf "missing %s: %s\n" "$label" "$path" >&2
    printf "Set up the backend first: cd backend && python3 -m venv .venv && .venv/bin/pip install -e \".[dev]\"\n" >&2
    exit 1
  fi
}

check_locale_keys() {
  node - <<'NODE'
const fs = require("node:fs");
const files = ["en", "ko", "ja", "zh", "hi"].map((lang) => `frontend/src/locales/${lang}.json`);
const entries = files.map((file) => [file, Object.keys(JSON.parse(fs.readFileSync(file, "utf8"))).sort()]);
const base = entries[0][1];
for (const [file, keys] of entries) {
  const missing = base.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !base.includes(key));
  if (missing.length || extra.length) {
    console.error(file, { missing, extra });
    process.exit(1);
  }
}
console.log(`ok: ${base.length} locale keys across ${files.length} languages`);
NODE
}

check_public_surface() {
  local paths=(
    "README.md"
    "CHANGELOG.md"
    "CONTRIBUTING.md"
    "SECURITY.md"
    ".github/PULL_REQUEST_TEMPLATE.md"
    ".github/ISSUE_TEMPLATE/bug_report.yml"
    ".github/ISSUE_TEMPLATE/feature_request.yml"
    ".github/workflows/ci.yml"
    "docs/roadmap.md"
    "docs/public-alpha-demo.md"
    "docs/deployment-security.md"
    "scripts/deployment-smoke.sh"
    "scripts/capture-public-demo.sh"
    "docs/assets/demo/README.md"
    "docs/assets/screenshots/dashboard-cockpit.png"
    "docs/assets/screenshots/channel-downloads.png"
    "docs/assets/screenshots/queue-console.png"
    "docs/assets/screenshots/library-shelf.png"
    "docs/assets/screenshots/runtime-guide.png"
    "frontend/public/favicon.svg"
    "frontend/public/social-preview.svg"
    "frontend/public/site.webmanifest"
  )

  for path in "${paths[@]}"; do
    if [[ ! -f "$path" ]]; then
      printf "missing public alpha surface: %s\n" "$path" >&2
      exit 1
    fi
  done

  printf "ok: %s public alpha files present\n" "${#paths[@]}"
}

require_file "backend python" "$BACKEND_PY"
require_file "ruff" "$BACKEND_RUFF"
require_file "pytest" "$BACKEND_PYTEST"

cd "$ROOT_DIR"

run_step "backend lint" "$BACKEND_RUFF" check backend/app backend/tests backend/scripts
run_step "backend tests" "$BACKEND_PYTEST" backend/tests -q
run_step "locale keys" check_locale_keys
run_step "public repo surface" check_public_surface
run_step "release script syntax" bash -lc "bash -n scripts/public-alpha-check.sh && bash -n scripts/compose-smoke.sh && bash -n scripts/deployment-smoke.sh && bash -n scripts/capture-public-demo.sh"
run_step "frontend build" bash -lc "cd frontend && npm run build"

if [[ "${CVN_PUBLIC_ALPHA_SKIP_BROWSER:-false}" == "true" ]]; then
  printf "\n==> browser smoke skipped by CVN_PUBLIC_ALPHA_SKIP_BROWSER=true\n"
else
  quoted_project="$(printf "%q" "$PLAYWRIGHT_PROJECT")"
  quoted_auth_token="$(printf "%q" "$PUBLIC_ALPHA_AUTH_TOKEN")"
  run_step "browser smoke (${PLAYWRIGHT_PROJECT})" bash -lc "cd frontend && npm run e2e:smoke -- --project=${quoted_project}"
  run_step "browser auth gate (${PLAYWRIGHT_PROJECT})" bash -lc "cd frontend && CVN_E2E_AUTH_TOKEN=${quoted_auth_token} npm run e2e:auth -- --project=${quoted_project}"
fi

run_step "diff whitespace" git diff --check

printf "\nPublic alpha check passed.\n"
