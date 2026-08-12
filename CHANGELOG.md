# Changelog

All notable changes to Channel Vault NAS will be tracked here.

The project is actively developed and out of alpha. Dates use Korea Standard Time.

## Unreleased

Repository-hardening and positioning polish (docs and workflow metadata only —
no image rebuild required).

### Changed

- Hardened GitHub Actions to least privilege: top-level read-only `permissions`,
  per-job `timeout-minutes`, and `persist-credentials: false` on checkouts across
  the CI, release-images, and docs Pages workflows.
- Aligned contributor and security docs with the shipped out-of-alpha
  positioning while preserving every localhost/LAN exposure guardrail.

### Added

- Benchmarks and attribution ledger in `CONTRIBUTING.md` recording the MIT
  reference studied for repository-shaping patterns (independently
  re-implemented; no code, prose, or assets copied).

## 0.3.0 - 2026-08-15

V3 makes Channel Vault the archiver that notices when the source is gone.
**Preservation Watch** turns "a video I saved disappeared from YouTube" from an
invisible non-event into a first-class, celebrated outcome: your NAS holds the
last copy. This is the differentiator clone projects tend to skip — most
subscription downloaders stop caring about a video the moment it is saved.

### Added

- **Preservation Watch** source-presence reconciliation. Every manual and
  scheduled sync now compares saved videos against the live channel listing and,
  after a confirmation window (`CVN_PRESERVATION_CONFIRM_HOURS`, default 24h),
  marks a video that has vanished upstream — removed, privated, or taken down —
  as preserved. Absence within the window is reported as *suspected* first, so a
  single sync hiccup never false-flags a video.
- Truncated-listing and empty-probe safety guards so channels larger than the
  probe window and momentary listing failures cannot trigger false removals.
- Automatic resurrection: a video that reappears at the source is quietly
  restored to `available`.
- **Preserved** surfacing across the UI — a dedicated dashboard metric tile, a
  per-channel Preserved count, and a preserved badge in the video timeline, with
  honest "last copy safe on your NAS" framing.
- Preservation manifest export at `GET /channels/{id}/removed/export`
  (CSV or NDJSON) listing every video that now exists only on your disk.
- `video.preserved` and refreshed preservation copy across all five locales
  (English, Korean, Japanese, Chinese, Hindi).

### Changed

- Bumped to **0.3.0**. Release images, Compose files, the API/UI version string,
  and docs now read `0.3.0`.
- Repositioned both READMEs and the "Is it for me?" comparison to lead with
  Preservation Watch as the standout differentiator against TubeArchivist,
  Pinchflat, TubeSync, and ytdl-sub.
- The first-run demo workspace now seeds a real preserved example instead of an
  empty Preserved count.

## 0.2.0 - 2026-07-31

V2 moves Channel Vault out of alpha with a right-sized default experience and a
clearer front door, aimed at making the archive workflow obvious to new
self-hosters.

### Changed

- Moved out of alpha to **0.2.0**. Release images, Compose files, install docs,
  the Docker Hub description, and the version reported by the API and UI now
  read `0.2.0`.
- Repositioned both READMEs to lead with an honest "Is it for you?" comparison
  against TubeArchivist, Pinchflat, and TubeSync/ytdl-sub, and to frame the
  project confidently as out of alpha rather than as a guarded prerelease.
- The default interface now leads with a light three-step Home flow: register a
  channel, choose the automatic-backup schedule, and read the current status.
  Queue, storage, runtime, and diagnostic controls remain available under
  advanced management instead of filling the first screen.
- English and Korean manuals, README screenshots, the social preview, and
  click-by-click setup copy now match the simplified Home, registration,
  schedule, Saved videos, and Settings screens.
- Metadata scheduler passes now stage only never-queued missing videos, respect
  storage pressure, and stay idempotent when the same channel is checked again.
- GitHub Pages now publishes search-focused English/Korean titles, Open Graph
  and large social-card metadata, structured software data, `robots.txt`, a
  sitemap verification gate, and an `llms.txt` product summary.
- Replaced the stale illustrated social card with a reproducible 1280x640 image
  built from the current missing-only automatic-backup screen.
- The documentation homepage now links directly to GitHub and explains where
  Channel Vault fits beside TubeArchivist and Pinchflat.
- Added an English/Korean project-facts and media page with verified directory
  copy, current assets, deployment facts, differentiators, and limitations.
