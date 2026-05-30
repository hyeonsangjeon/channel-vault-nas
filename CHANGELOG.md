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
- Added GitHub Copilot custom agent profiles under `.github/agents/`.
- Added shared agent operating mode with `Core`, `Explore`, and `Vision` lanes.
- Added ignore rules for runtime data and private local planning artifacts.

### Notes

- `youtube-dl-nas` v1 remains separate and keeps its existing Docker image
  strategy.
- Channel Vault NAS is positioned as a channel archive console, not a direct
  URL download queue replacement.
