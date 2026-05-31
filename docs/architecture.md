# Channel Vault NAS Architecture Draft

작성일: 2026-05-30

## Reference Source

플랫폼 기준은 `youtube-dl-nas` `origin/develop` commit `c1a71615441b`이다.

참고한 주요 파일:

- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/dependencies.py`
- `backend/app/main.py`
- `backend/app/routers/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/download_manager.py`
- `backend/app/services/ytdlp_service.py`
- `backend/app/ws/handler.py`
- `frontend/src/api/client.js`
- `frontend/src/context/AuthContext.jsx`

이 레포에서는 해당 구조를 복사해 제품명을 바꾸는 것이 아니라, 플랫폼 패턴을
채널 아카이브 도메인에 맞게 재구성한다.

## System Shape

```text
React + Vite UI
  |
  | HTTP JSON + WebSocket JSON
  v
FastAPI backend
  |
  | SQLAlchemy async
  v
SQLite metadata DB
  |
  | filesystem paths
  v
NAS media volume

FastAPI lifespan
  |-- sync scheduler
  |-- download worker
  |-- realtime broadcaster
```

## Archive Principle

Channel Vault NAS treats the filesystem as the durable archive and the database
as an index over that archive.

Implications:

- A channel/video folder must be self-describing enough to survive DB loss.
- `video.info.json` sidecars are always written next to media.
- `MediaFile.relative_path` is the storage contract; host absolute paths are
  runtime details.
- Source title changes do not rename existing media automatically. The stable
  anchor is `upload_date + video_id`.
- Source deletion/private/block events never delete local media by default.

See `docs/storage-recovery.md` for the full SQLite + sidecar recovery contract.

## Source Registration Contract

Channel registration accepts the forms users naturally copy from YouTube:

- Share/handle URL with tracking query:
  `https://youtube.com/@wingnut987s4?si=LZr7f3vNJZsuoRo1`
- Raw channel ID:
  `UCmLADXQtWVuzOnOK5TNrWaw`
- Canonical handle URL:
  `https://www.youtube.com/@wingnut987s4`

The backend normalizes these before persistence/probing:

- Handle inputs become `https://www.youtube.com/@wingnut987s4`.
- Channel ID inputs become
  `https://www.youtube.com/channel/UCmLADXQtWVuzOnOK5TNrWaw`.
- Share tracking query/fragment values are stripped and never become part of the
  source identity.
- The first yt-dlp probe stores both the user-facing handle and immutable
  YouTube channel ID when both are available.

Test fixture channel:

```text
title: wingnut987S
handle: @wingnut987s4
channel_id: UCmLADXQtWVuzOnOK5TNrWaw
source_url: https://www.youtube.com/@wingnut987s4
```

Registration flow:

```text
POST /api/channels/_probe
  -> read-only yt-dlp flat playlist probe, storage forecast, folder preview

POST /api/channels
  -> repeat probe server-side, upsert Channel + flat Video rows, return summary
```

The first implementation uses a fast synchronous HTTP response path. The
payload shape is intentionally compatible with a later WebSocket/job mode for
large channels.

## Backend Foundation

Backend stack:

- FastAPI
- Pydantic settings
- SQLAlchemy async
- SQLite via `aiosqlite`
- Alembic
- JWT via `python-jose`
- yt-dlp subprocess wrapper
- asyncio worker/scheduler

The first implementation should preserve these platform ideas from
`youtube-dl-nas` develop:

- `Settings(BaseSettings)` reads `.env` and environment variables.
- `DATABASE_URL` defaults to SQLite under `./metadata/`.
- `DOWNLOAD_DIR` defaults to `./downfolder`.
- `PROXY` is passed through to yt-dlp.
- `SECRET_KEY` can be provided by env; local dev may auto-generate.
- `AsyncSessionLocal` uses `expire_on_commit=False`.
- `get_db()` commits on successful dependency exit and rolls back on error.
- FastAPI `lifespan` owns worker and scheduler startup/shutdown.

Change for this app:

- Do not rely on `Base.metadata.create_all()` as the long-term schema strategy.
  It is acceptable for the earliest spike, but migrations should become the
  source of truth before alpha.
- Use domain-specific repositories/services rather than keeping all behavior in
  a single download manager.

## Auth

Initial auth remains NAS-simple:

- One local admin account.
- Access token + refresh token.
- Protected API dependencies via bearer token.
- Frontend stores tokens locally and retries once after refresh.