- Published both GHCR packages for anonymous pulls and verified the API and web
  `linux/amd64` and `linux/arm64` manifests without registry credentials.

### Fixed

- Dates and times now follow the language selected in Channel Vault instead of
  the browser's operating-system locale.
- Storage-pressure events refresh an open Insights screen without restoring the
  high-frequency background requests removed from inactive workspaces.

## 0.1.0-alpha.3 - 2026-07-10

The first-backup release: one preview-and-register path, one automatic-backup
control, no-clone Docker installation, and visible reuse of existing NAS media
and `archive.txt` ledgers.

### Added

- Release-only `compose.release.yml`: published Docker Hub images start without
  cloning or building the repository, and only the web port is exposed.
- Migration guide for reconciling existing NAS media and `archive.txt` before
  automatic backup begins.
- Workflow comparison guide for choosing between Channel Vault NAS and other
  self-hosted archivers.
- Mobile bottom navigation for direct access to all six workspaces.
- Korean repository README, a public NAS compatibility matrix/discussion, and a
  hardware-report good-first-issue for community verification.

### Changed

- Replaced the multi-panel channel workbench with one registration path
  (**Preview → Register channel**) and one automatic-backup card.
- Channel backup now shows Total / Downloaded / Remaining once, then interval,
  per-run count, Start/Save/Pause, and advanced manual testing in that order.
- New installs claim 5 videos per scheduler pass by default instead of 1; the
  value remains configurable from 1 to 20.
- README, GitHub Pages, Docker Hub copy, public screenshots, and demo recording
  now lead with existing-archive reuse and disk-first recovery.
- Dashboard now keeps only the archive score and three-step path (source,
  automatic backup, library); repeated runtime/storage/queue cards moved out of
  the first impression.
- README demo focuses on the missing-only backup decision, channel registration,
  existing archive import, and the indexed library instead of touring every
  operator screen.

### Fixed

- Mobile layouts no longer render the full desktop sidebar above the channel
  workflow.
- Starting automatic backup is covered end-to-end: only missing candidates are
  queued, scheduler settings hot-apply, and channel registration alone never
  starts a download.

## 0.1.0-alpha.2 - 2026-07-06

Simplified-UX refresh focused on star-ready first impressions: a set-and-forget
scheduler, an archive-health dashboard, and refreshed docs, manual, and
screenshots. Republishes the Docker Hub / GHCR images.

### Added

- Set-and-forget automatic download scheduler: **Register schedule** turns on the
  auto-download policy and scheduler and queues only the remaining videos in one
  step; **Update schedule** applies interval / batch changes to a running
  schedule; **Stop schedule** halts future passes; a fully-archived channel shows
  **Fully archived** instead of an error.
- Clickable **Add another channel** / channel-registration entry points that open
  the registration composer even after a channel already exists (previously a
  dead informational card).
- Docker Hub `0.1.0-alpha.2` image refresh for
  `modenaf360/channel-vault-nas-api` and `modenaf360/channel-vault-nas-web`.
- NAS-first archive cockpit with Dashboard, Channels, Queue, Library, Insights,
  and Settings workspaces.
- Channel registration, source probing, metadata sync, scheduler ticks, and
  policy-based missing-video candidate generation.
- Download queue with guarded real worker passes, preflight detail, retries,
  cancellation, and worker audit history.
- `archive.txt` import workflow that makes already-downloaded videos explicit
  and stages only missing records/candidates.
- Library indexing for media files, sidecars, thumbnails, subtitles, saved
  views, codec/profile metadata, and storage coverage.
- Storage scanner for real archive folders, storage pressure, drift, orphan
  sidecars, extension totals, and recovery-oriented folder inspection.
- Runtime console for worker/scheduler flags, managed `.env.runtime`, restart
  adapter guidance, scheduler tick logs, and runtime audit events.
- Optional local/NAS operator token via `CVN_AUTH_TOKEN`, including frontend
  access gate and protected WebSocket events.
- Safe first-run demo workspace that seeds a deterministic `Signal Lab`
  archive story without YouTube calls or downloads.
- Server-generated redacted support bundle for public issue reporting.
- Public alpha release gate script, CI workflow, issue templates, contributor
  guide, security policy, public demo runbook, and generated README screenshots.
- In-app Public access guard in the runtime Env guide that generates a strong
  operator token locally, copies the token / `.env.runtime` line / 401/200 smoke
  test, and keeps the token in the browser only.
