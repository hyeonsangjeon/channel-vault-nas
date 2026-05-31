# Changelog

All notable public-facing changes to Channel Vault NAS will be documented here.

This file is for shareable product and engineering history. Local task notes,
scratch specs, session exports, and private working logs stay out of git.

Principle: product specs are shared; working traces are private.

## Unreleased

### Added

- Added initial project README with product positioning, MVP scope, release
  direction, and `youtube-dl-nas` reference baseline.
- Added `docs/product-brief.md` for the Channel Vault NAS product concept.
- Added `docs/architecture.md` with the initial FastAPI, React, SQLite,
  Alembic, JWT, worker, WebSocket, yt-dlp, media storage, and Docker direction.
- Added `docs/design-direction.md` to define the high-polish archive
  observatory UI direction, including D3/Recharts/Framer Motion visualization
  ideas.
- Added initial FastAPI backend scaffold with health and mock dashboard
  endpoints.
- Added initial React/Vite frontend scaffold with a dark Archive Observatory
  dashboard, mock metrics, queue flow, storage map, and D3 channel
  constellation.
- Added lightweight frontend i18n with separate locale JSON files for English,
  Korean, Japanese, Chinese, and Hindi.
- Added channel source normalization for YouTube handle URLs, share URLs with
  tracking query parameters, and raw `UC...` channel IDs.
- Added end-to-end channel registration API with read-only yt-dlp probe,
  storage forecast, folder preview, DB persistence, and duplicate detection.
- Added the first registration command-bar UI with preview and commit actions.
- Added `wingnut987S` as the first concrete test channel fixture.
- Added a SQLite + sidecar storage recovery contract and a read-only library
  rescan plan endpoint.
- Added manual channel sync jobs, channel detail/video timeline APIs, and a
  download queue skeleton that creates candidate rows before media download.
- Added explicit post-registration archive actions in the frontend:
  sync now, build download candidates, and queue one video.
- Added a safe Alembic archive metadata baseline covering channels, videos,
  policies, sync jobs, download jobs, and media files.
- Added live archive events over `/ws/events`, recent event replay, queue
  retry/cancel actions, editable channel policy endpoints, and a DB-backed
  dashboard snapshot.
- Added queue preflight planning, job priority metadata, estimated bytes,
  bulk queue operations, and an Archive Launch Control UI with search,
  selection, preflight command preview, and responsive desktop/mobile layouts.
- Replaced selected-channel backup summary and folder preview fallbacks with
  DB-backed channel/video counts and persisted `info_json_path` layout data.
- Updated dashboard channel storage estimates to prefer indexed media bytes and
  queued-job estimated bytes before using a rough fallback.
- Added a DB-backed `/api/library` index that combines videos, media files,
  queue status, media byte totals, and sidecar fidelity, plus a searchable
  Vault Library shelf in the frontend.
- Added library item, file detail, and path-guarded stream skeleton endpoints
  for indexed `MediaFile` rows.
- Added a NAS rescan apply endpoint and import-kit UI action that index
  sidecar-backed folders into `Channel`, `Video`, and `MediaFile` rows without
  moving files.
- Added Playwright browser smoke tests with an isolated SQLite/NAS fixture for
  registration UI, queue preflight, bulk queue actions, library shelf, and NAS
  rescan apply flows across desktop and mobile projects.
- Added safe download worker planning and dry-run endpoints, plus a Launch
  Control worker control room that shows queued job claim order, archive
  destination, dry-run mode, and the exact yt-dlp command before real transfers
  are enabled.
- Added a yt-dlp progress line parser and frontend `download.progress` event
  labels/progress bars to prepare for the actual media worker.
- Added a fake-yt-dlp worker execution test covering the enabled
  `run-once` path, progress parsing, completed job state, and MediaFile
  indexing without external network access.
- Added targeted post-download indexing so a completed worker job refreshes
  only its own sidecar/media folder instead of rescanning the full NAS root.
