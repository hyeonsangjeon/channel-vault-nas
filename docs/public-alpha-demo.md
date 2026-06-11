# Public Alpha Demo Runbook

This runbook is for a short public demo, contributor walkthrough, or release
candidate check. It keeps real downloads disabled unless the operator explicitly
arms them.

## Goal

Show the complete Channel Vault NAS loop:

1. Register or select a source.
2. Sync metadata.
3. Stage only missing videos.
4. Review a bounded download pass.
5. Verify queue, library, storage, and runtime audit surfaces.

## Safe Fixture Path

The browser smoke fixture is deterministic and does not call YouTube. It seeds a
temporary SQLite database and temporary archive folder with:

- One channel: `Signal Lab`
- One indexed media item with sidecars
- Two missing videos, including queued/candidate states
- Scheduler tick logs, worker history, storage drift, orphan sidecars, and
  quarantine examples

Run the full browser smoke:

```bash
cd frontend
npm run e2e:smoke -- --project=chromium
```

Refresh README screenshots from the same fixture:

```bash
cd frontend
CVN_CAPTURE_PUBLIC_SCREENSHOTS=true npx playwright test e2e/public-screenshots.spec.ts --project=chromium
```

The generated images are written to:

```text
docs/assets/screenshots/
```

## In-App Safe Demo Workspace

Fresh empty installs can load the same kind of operator story from the UI.
Dashboard offers a safe demo action that creates a `Signal Lab` channel, one
indexed media file, missing-video candidates, queue audit, scheduler ticks,
library sidecars, storage drift, and orphan sidecars.

This path is safe for screenshots and first-run evaluation:

- It does not call YouTube.
- It does not start downloads.
- It refuses to run when the workspace already has registered real channels.
- It routes the operator straight to the channel Downloads tab after seeding.
- It shows a demo banner with a clear action so sample data can be removed
  without touching real channels.

API equivalent:

```bash
curl -X POST http://127.0.0.1:8000/api/ops/demo-workspace
```

Clear the in-app demo:

```bash
curl -X DELETE http://127.0.0.1:8000/api/ops/demo-workspace
```

## Live App Demo Path

For a local public-alpha walkthrough:

1. Start the app with Docker Compose or local development commands from the README.
2. If `CVN_AUTH_TOKEN` is enabled, enter the operator token once. Do not show
   the token in recordings, livestreams, or screenshots.
3. Open Dashboard and point out readiness, mission control, and the first-run runway.
4. On an empty workspace, load the safe demo to show the full app without external calls.
5. Open Channels and show registration probing before anything is downloaded.
6. Open a channel detail and move through Overview, Downloads, Library, Logs, and Policy.
7. In Downloads, show the archive.txt-style split between already archived and missing videos.
8. Run preflight and copy or inspect the exact `yt-dlp` command preview.
9. Keep live downloads disabled unless this is a controlled operator demo.
10. Open Queue and show claimable, blocked, failed, retry, and job detail states.
11. Open Library and show saved views, sidecar fidelity, codec/profile metadata, and media detail.
12. Open Insights and show real storage scan, drift, pressure trend, orphan sidecars, and quarantine.
13. Open Settings and show runtime flags, scheduler tick drawers, restart adapters, and support exports.

## Real Download Guardrail

Real downloads require:

```env
CVN_DOWNLOAD_WORKER_ENABLED=true
```

Even when enabled, the UI keeps real worker passes behind a confirmation modal
and limits one pass to at most five jobs. Candidate creation is allowed while
workers are paused, but queue claim is blocked.

## What To Avoid In Public Demos

- Do not use channels you do not have rights or permission to archive.
- Do not expose this alpha directly to the public internet.
- Do not present the app as an unrestricted downloader.
- Do not enable restart adapter execution until the restart command is validated
  on the host.

## Release Candidate Checks

Before tagging a public alpha, run the unified release gate:

```bash
scripts/public-alpha-check.sh
```

The equivalent manual checks are:

```bash
cd backend
source .venv/bin/activate
ruff check app tests scripts
pytest -q
```

```bash
cd frontend
npm run build
npm run e2e:smoke -- --project=chromium
CVN_CAPTURE_PUBLIC_SCREENSHOTS=true npx playwright test e2e/public-screenshots.spec.ts --project=chromium
```

For Docker Compose:

```bash
CVN_COMPOSE_SMOKE_CLEANUP=true scripts/compose-smoke.sh
```
