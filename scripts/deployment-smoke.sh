#!/usr/bin/env bash
set -Eeuo pipefail

WEB_URL="${CVN_DEPLOYMENT_SMOKE_WEB_URL:-http://127.0.0.1:5173}"
RAW_API_URL="${CVN_DEPLOYMENT_SMOKE_RAW_API_URL:-}"
FORBIDDEN_API_URL="${CVN_DEPLOYMENT_SMOKE_FORBIDDEN_API_URL:-}"
AUTH_TOKEN="${CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN:-${CVN_AUTH_TOKEN:-}}"
REQUIRE_TOKEN="${CVN_DEPLOYMENT_SMOKE_REQUIRE_TOKEN:-false}"
SKIP_WS="${CVN_DEPLOYMENT_SMOKE_SKIP_WS:-false}"
CONNECT_TIMEOUT="${CVN_DEPLOYMENT_SMOKE_CONNECT_TIMEOUT:-5}"
MAX_TIME="${CVN_DEPLOYMENT_SMOKE_MAX_TIME:-15}"
WS_MAX_TIME="${CVN_DEPLOYMENT_SMOKE_WS_MAX_TIME:-5}"

CURL_OPTS=(--connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME")
if [[ "${CVN_DEPLOYMENT_SMOKE_INSECURE:-false}" == "true" ]]; then
  CURL_OPTS+=(-k)
fi

fail() {
  printf "failed: %s\n" "$*" >&2
  exit 1
}

ok() {
  printf "ok: %s\n" "$*"
}

warn() {
  printf "warn: %s\n" "$*" >&2
}

url_join() {
  local base="${1%/}"
  local path="$2"
  printf "%s%s" "$base" "$path"
}

urlencode() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$1" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=""))
PY
  else
    printf "%s" "$1"
  fi
}

token_query_url() {
  local url="$1"
  local separator="?"
  if [[ "$url" == *\?* ]]; then
    separator="&"
  fi
  printf "%s%scvn_token=%s" "$url" "$separator" "$(urlencode "$AUTH_TOKEN")"
}

is_success_status() {
  [[ "$1" =~ ^[23][0-9][0-9]$ ]]
}

curl_status() {
  local url="$1"
  shift || true
  curl "${CURL_OPTS[@]}" -sS -o /dev/null -w "%{http_code}" "$@" "$url"
}

curl_status_silent() {
  local url="$1"
  shift || true
  curl "${CURL_OPTS[@]}" -s -o /dev/null -w "%{http_code}" "$@" "$url"
}

expect_status() {
  local label="$1"
  local expected="$2"
  local url="$3"
  shift 3

  local status
  if ! status="$(curl_status "$url" "$@")"; then
    fail "$label request failed"
  fi
  if [[ "$status" != "$expected" ]]; then
    fail "$label expected HTTP $expected, got $status"
  fi
  ok "$label HTTP $status"
}

expect_success() {
  local label="$1"
  local url="$2"
  shift 2

  local status
  if ! status="$(curl_status "$url" "$@")"; then
    fail "$label request failed"
  fi
  if ! is_success_status "$status"; then
    fail "$label expected HTTP 2xx/3xx, got $status"
  fi
  ok "$label HTTP $status"
}

websocket_status() {
  local url="$1"
  shift || true
  curl "${CURL_OPTS[@]}" --http1.1 --max-time "$WS_MAX_TIME" -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    "$@" \
    "$url" || true
}

check_dashboard_auth() {
  local base_url="$1"
  local label="$2"
  local dashboard_url
  dashboard_url="$(url_join "$base_url" "/api/dashboard")"

  if [[ -n "$AUTH_TOKEN" ]]; then
    expect_status "$label dashboard without token" "401" "$dashboard_url"
    expect_status "$label dashboard bearer token" "200" "$dashboard_url" -H "Authorization: Bearer $AUTH_TOKEN"
    expect_status "$label dashboard X-CVN-Token" "200" "$dashboard_url" -H "X-CVN-Token: $AUTH_TOKEN"
    return
  fi

  local status
  if ! status="$(curl_status "$dashboard_url")"; then
    fail "$label dashboard request failed"
  fi
  case "$status" in
    200)
      warn "$label dashboard is reachable without a token; set CVN_AUTH_TOKEN before LAN/proxy exposure"
      ;;
    401)
      warn "$label dashboard is protected, but no token was provided to verify the authenticated path"
      ;;
    *)
      fail "$label dashboard expected HTTP 200 or 401 without a token, got $status"
      ;;
  esac
}

