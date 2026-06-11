# Contributing

Channel Vault NAS is an alpha NAS archive console. Contributions are welcome,
but changes should keep the product focused on creator-owned media,
user-authorized backups, Google Takeout, and existing local NAS folders.

## Before Opening A PR

1. Read [Use Boundaries](docs/use-boundaries.md).
2. Read [Security Policy](SECURITY.md) if your change touches runtime settings,
   networking, logs, exports, or download execution.
3. Keep real downloads guarded. New UI flows must not start downloads without an
   explicit operator confirmation.
4. Prefer filesystem-relative archive paths and sidecar-backed recovery.

## Local Checks

Preferred public-alpha gate:

```bash
scripts/public-alpha-check.sh
```

Backend:

```bash
cd backend
source .venv/bin/activate
ruff check app tests scripts
pytest -q
```

Frontend:

```bash
cd frontend
npm run build
npm run e2e:smoke -- --project=chromium
```

Public screenshot refresh, only when README screenshots need updating:

```bash
cd frontend
CVN_CAPTURE_PUBLIC_SCREENSHOTS=true npx playwright test e2e/public-screenshots.spec.ts --project=chromium
```

Use `CVN_PUBLIC_ALPHA_SKIP_BROWSER=true scripts/public-alpha-check.sh` for a
fast non-browser release-gate pass while iterating locally.

## UI Changes

- Keep the first screen useful. Avoid landing-page-only work when the app can
  show an operational surface.
- Make queue/download actions explain whether they are dry-run, queued, locked,
  or live.
- Keep empty states actionable.
- Test desktop and mobile for layout overflow when changing panels or drawers.

## Reporting Private Details

Do not paste private archive paths, source URLs, support bundles, logs, or
screenshots into public issues before checking them. Redact paths and source
identifiers when they are not needed for reproduction.
