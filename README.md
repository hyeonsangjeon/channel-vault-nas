# Channel Vault NAS

NAS-first YouTube channel archive console.

Channel Vault NAS turns a simple `archive.txt` idea into an operator console for
private media archives: register a channel, sync metadata, skip videos already
stored on disk, queue only missing videos, run bounded download passes, and keep
the local library searchable from the app.

The target use case is creator-owned media, user-authorized channel backups,
`archive.txt` ledgers, and existing NAS folders. You are responsible for
ensuring you have the rights and permissions to archive any content.

## Why It Exists

Most download tools answer one question: "Can this URL be downloaded?"

Channel Vault NAS answers the NAS operator question:

> "What changed, what is already archived, what is safe to download next, and
> can I recover the archive if the app database disappears?"

The filesystem remains the durable archive. SQLite is the index over that
archive.

## Current Status

This is an active alpha. The core loop is working locally:

- Channel registration and source probing
- Metadata sync and automatic metadata scheduler
- Per-channel policies, including `auto_download`
- Candidate generation for missing videos
- Download queue with preflight, retry, cancel, and bounded worker passes
- Real `yt-dlp` downloads when explicitly enabled
- Worker run audit, scheduler tick logs, and event drawers
- Runtime settings with `.env.runtime` apply/restart guidance
- Storage scanner for real NAS folders, drift, pressure, and orphan sidecars
- Library index with media files, sidecar fidelity, codec/profile filters, and saved views
- React/Vite UI split into Dashboard, Channels, Library, Queue, Insights, and Settings

Not ready yet:

- Auth hardening for exposed networks
- Polished screenshot/demo assets
- Published container images
- Production install guide for Synology/QNAP/systemd packages

Do not expose this alpha directly to the public internet.

## Product Tour

### Dashboard

The dashboard is an operating cockpit. It shows the current archive score, the
next useful action, worker/scheduler/storage/library state, recent events, and
operator missions. It intentionally avoids deep controls.

### Channels

The channel workbench is the start point:

1. Register or probe a source.
2. Sync metadata.
3. Review missing videos.
4. Queue/download only what is not archived.
5. Use the `archive.txt` import path when you already have a ledger.

### Queue

The queue console shows all candidate, queued, running, completed, failed, and
cancelled jobs. Real downloads are guarded by a confirmation flow and a maximum
of 5 jobs per worker pass.

### Library

The library shows archived and missing videos together. It indexes sidecars,
media files, codec/profile metadata, thumbnails, subtitles, queue state, and
path integrity. Saved views make repeated NAS checks fast.

### Insights

Insights reads the actual archive root and reports storage pressure, folder
structure, extension totals, unindexed media, indexed-but-missing files, and
orphan sidecars.

### Settings

Settings is the runtime console: worker flags, scheduler flags, binary paths,
restart adapters, tick logs, worker summaries, and runtime audit events.

## Quickstart: Docker Compose Alpha

This is the easiest public-preview path. It builds local images from this repo
and stores archive data in bind-mounted folders.

```bash
git clone https://github.com/hyeonsangjeon/channel-vault-nas.git
cd channel-vault-nas
cp .env.example .env
mkdir -p metadata downfolder runtime
docker compose up --build
```

Open:

```text
http://127.0.0.1:5173/
```

The compose stack runs:

- `api`: FastAPI backend with `yt-dlp`, `ffmpeg`, and `ffprobe`
- `web`: nginx-served React app
- `./metadata`: SQLite DB and startup backups
- `./downfolder`: archived media and sidecars
- `./runtime/.env.runtime`: Settings tab runtime overrides

To verify Compose without touching your working archive folders, override the
ports and host folders:

```bash
mkdir -p /tmp/channel-vault-compose/{metadata,downfolder,runtime}
CVN_WEB_PORT=15173 \
CVN_API_PORT=18000 \
CVN_METADATA_HOST_DIR=/tmp/channel-vault-compose/metadata \
CVN_DOWNLOAD_HOST_DIR=/tmp/channel-vault-compose/downfolder \
CVN_RUNTIME_HOST_DIR=/tmp/channel-vault-compose/runtime \
docker compose up -d --build
```

Then open `http://127.0.0.1:15173/` or call
`http://127.0.0.1:18000/api/health`.

The same safe verification path is available as a smoke script. It uses a
separate Compose project name by default, starts the stack, waits for API,
proxied API, and web health, checks the Runtime restart adapter, then prints the
cleanup command:

```bash
scripts/compose-smoke.sh
```

Useful overrides:

```bash
CVN_COMPOSE_SMOKE_BUILD=false scripts/compose-smoke.sh
CVN_COMPOSE_SMOKE_CLEANUP=true scripts/compose-smoke.sh
CVN_WEB_PORT=15174 CVN_API_PORT=18001 scripts/compose-smoke.sh
```

Real downloads remain disabled until you edit `.env`:

```env
CVN_DOWNLOAD_WORKER_ENABLED=true
```

Then restart:

```bash
docker compose up -d --build
```

