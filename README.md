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

- [Product Brief](docs/product-brief.md)
- [Architecture Draft](docs/architecture.md)
- [Design Direction](docs/design-direction.md)
- [Archive Priorities](docs/archive-priorities.md)
- [Use Boundaries](docs/use-boundaries.md)

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

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The first screen is an `Archive Observatory` dashboard with mock data and a D3
channel constellation. Real channel sync will replace the mock snapshot in the
next backend slices.

Frontend text is localized from `frontend/src/locales/*.json`. Initial
languages are English, Korean, Japanese, Chinese, and Hindi.

## Release Direction

- `0.1.0-alpha`: channel registration, manual sync, metadata persistence
- `0.2.0-alpha`: download queue, progress, basic library
- `0.3.0-beta`: auto sync, streaming, basic settings
- `1.0.0`: Docker deployment docs and stability pass