Initial environment variables:

```text
CVN_ADMIN_ID=admin
CVN_ADMIN_PASSWORD=admin
CVN_SECRET_KEY=
```

Implementation note:

- `youtube-dl-nas` uses `MY_ID` and `MY_PW`. This app should use clearer
  `CVN_*` names while optionally supporting old names during early development.
- Password hashing can be added before beta. MVP may start with env-based
  credentials to match NAS deployment simplicity.

## Domain Model

Core entities:

```text
User
Channel
Video
ChannelPolicy
SyncJob
DownloadJob
MediaFile
Subtitle
```

Suggested fields:

`Channel`

- `id`
- `source_type`: `channel` or `playlist`
- `source_url`
- `external_id`
- `handle`
- `title`
- `description`
- `thumbnail_url`
- `last_synced_at`
- `sync_interval_minutes`
- `status`
- `source_video_count`
- `source_counts_updated_at`
- `archived_count`
- `missing_count`
- `removed_saved_count`
- `first_video_published_at`
- `latest_video_published_at`
- `avg_upload_interval_days`
- `typical_upload_dow`
- `typical_upload_hour`
- `created_at`
- `updated_at`

`Video`

- `id`
- `channel_id`
- `external_id`
- `title`
- `description`
- `published_at`: preserve upload time when available, not just date
- `upload_date`: stable date key for filesystem layout
- `duration_seconds`
- `thumbnail_url`
- `view_count`
- `source_state`: `available`, `unlisted`, `private`, `removed`, `blocked`,
  or `deleted`
- `last_seen_in_source_at`
- `removed_detected_at`
- `tags`
- `categories`
- `chapters`
- `is_short`
- `is_live`
- `was_livestream`
- `info_json_path`
- `discovered_at`
- `created_at`
- `updated_at`

`ChannelPolicy`

- `id`
- `channel_id`
- `auto_download`
- `max_quality`
- `audio_only`
- `subtitles_enabled`
- `subtitle_languages`
- `retention_policy`
- `worker_paused`
- `worker_pause_reason`
- `created_at`
- `updated_at`

`SyncJob`

- `id`
- `channel_id`
- `status`
- `started_at`
- `completed_at`
- `videos_seen`
- `videos_created`
- `error_message`

`DownloadJob`

- `id`
- `video_id`
- `status`
- `progress`
- `quality`
- `priority`
- `preflight_status`
- `estimated_bytes`
- `preflight_checked_at`
- `error_message`
- `attempt_count`
- `started_at`
- `completed_at`
- `created_at`

`MediaFile`

- `id`
- `video_id`
- `relative_path`
- `filename`
- `size_bytes`
- `container`
- `video_codec`
- `audio_codec`
- `fps`
- `width`
- `height`
- `duration_seconds`
- `info_json_path`
- `nfo_path`
- `thumbnail_path`
- `checksum` (later; integrity verification)
- `created_at`

`Subtitle`

- `id`
- `video_id`
- `language`
- `format`
- `path`
- `auto_generated`
- `created_at`

## API Draft

Keep API names resource-oriented:

```text
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/dashboard

GET    /api/channels
POST   /api/channels
POST   /api/channels/_normalize
POST   /api/channels/_probe
GET    /api/channels/{channel_id}
PATCH  /api/channels/{channel_id}
DELETE /api/channels/{channel_id}
POST   /api/channels/{channel_id}/sync
GET    /api/channels/{channel_id}/videos
GET    /api/channels/{channel_id}/policy
PATCH  /api/channels/{channel_id}/policy
GET    /api/channels/{channel_id}/coverage
GET    /api/channels/{channel_id}/missing
GET    /api/channels/{channel_id}/removed
GET    /api/channels/{channel_id}/cadence
GET    /api/channels/_file-layout/default

GET    /api/imports/sources
POST   /api/imports/takeout
POST   /api/imports/folder-scan

GET    /api/videos
GET    /api/videos/{video_id}
POST   /api/videos/{video_id}/download

GET    /api/jobs/sync
GET    /api/jobs/downloads
GET    /api/jobs/downloads/preflight
GET    /api/jobs/downloads/worker/plan
GET    /api/jobs/downloads/worker/runs?channel_id=&status=&dry_run=&failed_only=&limit=
POST   /api/jobs/downloads/worker/run-once
POST   /api/jobs/downloads/bulk
POST   /api/jobs/downloads/{job_id}/retry
POST   /api/jobs/downloads/{job_id}/cancel
POST   /api/jobs/downloads/{job_id}/stop

GET    /api/events/recent

GET    /api/library
GET    /api/library?channel_id=&query=&status=&integrity=&codec=&missing_sidecar=
GET    /api/library/_rescan/plan
POST   /api/library/_rescan/apply
GET    /api/library/{video_id}
GET    /api/library/{video_id}/files
GET    /api/library/{video_id}/stream
GET    /api/library/{video_id}/file

GET    /api/settings/runtime
PATCH  /api/settings/runtime
GET    /api/settings
PATCH  /api/settings

WS     /ws/events
```

