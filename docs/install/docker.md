# Docker install

The fastest way to run Channel Vault NAS. Two Docker paths are covered here:

1. [Start in 60 seconds](#start-in-60-seconds-published-images) — pull the
   published images (no build).
2. [Build from source](#build-from-source) — build the images from this repo.

Both store archive data in bind-mounted host folders (`./metadata`,
`./downfolder`, `./runtime`).

## Start in 60 seconds (published images)

Use the published Docker Hub images for the fastest path:

```bash
git clone https://github.com/hyeonsangjeon/channel-vault-nas.git
cd channel-vault-nas
cp .env.example .env
mkdir -p metadata downfolder runtime

export CVN_API_IMAGE=modenaf360/channel-vault-nas-api:0.1.0-alpha.1
export CVN_WEB_IMAGE=modenaf360/channel-vault-nas-web:0.1.0-alpha.1
docker compose pull
docker compose up -d --no-build
```

Then open **`http://127.0.0.1:5173/`** and jump to the
[First backup wizard](../usage/first-backup.md).

??? note "Prefer GHCR images?"
    Swap the image overrides for the GitHub Container Registry mirror:

    ```bash
    export CVN_API_IMAGE=ghcr.io/hyeonsangjeon/channel-vault-nas-api:0.1.0-alpha.1
    export CVN_WEB_IMAGE=ghcr.io/hyeonsangjeon/channel-vault-nas-web:0.1.0-alpha.1
    ```

    Always set `CVN_API_IMAGE` **and** `CVN_WEB_IMAGE` together. If only one is
    set, Compose tries to pull the other from its default local tag and the pull
    fails. GHCR packages may be private; if `docker compose pull` returns a
    permission error, run `docker login ghcr.io` with a token that can read them.

## Build from source

Best for evaluating the current `main` or a branch:

```bash
git clone https://github.com/hyeonsangjeon/channel-vault-nas.git
cd channel-vault-nas
cp .env.example .env
mkdir -p metadata downfolder runtime
docker compose up --build
```

The Compose stack runs:

- **`api`** — FastAPI backend with `yt-dlp`, `ffmpeg`, and `ffprobe`
- **`web`** — nginx-served React app
- **`./metadata`** — SQLite DB and startup backups
- **`./downfolder`** — archived media and sidecars
- **`./runtime/.env.runtime`** — Settings-tab runtime overrides

!!! tip "Verify without touching your real archive"
    Override the ports and host folders to run a throwaway check:

    ```bash
    mkdir -p /tmp/channel-vault-compose/{metadata,downfolder,runtime}
    CVN_WEB_PORT=15173 \
    CVN_API_PORT=18000 \
    CVN_METADATA_HOST_DIR=/tmp/channel-vault-compose/metadata \
    CVN_DOWNLOAD_HOST_DIR=/tmp/channel-vault-compose/downfolder \
    CVN_RUNTIME_HOST_DIR=/tmp/channel-vault-compose/runtime \
    docker compose up --build
    ```

## Direct `docker run` (registry smoke test)

Compose is recommended because it keeps ports, volumes, health checks, and
restart policy in one file. But you can also run the two containers directly on
one Docker network. The `api` network alias is required because the web image
proxies `/api` and `/ws` to `http://api:8000`.

```bash
export CVN_API_IMAGE=modenaf360/channel-vault-nas-api:0.1.0-alpha.1
export CVN_WEB_IMAGE=modenaf360/channel-vault-nas-web:0.1.0-alpha.1

mkdir -p metadata downfolder runtime
docker network create channel-vault-nas 2>/dev/null || true

docker run -d \
  --name channel-vault-nas-api \
  --network channel-vault-nas \
  --network-alias api \
  -p 8000:8000 \
  -e CVN_DATABASE_URL='sqlite+aiosqlite:///./metadata/app.db' \
  -e CVN_METADATA_DIR='./metadata' \
  -e CVN_DOWNLOAD_DIR='./downfolder' \
  -e CVN_RUNTIME_ENV_FILE='/app/runtime/.env.runtime' \
  -e CVN_DB_MIGRATE_ON_STARTUP=true \
  -v "$PWD/metadata:/app/metadata" \
  -v "$PWD/downfolder:/app/downfolder" \
  -v "$PWD/runtime:/app/runtime" \
  "$CVN_API_IMAGE"

docker run -d \
  --name channel-vault-nas-web \
  --network channel-vault-nas \
  -p 5173:80 \
  "$CVN_WEB_IMAGE"
```

Open `http://127.0.0.1:5173/`. Clean up with:

```bash
docker rm -f channel-vault-nas-web channel-vault-nas-api
docker network rm channel-vault-nas
```

## Going beyond localhost

For anything more than a local trial, edit `.env` **before** starting:

- Set `CVN_AUTH_TOKEN` to a long random value — see [Access token](access-token.md).
- Behind a reverse proxy, publish only the web port and bind the API to loopback:

    ```env
    CVN_API_PORT=127.0.0.1:8000
    CVN_WEB_PORT=5173
    ```

Then continue with the [NAS install guide](nas.md) for host-folder separation and
reverse-proxy recipes.

!!! danger "Open the web port, not the API port"
    If you see only `{"detail":"Not Found"}`, you opened the raw API port. Open
    the web port (`CVN_WEB_PORT`, default `5173`).
    See [NAS troubleshooting](nas.md#troubleshooting-detailnot-found).