check_websocket() {
  local base_url="$1"
  local label="$2"
  local ws_url
  ws_url="$(url_join "$base_url" "/ws/events")"

  if [[ "$SKIP_WS" == "true" ]]; then
    warn "$label WebSocket smoke skipped by CVN_DEPLOYMENT_SMOKE_SKIP_WS=true"
    return
  fi

  if [[ -n "$AUTH_TOKEN" ]]; then
    local denied_status
    denied_status="$(websocket_status "$ws_url")"
    if [[ "$denied_status" != "403" ]]; then
      fail "$label WebSocket without token expected HTTP 403, got $denied_status"
    fi
    ok "$label WebSocket without token HTTP $denied_status"

    local accepted_status
    accepted_status="$(websocket_status "$(token_query_url "$ws_url")")"
    if [[ "$accepted_status" != "101" ]]; then
      fail "$label WebSocket with token expected HTTP 101, got $accepted_status"
    fi
    ok "$label WebSocket with token HTTP $accepted_status"
    return
  fi

  local status
  status="$(websocket_status "$ws_url")"
  if [[ "$status" == "101" ]]; then
    ok "$label WebSocket HTTP $status"
  elif [[ "$status" == "403" ]]; then
    warn "$label WebSocket is protected, but no token was provided"
  else
    fail "$label WebSocket expected HTTP 101 or 403, got $status"
  fi
}

check_base() {
  local base_url="$1"
  local label="$2"

  expect_success "$label web root" "$(url_join "$base_url" "/")"
  expect_status "$label proxied API health" "200" "$(url_join "$base_url" "/api/health")"
  check_dashboard_auth "$base_url" "$label"
  check_websocket "$base_url" "$label"
}

check_raw_api() {
  local base_url="$1"
  local label="$2"

  expect_status "$label API health" "200" "$(url_join "$base_url" "/api/health")"
  check_dashboard_auth "$base_url" "$label"
}

check_forbidden_api() {
  local base_url="$1"
  local label="$2"
  local status

  status="$(curl_status_silent "$(url_join "$base_url" "/api/health")" || true)"
  if is_success_status "$status"; then
    fail "$label raw API health is reachable at HTTP $status; do not expose the backend API port directly"
  fi
  ok "$label raw API health not publicly reachable (HTTP ${status:-000})"
}

if [[ "$REQUIRE_TOKEN" == "true" && -z "$AUTH_TOKEN" ]]; then
  fail "CVN_DEPLOYMENT_SMOKE_REQUIRE_TOKEN=true but no CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN/CVN_AUTH_TOKEN was provided"
fi

check_base "$WEB_URL" "web/proxy"

if [[ -n "$RAW_API_URL" ]]; then
  check_raw_api "$RAW_API_URL" "raw API"
fi

if [[ -n "$FORBIDDEN_API_URL" ]]; then
  check_forbidden_api "$FORBIDDEN_API_URL" "forbidden public API"
fi

cat <<EOF

Deployment smoke passed.
Web/proxy: ${WEB_URL}
Protected access: $(if [[ -n "$AUTH_TOKEN" ]]; then printf "verified"; else printf "not verified (no token provided)"; fi)
Raw API check: $(if [[ -n "$RAW_API_URL" ]]; then printf "verified"; else printf "skipped"; fi)
Forbidden API check: $(if [[ -n "$FORBIDDEN_API_URL" ]]; then printf "verified"; else printf "skipped"; fi)
EOF
