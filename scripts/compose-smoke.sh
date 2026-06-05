#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_ROOT="${CVN_COMPOSE_SMOKE_ROOT:-${TMPDIR:-/tmp}/channel-vault-compose-smoke}"

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-channel-vault-nas-smoke}"
export CVN_WEB_PORT="${CVN_WEB_PORT:-15173}"
export CVN_API_PORT="${CVN_API_PORT:-18000}"
export CVN_METADATA_HOST_DIR="${CVN_METADATA_HOST_DIR:-$SMOKE_ROOT/metadata}"
export CVN_DOWNLOAD_HOST_DIR="${CVN_DOWNLOAD_HOST_DIR:-$SMOKE_ROOT/downfolder}"
export CVN_RUNTIME_HOST_DIR="${CVN_RUNTIME_HOST_DIR:-$SMOKE_ROOT/runtime}"

export CVN_DB_BACKUP_ON_STARTUP="${CVN_DB_BACKUP_ON_STARTUP:-true}"
export CVN_DB_MIGRATE_ON_STARTUP="${CVN_DB_MIGRATE_ON_STARTUP:-true}"
export CVN_DOWNLOAD_WORKER_ENABLED="${CVN_DOWNLOAD_WORKER_ENABLED:-false}"
export CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED="${CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED:-false}"
export CVN_METADATA_SYNC_SCHEDULER_ENABLED="${CVN_METADATA_SYNC_SCHEDULER_ENABLED:-false}"
export CVN_RESTART_ADAPTER="${CVN_RESTART_ADAPTER:-docker-compose}"
export CVN_RESTART_SERVICE_NAME="${CVN_RESTART_SERVICE_NAME:-api}"
export CVN_RESTART_ADAPTER_EXECUTE="${CVN_RESTART_ADAPTER_EXECUTE:-false}"

mkdir -p "$CVN_METADATA_HOST_DIR" "$CVN_DOWNLOAD_HOST_DIR" "$CVN_RUNTIME_HOST_DIR"

cd "$ROOT_DIR"

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is not available." >&2
  exit 1
fi

if [[ "${CVN_COMPOSE_SMOKE_BUILD:-true}" == "false" ]]; then
  docker compose up -d
else
  docker compose up -d --build
fi

wait_for_url() {
  local label="$1"
  local url="$2"
  local attempts="${3:-90}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -fsS "$url" >/dev/null; then
      echo "ok: $label $url"
      return 0
    fi
    sleep 1
  done

  echo "failed: $label did not become ready at $url" >&2
  docker compose ps >&2
  docker compose logs --no-color --tail=120 api web >&2
  return 1
}

wait_for_url "api health" "http://127.0.0.1:${CVN_API_PORT}/api/health"
wait_for_url "proxied api health" "http://127.0.0.1:${CVN_WEB_PORT}/api/health"
wait_for_url "web root" "http://127.0.0.1:${CVN_WEB_PORT}/"

restart_adapter_json="$(curl -fsS "http://127.0.0.1:${CVN_WEB_PORT}/api/settings/runtime/restart")"
if command -v python3 >/dev/null 2>&1; then
  RESTART_ADAPTER_JSON="$restart_adapter_json" python3 - <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RESTART_ADAPTER_JSON"])
expected_adapter = os.environ.get("CVN_RESTART_ADAPTER", "docker-compose").replace("_", "-")
expected_service = os.environ.get("CVN_RESTART_SERVICE_NAME", "api")
adapter = data.get("adapter")
service_name = data.get("service_name")
command = data.get("command") or ""

if adapter != expected_adapter:
    print(f"failed: restart adapter expected {expected_adapter!r}, got {adapter!r}", file=sys.stderr)
    sys.exit(1)
if expected_service and service_name != expected_service:
    print(f"failed: restart service expected {expected_service!r}, got {service_name!r}", file=sys.stderr)
    sys.exit(1)
if "restart" not in command:
    print(f"failed: restart command does not look like a restart command: {command!r}", file=sys.stderr)
    sys.exit(1)

manual = "manual" if data.get("manual_required") else "executable"
available = "available" if data.get("command_available") else "copy-only"
print(f"ok: restart adapter {adapter} service={service_name} mode={manual} command={available}")
PY
else
  if ! printf "%s" "$restart_adapter_json" | grep -q '"adapter":"docker-compose"'; then
    echo "failed: restart adapter did not report docker-compose" >&2
    echo "$restart_adapter_json" >&2
    exit 1
  fi
  echo "ok: restart adapter docker-compose"
fi

docker compose ps

cat <<EOF

Compose smoke passed.
Web: http://127.0.0.1:${CVN_WEB_PORT}/
API: http://127.0.0.1:${CVN_API_PORT}/api/health
Restart adapter: ${CVN_RESTART_ADAPTER} service=${CVN_RESTART_SERVICE_NAME}
Project: ${COMPOSE_PROJECT_NAME}
Data root: ${SMOKE_ROOT}

Stop it with:
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME} \\
CVN_WEB_PORT=${CVN_WEB_PORT} \\
CVN_API_PORT=${CVN_API_PORT} \\
CVN_METADATA_HOST_DIR=${CVN_METADATA_HOST_DIR} \\
CVN_DOWNLOAD_HOST_DIR=${CVN_DOWNLOAD_HOST_DIR} \\
CVN_RUNTIME_HOST_DIR=${CVN_RUNTIME_HOST_DIR} \\
docker compose down
EOF

if [[ "${CVN_COMPOSE_SMOKE_CLEANUP:-false}" == "true" ]]; then
  docker compose down
fi
