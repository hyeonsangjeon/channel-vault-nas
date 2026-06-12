# Changelog

All notable changes to Channel Vault NAS will be tracked here.

The project is in active alpha. Dates use Korea Standard Time.

## Unreleased

### Added

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
- GitHub Container Registry image publish workflow (`Release images`, triggered
  on `v*` tags) plus a pull-based Docker Compose install mode via the
  `CVN_API_IMAGE` / `CVN_WEB_IMAGE` overrides.
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
  `Range`-capable streaming for browser seeking.

### Changed

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