- Added best-effort ffprobe media probing during NAS rescan and targeted
  worker indexing, exposing container, video/audio codec, FPS, resolution, and
  duration through the library APIs and frontend quality chips.
- Added a Vault Library media detail drawer with per-file stream actions,
  technical profile chips, sidecar inventory, subtitle discovery, and path
  integrity state.
- Added richer Vault Library filtering by item integrity, codec/profile, and
  missing sidecars, with card-level subtitle sidecar discovery from the NAS
  folder.
- Added Vault Library quick-view presets for common operator checks such as
  missing subtitles, media-only files, 1080p h264, and complete mp4 assets.
- Added worker progress commits, in-process stop control, running-job telemetry
  in the worker plan, and frontend stop buttons/progress cards for live jobs.
- Added persistent `download_worker_runs` audit rows, a worker run history API,
  and a compact recent-run ledger in the Launch Control worker room.
- Added worker run history filters, run duration fields, and a dedicated
  frontend history drawer for inspecting dry-run/live passes and failure
  context.
- Added per-channel worker pause/resume policy controls with
  `worker_paused`/`worker_pause_reason`, plus worker planning logic that keeps
  paused channels out of the claimable queue.
- Added an opt-in in-process download worker scheduler that runs bounded worker
  passes on an interval only when both scheduler and real worker transfer are
  explicitly enabled, reusing the same pause-aware claim path.
- Added a runtime settings snapshot API and top-level operator console for
  worker enablement, scheduler cadence/limit, and local `yt-dlp`/`ffprobe`
  binary health.
- Added in-process scheduler telemetry so the operator console can distinguish
  off, worker-locked, armed, waiting, running, and recently failed scheduler
  states.
- Added a runtime env guide drawer that turns the live settings snapshot into
  exact `.env` lines for arming the worker, scheduler, cadence/limit, and media
  binary overrides, with one-click manifest copy feedback for operators.
- Added next/last scheduler tick labels to the runtime console and env guide so
  operators can see when the bounded worker loop is due and what the previous
  pass reported.
- Added a managed runtime apply flow that writes non-secret worker, scheduler,
  cadence/limit, and media binary overrides to `.env.runtime`, surfaces
  restart-required state, and provides a restart command copy action.
- Added deployment-aware runtime restart adapters, including manual/local dev
  guidance, Docker Compose command generation, systemd guidance, and an
  executable supervised hook path through `CVN_RESTART_HOOK_COMMAND`.
- Added persistent `download_scheduler_ticks` rows plus recent tick log UI so
  scheduler pass status, skipped/failed reasons, and started/completed/failed
  counts survive backend process restarts.
- Added a dedicated scheduler tick log drawer with completed/failed/skipped,
  slow-duration, interval, and worker-limit filters.
- Added a filesystem-backed `/api/storage/scan` endpoint and storage panels for
  real archive bytes, volume pressure, folder tree summaries, extension totals,
  channel-folder usage, and orphan sidecar warnings.
- Added browser-local saved Vault Library views so operators can store and
  reapply custom filter combinations beyond the built-in quick presets.
- Added planned archive-folder paths to queue rows so Launch Control can show
  where each pending video will land before transfer starts.
- Added a second Alembic migration for queue preflight columns and hardened
  startup migrations for async FastAPI/test execution and backend-anchored
  SQLite paths.
- Added GitHub Copilot custom agent profiles under `.github/agents/`.
- Added shared agent operating mode with `Core`, `Explore`, and `Vision` lanes.
- Added ignore rules for runtime data and private local planning artifacts,
  including `.codex/tasks/`, `TASKS.local.md`, and `SPEC.local.md`.

### Notes

- `youtube-dl-nas` v1 remains separate and keeps its existing Docker image
  strategy.
- Channel Vault NAS is positioned as a channel archive console, not a direct
  URL download queue replacement.