The Compose profile also sets `CVN_RESTART_ADAPTER=docker-compose` and
`CVN_RESTART_SERVICE_NAME=api` so the Settings tab can show the correct restart
command. It remains copy-only by default because the backend container does not
mount the host Docker socket or ship with a Docker CLI.

## Quickstart: Local Development

Prerequisites:

- Python 3.11+
- Node.js 20+
- `yt-dlp`
- `ffmpeg` / `ffprobe`

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
CVN_DB_MIGRATE_ON_STARTUP=true uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

## Enable Real Downloads

The app is safe by default. It can plan and queue jobs without starting media
transfer. Real downloads require the worker flag.

For local development:

```bash
CVN_DOWNLOAD_WORKER_ENABLED=true
CVN_YTDLP_BINARY=yt-dlp
CVN_FFPROBE_BINARY=ffprobe
```

Restart the backend after changing runtime env. The Settings tab can persist
non-secret runtime overrides into `.env.runtime` and shows whether a restart is
still required.

Worker passes are intentionally bounded:

- UI run buttons default to a confirmation modal.
- API `run-once` limits are capped.
- Per-channel policy can pause worker claims.
- Candidate creation can continue even when workers are paused.

## First Demo Flow

1. Open Dashboard.
2. Go to Channels.
3. Paste a channel URL or handle.
4. Probe and register.
5. Click Sync to detect source videos.
6. Review the channel detail tabs.
7. Open Downloads.
8. Queue missing videos.
9. Run a live worker pass only if `CVN_DOWNLOAD_WORKER_ENABLED=true`.
10. Open Library and confirm media/index coverage changed.
11. Open Queue to review progress and worker audit.
12. Open Insights to inspect storage pressure and sidecar drift.

The `archive.txt` path supports the classic workflow:

```bash
youtube-dl --download-archive archive.txt "https://www.youtube.com/playlist?list=..."
```

In Channel Vault NAS, that ledger becomes an app workflow:

- Paste or drop `archive.txt`.
- Preview already archived, known missing, unknown, duplicate, and invalid rows.
- Stage only videos that still need records/candidates.
- Sync metadata for placeholder rows.
- Queue/download only fresh candidates.

## Filesystem Contract

The default archive layout is per-video folders under the configured download
root:

```text
downfolder/
  channels/
    @handle [UC...channel_id]/
      2026/
        2026-06-03 - Video title [video_id]/
          video.mp4
          video.info.json
          *.jpg / *.webp
          *.vtt / *.srt
```

Design principles:

- `video.info.json` sidecars live beside media.
- The database indexes the filesystem, not the other way around.
- Source title changes do not rename existing folders automatically.
- Source deletion/private/block events never delete local media by default.
- Existing NAS folders can be rescanned and indexed without moving files.

## Runtime Flags

Common local flags:

```bash
CVN_DOWNLOAD_DIR=./downfolder
CVN_DATABASE_URL=sqlite+aiosqlite:///./metadata/app.db
CVN_DB_MIGRATE_ON_STARTUP=true
CVN_DOWNLOAD_WORKER_ENABLED=false
CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED=false
CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS=300
CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT=1
CVN_METADATA_SYNC_SCHEDULER_ENABLED=false
CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS=900
CVN_METADATA_SYNC_SCHEDULER_LIMIT=2
CVN_YTDLP_BINARY=yt-dlp
CVN_FFPROBE_BINARY=ffprobe
```

Restart adapter flags are documented in the Settings tab. Supported adapter
families in the backend are manual/local dev, Docker Compose guidance, systemd,
supervisor, Synology package, QNAP package, and an explicit supervised restart
hook.

## Tests

Backend:

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend build:

```bash
cd frontend
npm run build
```

Browser smoke:

```bash
cd frontend
npm run e2e:smoke
```

The smoke suite starts an isolated FastAPI backend, Vite frontend, temporary
SQLite DB, and temporary NAS fixture, then verifies registration, queue actions,
library views, runtime/tick surfaces, storage scan panels, worker controls, and
rescan flows on desktop and mobile.

## Documentation

- [Product Brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Design Direction](docs/design-direction.md)
- [Archive Priorities](docs/archive-priorities.md)
- [Storage Recovery](docs/storage-recovery.md)
- [Use Boundaries](docs/use-boundaries.md)

## Public Release Checklist

The goal is a public repo that can earn real adoption, not just a working local
prototype.

Before a public alpha release:

- Validate Docker Compose on macOS, Linux, and one NAS-like host.
- Publish versioned container images.
- Add screenshot assets for Dashboard, Channels, Queue, Library, Insights, and Settings.
- Add a 5-minute demo script with a small safe fixture channel.
- Harden first-run empty states and runtime error copy.
- Run full backend, frontend build, and browser smoke tests.
- Tag `v0.1.0-alpha`.

## Relationship To youtube-dl-nas

This repository is a new product line. It is not a drop-in replacement for
`youtube-dl-nas` v1 and does not take over the existing
`modenaf360/youtube-dl-nas:latest` Docker image.

The new app reuses proven platform patterns from
[`hyeonsangjeon/youtube-dl-nas`](https://github.com/hyeonsangjeon/youtube-dl-nas)
but changes the product model from a URL download queue to a channel archive
console.