`Quick Download` can later be exposed separately:

```text
POST /api/quick-downloads
```

It should not drive the main information architecture.

## Realtime Protocol

Use JSON events only. Event shape:

```json
{
  "type": "download.progress",
  "data": {},
  "occurred_at": "2026-05-30T00:00:00Z"
}
```

Initial event types:

- `sync.started`
- `sync.progress`
- `sync.completed`
- `sync.failed`
- `policy.updated`
- `video.discovered`
- `download.candidates`
- `download.preflight`
- `download.bulk`
- `download.queued`
- `download.cancelled`
- `download.stop_requested`
- `download.progress`
- `library.rescan.applied`
- `download.metadata`
- `download.completed`
- `download.failed`
- `storage.updated`

On connect, the server should send:

- current queue state
- active sync jobs
- active download jobs
- recent failures

## Worker and Scheduler

Start simple with in-process asyncio tasks:

- `SyncScheduler`: periodically creates sync jobs for due channels.
- `SyncManager`: fetches channel/playlist metadata and upserts videos.
- `DownloadManager`: processes download jobs sequentially at first.
- `YtDlpService`: wraps yt-dlp commands and emits parsed progress.
- `DownloadWorkerRun`: persists each bounded worker pass with dry-run/live
  mode, started/completed/failed counts, duration, and skip/failure context for
  filtered operator review.
- `DownloadWorkerScheduler`: optional FastAPI-lifespan task that runs bounded
  worker passes on an interval only when both scheduler and real transfer flags
  are enabled; it reuses the same pause-aware worker claim query.
- `DownloadSchedulerTick`: append-only scheduler tick telemetry persisted in
  SQLite with status, skipped/error context, run counts, duration, and next tick
  timing for process-restart-safe operator review.
- `RuntimeSettings`: non-secret operator snapshot for worker/scheduler flags,
  scheduler cadence/limit, archive paths, and local `yt-dlp`/`ffprobe` command
  health. It also includes in-process scheduler telemetry so the UI can show
  whether the scheduler is off, worker-locked, armed, waiting, running, or
  recently failed, next/last tick timing, recent persisted tick logs, and feeds
  a frontend env manifest drawer with exact `.env` lines, managed `.env.runtime`
  apply, restart-required state, and copy feedback for arming the local NAS
  worker loop.

This mirrors the existing `DownloadManager` pattern, but splits sync and download
responsibilities so the domain stays readable.

Future expansion path:

- Multiple download workers.
- Separate process worker.
- Redis or database-backed queue.
- PostgreSQL option.

## yt-dlp Integration

Carry over these behaviors from `youtube-dl-nas`:

- `--proxy` support.
- title sanitizing via `--replace-in-metadata`.
- `.incomplete` staging directory before final move.
- mp4-oriented best video + m4a audio default.
- audio-only options.
- subtitle-only command support.
- progress parsing from stdout.

Add for Channel Vault:

- Metadata sync mode for channel/playlist listing.
- Stable mapping from yt-dlp IDs to `Channel.external_id` and
  `Video.external_id`.
- Always write `video.info.json` sidecars with `--write-info-json`.
- Thumbnail download/cache step.
- Subtitle download attached to `Subtitle`, not treated as a generic download.
- Preserve manual subtitles and auto-generated subtitles distinctly.
- Post-download filesystem scan to create `MediaFile`.
- Best-effort `ffprobe` after sidecar/media indexing to populate technical
  `MediaFile` facts: container, video/audio codec, FPS, resolution, and
  duration.

## Media Storage

Default paths:

```text
metadata/app.db
metadata/thumbnails/
metadata/subtitles/
downfolder/
downfolder/.incomplete/
```

Possible media layout:

```text
downfolder/
  channels/
    {channel_handle} [{channel_id}]/
      channel.nfo
      poster.jpg
      _channel.info.json
      2024/
        2024-01-15 - sanitized-title [{video_id}]/
          video.mp4
          video.info.json
          video.en.srt
          video.ko.srt
          thumbnail.jpg
          video.nfo
```

This per-video folder layout is the MVP default. It is intentionally deeper than
a flat folder because each video becomes a self-contained preservation unit.

Alternative flat layout can be considered later:

```text
downfolder/
  channels/
    {channel_slug}/
      {published_date}_{video_id}_{title}.mp4
```

Rules:

- Store volume-relative paths in `MediaFile.relative_path`.
- Keep `upload_date + video_id` in the folder/file anchor.
- Always store `video.info.json` next to media.
- Keep thumbnails/subtitles/NFO sidecars next to the media when available.
- Probe indexed media with `CVN_FFPROBE_BINARY` when available; probing must be
  optional and timeout-bound so a missing or slow binary never blocks archive
  recovery.
- Library file detail responses expose media existence, stream URL, compact
  size labels, integrity state, expected sidecar existence, and discovered
  subtitle sidecars while keeping paths archive-relative.
- Do not automatically rename archived media when a source title changes.
- Prevent path traversal on every file endpoint.
- Streaming endpoint should support HTTP range requests before beta.
- File deletion should separate DB record deletion from physical file deletion
  and make destructive operations explicit in the UI.

Coverage terms:

- `source`: last source-reported total.
- `archived`: source videos with local media.
- `missing`: source videos without local media.
- `removed_saved`: videos no longer available upstream but preserved locally.

## Frontend Foundation

Frontend stack:

- React
- Vite
- React Router
- axios client with token refresh
- lucide-react icons
- Framer Motion for restrained but polished motion
- Recharts for standard operational charts
- D3.js for custom visualizations such as channel constellations, storage
  treemaps, sync timelines, subtitle keyword rivers, and queue flows

Main screens:

- Dashboard
- Channels
- Channel Detail
- Library
- Queue
- Insights
- Settings

UI principle:

- Build a beautiful dense operations console, not a marketing page and not a
  single URL form. Tables, filters, segmented controls, clear status badges,
  compact progress displays, and dynamic visualizations should carry the
  experience.
- The visual bar is high from the MVP: the app should feel like an archive
  observatory, with polished dark surfaces, meaningful motion, and at least one
  dynamic data visualization.

## Docker and NAS Deployment

Initial docker-compose goals:

```text
services:
  channel-vault-nas:
    image: modenaf360/channel-vault-nas:beta
    ports:
      - "8000:8000"
    volumes:
      - ./metadata:/app/metadata
      - ./downfolder:/app/downfolder
    environment:
      - CVN_ADMIN_ID=admin
      - CVN_ADMIN_PASSWORD=admin
      - CVN_SECRET_KEY=change-me
      - CVN_DATABASE_URL=sqlite+aiosqlite:///./metadata/app.db
      - CVN_DOWNLOAD_DIR=./downfolder
      - CVN_DB_BACKUP_ON_STARTUP=true
      - CVN_DB_MIGRATE_ON_STARTUP=true
      - CVN_DOWNLOAD_WORKER_ENABLED=false
      - CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED=false
      - CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS=300
```

The existing `youtube-dl-nas` image and `latest` tag must remain untouched.

## MVP Implementation Order

1. Scaffold backend and frontend from the reference platform patterns.
2. Add initial Alembic schema for `Channel`, `Video`, `MediaFile`,
   `ChannelPolicy`, and `SyncJob`, including coverage/fidelity fields.
3. Implement auth and protected API shell.
4. Implement channel registration and yt-dlp metadata extraction.
5. Implement manual sync, video upsert, `source_state`, and coverage cache
   refresh.
6. Add filesystem layout writer using the per-video folder contract and always
   write `.info.json`.
7. Add Dashboard and Channels UI around coverage, missing, removed-saved, and
   cadence.
8. Add `DownloadJob`, queue worker, progress WebSocket events.
9. Add Library and basic file streaming.
10. Add scheduler and Settings.

## Open Decisions

- Whether local admin credentials stay env-only for `0.1.0-alpha` or move into
  the DB immediately.
- Whether sync should support only YouTube at first or keep provider fields from
  day one.
- Whether thumbnails are always downloaded or cached lazily.
- Whether subtitles are stored only next to media files or duplicated under
  `metadata/subtitles` for fast indexing.
- How much of v1 `download_history.json` import belongs before `1.0.0`.
