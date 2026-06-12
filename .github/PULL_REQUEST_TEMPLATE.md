# Pull Request

## What changed

-

## Why

-

## Safety checklist

- [ ] Real downloads still require explicit operator confirmation.
- [ ] No private paths, tokens, source URLs, or channel/video titles are added
      to public logs, fixtures, screenshots, or docs.
- [ ] Filesystem-relative archive paths and sidecar recovery contracts are
      preserved.
- [ ] UI changes were checked for desktop/mobile overflow.

## Verification

- [ ] `backend/.venv/bin/ruff check backend/app backend/tests backend/scripts`
- [ ] `backend/.venv/bin/pytest backend/tests -q`
- [ ] `npm run build` from `frontend/`
- [ ] `npm run e2e:smoke -- --project=chromium` from `frontend/`
- [ ] `CVN_E2E_AUTH_TOKEN=cvn-local-test-token npm run e2e:auth -- --project=chromium` from `frontend/`
- [ ] `bash -n scripts/deployment-smoke.sh`
- [ ] `bash -n scripts/capture-public-demo.sh`
- [ ] `scripts/public-alpha-check.sh`

## Screenshots

Add screenshots for UI changes, or explain why none are needed.
