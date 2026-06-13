# Channel Vault NAS Product Brief

Date: 2026-05-30

## One-Line Definition

Channel Vault NAS is a channel archive manager for a private NAS. When an
operator registers a YouTube channel or playlist, the app detects new videos on
a schedule, applies channel policy, downloads only approved missing media, keeps
metadata/subtitles/thumbnails, and makes the local archive searchable and
streamable from the UI.

## Why This Is A New Project

`youtube-dl-nas` v1 is a NAS queue app centered on submitting URLs for immediate
downloads. Channel Vault NAS is a separate product: it manages channel-level
collection, preservation, search, analysis, and recovery.

The v1 repository and existing Docker users should remain protected. This
repository moves forward with a new product contract and information
architecture.

## Repository Strategy

- `youtube-dl-nas`: v1 LTS for existing Docker users.
- `channel-vault-nas`: new product focused on channel archive, sync, analysis,
  library, and streaming.

Image direction:

- v1: `modenaf360/youtube-dl-nas:latest`
- New app: `modenaf360/channel-vault-nas-api` and
  `modenaf360/channel-vault-nas-web`

## Product Positioning

Channel Vault NAS is not just a downloader. It is a private channel archive for
creator-owned media, user-authorized channel backups, `archive.txt` ledgers,
Google Takeout style imports, and existing NAS folder scans.

Core operator questions:

- Did any registered channel publish new videos?
- Which videos are archived, missing, failed, or waiting?
- How much storage does each channel consume?
- What upload rhythm, duration pattern, subtitle coverage, and metadata fidelity
  does the source have?
- Can archived media be found and streamed from the NAS without trusting only
  database rows?

## Core User Flow

1. Register a channel or playlist URL.
2. Collect channel metadata and the video list.
3. Run manual or scheduled sync to detect new videos.
4. Apply channel policy for quality, subtitles, audio mode, and auto-download.
5. Stage only missing videos as candidates.
6. Run bounded, visible worker passes for real downloads.
7. Index completed media files and sidecars into the library.
8. Search, filter, preview, and recover trust from the NAS filesystem.

Secondary entry points:

- Import an `archive.txt` ledger so already downloaded videos stay skipped.
- Scan existing NAS or external-drive folders into `Video`, `MediaFile`, and
  sidecar indexes.
- Use authorized channel sync to maintain source coverage and fidelity.

## MVP Scope

Required for the first release:

- Channel/playlist registration
- Manual metadata sync
- Scheduled metadata sync
- New-video detection
- Per-channel download policy
- Candidate generation for missing videos
- Download queue and visible progress
- Metadata, thumbnail, and subtitle sidecars
- Library list and media streaming
- Failed job retry
- Runtime/settings console
- Storage scan, drift, orphan sidecar, and backup guidance

Deferred:

- Advanced analytics dashboards
- Automatic tag classification
- Full subtitle text search
- Multi-user roles
- External notifications
- Mobile native app
- Distributed download workers

## Information Architecture

The first screen should be an operating cockpit, not a download form.

- `Dashboard`: readiness, missions, worker/scheduler state, storage pressure,
  library coverage, and the next useful action.
- `Channels`: registration, channel detail, sync, downloads, library, logs, and
  policy.
- `Queue`: candidate, queued, running, completed, failed, and cancelled jobs.
- `Library`: archived/missing media, saved views, sidecars, codec/profile
  filters, and in-app preview.
- `Insights`: storage scan, pressure trend, folder structure, drift, orphan
  sidecars, and quarantine.
- `Settings`: runtime flags, auth token, schedulers, restart adapter, volumes,
  backup/restore, and exposure guidance.

## UI/UX Direction

The app should feel like an archive observatory and NAS operations console:
beautiful, dense, calm, and built for repeated action.

Principles:

- Show channel, sync, queue, storage, and runtime state before deep controls.
- Prefer scannable operating surfaces over decorative card sprawl.
- Make skipped/already-archived media explicit.
- Keep real downloads guarded, capped, and auditable.
- Make filesystem trust visible: media files, sidecars, missing paths, and
  recovery actions should be inspectable.
- Use charts and motion only when they clarify operations.

## Platform Inheritance

The app does not migrate v1 directly, but it can inherit useful platform work:

- FastAPI service structure
- SQLite-first database with migration path
- SQLAlchemy session patterns
- React/Vite frontend
- WebSocket event stream
- yt-dlp subprocess wrapper and progress parsing
- Docker/NAS deployment knowledge

New domain model:

- `Channel`
- `Video`
- `SyncJob`
- `DownloadJob`
- `MediaFile`
- `Subtitle`
- `ChannelPolicy`
- `ArchiveEvent`

## Release Strategy

- `0.1.0-alpha`: channel registration, manual sync, metadata persistence
- `0.2.0-alpha`: download queue, progress, basic library
- `0.3.0-beta`: scheduled sync, streaming, settings
- `1.0.0`: hardened Docker deployment, complete docs, stability validation
