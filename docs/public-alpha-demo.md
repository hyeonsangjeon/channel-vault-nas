# Public Demo Runbook

This runbook is for a short public demo, contributor walkthrough, or release
candidate check. It keeps real downloads disabled unless the operator explicitly
arms them.

## Goal

Show the complete Channel Vault NAS loop:

1. Start from a safe clean-install story.
2. Register or select a source.
3. Sync metadata.
4. Stage only missing videos.
5. Review a bounded download pass.
6. Verify queue, library, storage, runtime, backup, and redacted proof surfaces.

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

Refresh the English HTML manual screenshots from the same fixture:

```bash
scripts/capture-user-manual-screenshots.sh
```

The generated images are written to:

```text
docs/assets/user-manual/en/
```

Record the public demo WebM from the same fixture:

```bash
scripts/capture-public-demo.sh
```

The generated file is written to:

```text
docs/assets/demo/channel-vault-public-alpha.webm
```

## In-App Safe Demo Workspace

Fresh empty installs now lead with the first channel backup wizard: paste a
channel URL, `@handle`, or `UC...` channel ID, analyze the source, review the
backup plan, and stop at the real-download confirmation modal. Public demos can
still load the same kind of operator story from the secondary safe demo panel.
That action creates a `Signal Lab` channel, one indexed media file,
missing-video candidates, queue audit, scheduler ticks, library sidecars,
storage drift, and orphan sidecars.

This path is safe for screenshots and first-run evaluation:

- It does not call YouTube.
- It does not start downloads.
- It refuses to run when the workspace already has registered real channels.
- The clean-install gate explains the safety boundary before sample data is seeded.
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

For a local public walkthrough:

1. Start the app with Docker Compose or local development commands from the README.
2. If `CVN_AUTH_TOKEN` is enabled, enter the operator token once. Do not show
   the token in recordings, livestreams, or screenshots.
3. Open Dashboard and point out readiness, operations, the clean-install
   gate, and the onboarding proof export.
4. On an empty workspace, paste a channel URL, `@handle`, or `UC...` channel ID
   into the first backup wizard and analyze it before anything is registered.
5. Review the channel name, video count, estimated size, save folder, preview
   videos, and safety notes.
6. Click **Start first backup** to register, sync, create candidates, inspect the
   worker plan, and stop at the confirmation modal.
7. For a no-network public walkthrough, expand the secondary safe demo panel and
   load `Signal Lab` without external calls.
8. Open a channel detail and move through Overview, Downloads, Library, Logs, and Policy.
9. In Downloads, show the archive.txt-style split between already archived and missing videos.
10. Run preflight and copy or inspect the exact `yt-dlp` command preview.
11. Keep live downloads disabled unless this is a controlled operator demo.
12. Open Queue and show claimable, blocked, failed, retry, and job detail states.
13. Open Library and show saved views, sidecar fidelity, codec/profile metadata, and media detail.
14. Open Insights and show real storage scan, drift, pressure trend, orphan sidecars, and quarantine.
15. Open Settings and show runtime flags, scheduler tick drawers, restart
    adapters, backup confidence, and support exports.
16. Return to Dashboard and copy/download the onboarding proof. Confirm it
    is a redacted readiness snapshot, not an archive export or a secret dump.

## Real Download Guardrail

Real downloads require:

```env
CVN_DOWNLOAD_WORKER_ENABLED=true
```

Even when enabled, the UI keeps real worker passes behind a confirmation modal
and limits one pass to at most five jobs. Candidate creation is allowed while
workers are paused, but queue claim is blocked.

## Redacted Proof And Support Export

Use two exports in public demos:

- **Support bundle**: server-generated diagnostics for bug reports. It redacts
  tokens, absolute paths, source URLs, channel/video titles, and generated
  download commands.
- **Onboarding proof**: Dashboard-generated readiness evidence for
  walkthroughs and release reviews. It summarizes clean-install, runtime,
  backup, storage, queue, library, and audit posture without including secrets
  or operator content.

## What To Avoid In Public Demos

- Do not use channels you do not have rights or permission to archive.
- Do not expose local test builds directly to the public internet.
- Do not present the app as an unrestricted downloader.
- Do not enable restart adapter execution until the restart command is validated
  on the host.

## Release Candidate Checks

Before tagging a public release candidate, run the unified release gate:

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
CVN_E2E_AUTH_TOKEN=cvn-local-test-token npm run e2e:auth -- --project=chromium
CVN_CAPTURE_PUBLIC_SCREENSHOTS=true npx playwright test e2e/public-screenshots.spec.ts --project=chromium
```

```bash
scripts/capture-user-manual-screenshots.sh
```

```bash
scripts/capture-public-demo.sh
```

For Docker Compose:

```bash
CVN_COMPOSE_SMOKE_CLEANUP=true scripts/compose-smoke.sh
```

For a running LAN/NAS/reverse-proxy deployment:

```bash
CVN_DEPLOYMENT_SMOKE_WEB_URL=https://vault.example.test \
CVN_DEPLOYMENT_SMOKE_AUTH_TOKEN="$CVN_AUTH_TOKEN" \
scripts/deployment-smoke.sh
```
