# Public Alpha Roadmap

This roadmap is intentionally practical. Channel Vault NAS should feel useful
on day one, but the public alpha must stay honest about safety boundaries and
unfinished deployment work.

## North Star

Channel Vault NAS is a private NAS archive console for creator-owned media,
user-authorized backups, Google Takeout imports, and existing archive folders.
The app should answer:

- What changed at the source?
- What is already archived?
- What is safe to download next?
- What can be recovered from the filesystem if the database disappears?

## Public Alpha Gate

The public alpha is ready when these are true:

- Docker Compose starts cleanly from a fresh clone on macOS and Linux.
- `scripts/public-alpha-check.sh` passes.
- README screenshots are generated from the Playwright fixture and match the
  current UI.
- The safe first-run demo can be loaded and cleared from an empty workspace.
- Real downloads remain disabled by default and guarded by confirmation when
  enabled.
- `CVN_AUTH_TOKEN` is documented and works for LAN/NAS demos.
- The support bundle is server-generated and redacted.
- Public issue templates, contributing guide, security policy, and demo
  runbook are present.

## 0.1.0-alpha

Focus: prove the core archive loop.

- Channel/source registration and probing.
- Metadata sync and scheduler audit.
- Missing-video candidate generation.
- Guarded queue and bounded download worker passes.
- `archive.txt` import and skip visibility.
- Library/media-file indexing after downloads.
- Storage scanner for drift, pressure, and orphan sidecars.
- Runtime settings, restart guidance, and support export.
- Safe demo workspace and public screenshot fixture.

Exit criteria:

- Public alpha gate passes.
- Docker Compose smoke is validated on at least one clean host.
- Known limitations are explicit in README and SECURITY.

## 0.2.0-alpha

Focus: make daily operation smoother.

- Saved library views become shareable/exportable.
- Queue drawer gets richer failed/skipped/completed filters and slow-run
  diagnostics.
- Storage scanner adds safer guided repair flows for orphan sidecars and
  indexed-missing media.
- Channel detail gains stronger coverage timeline, upload cadence, and next
  sync forecasting.
- Deterministic demo recording workflow exists; final published video/GIF asset
  is still a release chore.

## 0.3.0-beta

Focus: NAS deployment confidence.

- [x] Versioned container images — GHCR `Release images` workflow publishes
  multi-arch `api`/`web` on `v*` tags (`0.1.0-alpha.1` published).
- [x] Synology/QNAP-oriented install notes — [`docs/nas-install.md`](nas-install.md).
- [x] Systemd/supervisor package examples — [`deploy/`](../deploy/README.md).
- [x] More restart adapter validation — `backend/tests/test_restart_adapter.py`
  covers command generation + execute-gating for every adapter.
- [x] Backup/restore docs for SQLite plus filesystem sidecars —
  [`docs/backup-restore.md`](backup-restore.md).
- [x] Beta onboarding surfaces — clean-install gate, runtime guide section rail,
  backup confidence panel, and redacted Dashboard proof export.
- [x] Token-protected E2E coverage — `auth-gate.spec.ts` checks API `401`/`200`
  behavior and browser unlock, and runs in CI/public-alpha checks with a test
  token.
- [x] Live deployment/reverse-proxy smoke script —
  [`scripts/deployment-smoke.sh`](../scripts/deployment-smoke.sh) checks the
  exposed web endpoint, proxied API, protected access, WebSocket upgrade, and
  optional forbidden raw API URLs.

## Later

- Google Takeout importer.
- Full text subtitle search.
- Optional source API integrations.
- Streaming preview surfaces.
- Advanced visual insights: storage treemap, sync timeline, policy simulator,
  and channel health matrix.
- Multi-user/session auth hardening if the deployment model needs it.

## Non-Goals

- Public internet downloader service.
- Automatic deletion of local media because a source disappeared.
- Circumventing platform restrictions or archiving content without rights or
  permission.