- Docker Hub and GitHub Container Registry image publish workflow (`Release
  images`, triggered on `v*` tags) plus pull-based Docker Compose and direct
  `docker run` install modes via the `CVN_API_IMAGE` / `CVN_WEB_IMAGE`
  overrides.
- Docker Hub `0.1.0-alpha.1` mirror publication and pull-based Compose smoke
  verification for `modenaf360/channel-vault-nas-api` and
  `modenaf360/channel-vault-nas-web`.
- NAS deployment-confidence docs and examples: Synology/QNAP install guide
  (`docs/nas-install.md`), systemd/supervisor service examples (`deploy/`), and a
  SQLite + sidecar backup/restore runbook (`docs/backup-restore.md`).
- Restart-adapter validation tests (`backend/tests/test_restart_adapter.py`)
  covering docker-compose/systemd/supervisor/Synology/QNAP/hook/disabled command
  generation and execute-gating.
- Beta readiness onboarding surfaces: clean-install gate, runtime guide section
  rail, backup confidence panel, and a redacted Dashboard proof export.
- Protected access E2E now verifies API `401`/`200` behavior plus browser unlock
  and runs in CI/public-alpha checks with a non-secret test token.
- Live deployment smoke script for already-running LAN/NAS/reverse-proxy hosts,
  including protected API checks, WebSocket upgrade, and optional forbidden raw
  API exposure checks.
- Deterministic public demo recording workflow via
  `scripts/capture-public-demo.sh` and `frontend/e2e/public-demo-recording.spec.ts`.
- Saved library views can now be exported, copied, downloaded, and imported as
  portable JSON bundles via API and Library UI controls.
- Worker history now exposes completed/skipped/failed/slow filters, duration
  threshold querying, and slow-run diagnostic callouts in the queue drawer.
- Library media details now include an in-app video preview backed by HTTP
  `Range`-capable, per-file streaming for browser seeking and multi-file
  archives.
- Library, channel coverage/detail/timeline, and dashboard archive counts now
  use actual media existence under the archive root, so stale indexed rows are
  surfaced as missing media instead of inflating local coverage.

### Changed

- Dashboard redesigned around archive health ("Today's archive status" — backed
  up vs. remaining) instead of a release-readiness score. Release-engineering
  surfaces (readiness, install proof, support bundle, briefing, storage check)
  now sit behind a single **Operator checks** advanced toggle, so a fully-mounted,
  100%-archived home NAS no longer shows a false "action needed" alarm.
- Renamed developer-flavored labels across all five locales for operator clarity
  (Volume Map → Storage, Global queue control → Download queue, guarded pass →
  download safely, Stage missing → Find new videos, Mount Doctor → Storage check).
- The Queue console now hides stale failed / cancelled jobs for videos that are
  already archived, so it shows only real, current work.
- Refreshed the README, GitHub Pages user manual (English + Korean), and every
  captured screenshot to match the simplified scheduler and dashboard UX.
- Split the frontend into release-friendly chunks for React, motion, D3, icons,
  lazy-loaded locale files, and app code.
- Reframed Docker Compose quickstart around safe LAN defaults, optional token
  protection, and reverse-proxy guidance.
- Updated public screenshots and app metadata/manifest for a stronger first
  impression on GitHub and installable browser surfaces.

### Security

- Documented public-alpha exposure boundaries and deployment security examples.
- Redacted support exports now remove tokens, paths, source URLs, channel/video
  titles, generated download commands, and readiness target paths.

### Fixed

- The operator guide "Open channel registration" and command-palette registration
  entry now open the registration composer instead of doing nothing once a channel
  is already registered.
- The optional access-gate notice now re-translates after the lazy locale chunk
  loads, so a non-English console no longer freezes on the English fallback
  string when the API returns 401 during initial load.
- The worker stop action now commits the cancelled job state before terminating
  the download subprocess, removing a race that could finalize a stopped job as
  `failed` on slower hosts.
- Clipboard copy actions no longer hang if the async clipboard API stalls: the
  write is bounded by a timeout and falls back to a synchronous copy, and the
  E2E suite grants clipboard permissions for deterministic runs.

## 0.1.0-alpha.1 - 2026-06-11

Guarded public alpha prerelease. See
[v0.1.0-alpha.1](https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.1)
and [Public Alpha Roadmap](docs/roadmap.md) for the release gate and scope.
