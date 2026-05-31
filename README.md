# Channel Vault NAS

Personal channel archive manager for NAS.

Channel Vault NAS is a NAS-first archive console for YouTube channels and
playlists. Users register sources, the app periodically syncs metadata, detects
new videos, downloads media according to per-channel policies, stores thumbnails
and subtitles, and exposes a searchable local library with streaming support.

The intended frame is creator-owned media, user-authorized channel backups,
Google Takeout imports, and existing NAS folders. Users are responsible for
ensuring they have the rights and permissions to archive any content.

## Project Status

This repository is the new product line. It is not a drop-in replacement for
`youtube-dl-nas` v1 and does not take over the existing
`modenaf360/youtube-dl-nas:latest` Docker image.

Initial work starts from product and architecture definition, then moves into a
FastAPI + React implementation.

## Reference Baseline

The new app should reuse platform patterns from
[`hyeonsangjeon/youtube-dl-nas`](https://github.com/hyeonsangjeon/youtube-dl-nas)
`origin/develop` at commit `c1a71615441b`:

- FastAPI lifespan startup/shutdown pattern
- Pydantic settings and NAS-friendly environment variables
- Async SQLAlchemy + SQLite + Alembic foundation
- Local JWT login, refresh, and protected route dependencies
- React + Vite frontend with token refresh interceptor
- asyncio worker/queue model
- JSON WebSocket event flow
- yt-dlp subprocess wrapper, proxy handling, filename sanitizing, and
  `.incomplete` download staging

The product model changes from a URL download queue to a channel archive
console. v1 behavior is useful evidence, not a product constraint.

## Core MVP

The product treats coverage and fidelity as first-class archive goals:

- Coverage: source count, archived count, missing count, and removed-but-saved
  count are headline metrics.
- Fidelity: every video should keep `video.info.json` sidecars, thumbnails, and
  subtitles beside the media whenever possible.
- Filesystem contract: the default layout is per-video folders under
  `downfolder/channels/{handle} [{channel_id}]/{year}/...`, so the NAS archive
  remains meaningful outside the app.
- Import lanes: Google Takeout, existing NAS folders, and authorized channel
  sync are treated as first-class entry points.

The first usable release targets:

- Local account login
- Channel and playlist registration
- Manual sync
- Periodic sync scheduler
- New video detection
- Per-channel download policy
- Download queue with progress
- Video metadata persistence
- Thumbnail storage or caching
- Optional subtitle download
- Library list and search
- Video file streaming
- Failed job retry
- Basic settings

Deferred until after the core loop is reliable:

- Advanced analytics dashboard
- Automatic tagging
- Full-text subtitle search
- Multi-user roles
- External notifications
- Mobile app
- Distributed workers

## Documentation

- [Product Brief / Product Spec](docs/product-brief.md)
- [Architecture Draft](docs/architecture.md)
- [Design Direction](docs/design-direction.md)
- [Archive Priorities](docs/archive-priorities.md)
- [Storage Recovery](docs/storage-recovery.md)
- [Use Boundaries](docs/use-boundaries.md)

Product specs and public architecture notes live in `docs/`. Private task
handoffs, scratch notes, and local planning files should stay in
`.codex/tasks/`, `TASKS.local.md`, or `SPEC.local.md`; those paths are ignored
by git.

## Planned Repository Shape

```text
backend/
  app/
  alembic/
  tests/
frontend/
  src/
docs/
docker-compose.yml
Dockerfile
```

## Local Development

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Useful backend media-worker settings:

```bash
CVN_YTDLP_BINARY=yt-dlp
CVN_FFPROBE_BINARY=ffprobe
CVN_MEDIA_PROBE_TIMEOUT_SECONDS=20
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The first screen is an `Archive Observatory` dashboard. The current backend
snapshot is DB-backed for registered channels, sync jobs, download queue
candidates, and a filesystem storage scanner that reads the configured NAS
archive root for real channel-folder bytes, folder tree summaries, volume
pressure, extension totals, and orphan sidecar warnings.

After a channel exists, the UI auto-opens the first registered channel and shows
Archive Launch Control: queue search, selectable candidate/queued jobs,
preflight storage estimates, yt-dlp command preview, and metadata-only bulk
actions before any real media transfer starts.

Launch Control also includes a safe worker control room. By default the media
worker is locked (`CVN_DOWNLOAD_WORKER_ENABLED=false`), but the UI and
`GET /api/jobs/downloads/worker/plan` show queued claim order, archive
destination folders, running-job telemetry, dry-run mode, and the exact yt-dlp
command that would run.
`POST /api/jobs/downloads/worker/run-once` defaults to a non-mutating dry-run;
real transfer requires both `CVN_DOWNLOAD_WORKER_ENABLED=true` and
`dry_run=false`. If a real transfer is enabled, worker progress is committed
while yt-dlp runs and `POST /api/jobs/downloads/{job_id}/stop` can terminate an
in-process job. Worker passes are also retained in SQLite through
`GET /api/jobs/downloads/worker/runs`, and the worker room shows the most recent
run ledger. The same audit endpoint supports status, dry-run/live, and failed
run filters; the frontend worker history drawer exposes those filters with run
duration, started/completed/failed counts, and skip/failure reasons.
An optional in-process scheduler can run bounded worker passes on an interval,
but only when both `CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED=true` and
`CVN_DOWNLOAD_WORKER_ENABLED=true` are set.
Each channel policy can pause worker claims independently, so a channel can stay
synced and queued while the media worker skips it until the policy console
resumes it.
The top-level runtime console is backed by `GET /api/settings/runtime` and shows
whether the real worker and scheduler are enabled, the scheduler cadence/limit,
whether the scheduler is off, worker-locked, armed, waiting, running, or
recently failed, and whether local `yt-dlp` and `ffprobe` commands resolve on
the NAS host. The same surface shows next/last scheduler tick labels for quick
operator debugging. Its Env guide drawer converts that live snapshot into the
exact `.env` lines needed to arm the worker/scheduler and override `yt-dlp` or
`ffprobe` binary paths, lets the operator save those non-secret overrides into
the managed `.env.runtime` file, and marks the backend restart requirement
until the running process matches the saved env. The runtime API also detects a
deployment-aware restart adapter: manual/local dev by default, Docker Compose
guidance when a compose file exists, systemd guidance when configured, and a
real executable supervised hook when `CVN_RESTART_HOOK_COMMAND` is provided.
The drawer links to a dedicated scheduler tick log with filters for completed,
failed, skipped, slow duration, scheduler interval, and worker limit. Each
scheduled pass records whether it completed, failed, or was skipped because the
worker remained locked.

The selected channel also exposes a Vault Library shelf backed by SQLite:
videos, indexed media files, queue state, media byte totals, and sidecar
fidelity are shown together so archived and still-missing items stay visible.
Existing NAS folders can be indexed through the import kit: `video.info.json`
sidecars are scanned and applied to SQLite as channel, video, and media-file
records without moving the original files.
Completed worker jobs use the same sidecar contract, but apply only the
finished video folder so large NAS roots are not rescanned after every
download.
During rescan or targeted post-download indexing, the backend best-effort runs
`ffprobe` to fill `MediaFile` container, codec, FPS, resolution, and duration
fields. The library shelf renders those facts as compact quality chips beside
duration, sidecar fidelity, queue status, and media size. The shelf can be
filtered by integrity, missing sidecar type, and codec/profile such as `h264`,
`1080p`, or `mp4`, with quick-view presets for common checks like missing
subtitles, media-only files, 1080p h264, and complete mp4 assets. Operators can
also save browser-local library views, for example "무자막 h264" or "failed
1080p", and reapply them later from the shelf toolbar. Selecting a library card
opens a media detail drawer with per-file stream actions, technical profile,
path integrity state, and sidecar/subtitle inventory.

Startup is NAS-safe by default: the app backs up SQLite, runs Alembic
`upgrade head`, then keeps an early `create_all` safety net for development
schemas. The default SQLite URL is anchored to the backend directory so tests
and app startup use the same local DB path. Set
`CVN_DB_MIGRATE_ON_STARTUP=false` to disable startup migrations.

Frontend text is localized from `frontend/src/locales/*.json`. Initial
languages are English, Korean, Japanese, Chinese, and Hindi.

Browser smoke coverage lives in `frontend/e2e/`. `npm run e2e:smoke` starts an
isolated FastAPI backend, Vite frontend, temporary SQLite DB, and temporary NAS
fixture, then verifies registration UI, queue preflight/bulk actions, library
shelf, saved library views, runtime restart/tick log surfaces, real storage
scan panels, worker control room, and rescan apply flows on desktop and mobile.

## Release Direction

- `0.1.0-alpha`: channel registration, manual sync, metadata persistence
- `0.2.0-alpha`: download queue, progress, basic library
- `0.3.0-beta`: auto sync, streaming, basic settings
- `1.0.0`: Docker deployment docs and stability pass
