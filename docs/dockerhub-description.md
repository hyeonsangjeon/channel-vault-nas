# Channel Vault NAS

[![GitHub release](https://img.shields.io/github/v/release/hyeonsangjeon/channel-vault-nas?include_prereleases&label=release)](https://github.com/hyeonsangjeon/channel-vault-nas/releases)
[![CI](https://github.com/hyeonsangjeon/channel-vault-nas/actions/workflows/ci.yml/badge.svg)](https://github.com/hyeonsangjeon/channel-vault-nas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399)](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE)

![Channel Vault NAS archive console](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/readme-hero.svg)

Turn a YouTube channel into a recoverable NAS archive. Channel Vault NAS reuses
existing media and `archive.txt`, downloads only missing videos, and keeps new
uploads backed up with `yt-dlp`.

> Guarded self-hosted release: designed for localhost, private LAN, VPN, or trusted
> reverse-proxy use. Do not expose the raw API directly to the public internet.

## Images

This app is published as two images that run together with Docker Compose:

- `modenaf360/channel-vault-nas-api:0.1.0-alpha.2`
- `modenaf360/channel-vault-nas-web:0.1.0-alpha.2`

Both images are multi-arch: `linux/amd64` and `linux/arm64`.

## Why use it

- Import existing NAS folders without deliberately re-downloading them
- See downloaded, missing, queued, and skipped `archive.txt` decisions
- Start or pause automatic backup from the channel screen
- Rebuild the searchable SQLite index from durable media and sidecars
- Library indexing for media files, sidecars, thumbnails, and coverage
- NAS storage scanner for drift, pressure, orphan sidecars, and recovery checks

## Screenshots

| Dashboard overview | Guarded download queue |
| --- | --- |
| ![Dashboard overview](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/dashboard-cockpit.png) | ![Channel backup schedule](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/channel-downloads.png) |

| Queue console | Library shelf |
| --- | --- |
| ![Queue console](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/queue-console.png) | ![Library shelf](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/library-shelf.png) |

| Add a channel | Bring an existing archive |
| --- | --- |
| ![Channel registration](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/channel-registration.png) | ![Existing NAS folder and archive.txt import](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/existing-archive-import.png) |

## Architecture

![Channel Vault NAS architecture overview](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/architecture-overview.svg)

## Quick Start

```bash
mkdir channel-vault-nas && cd channel-vault-nas
curl -fsSLO https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml
docker compose -f compose.release.yml up -d
```

Open `http://127.0.0.1:5173/`, register a channel, choose the interval and
videos per run, then click **Start automatic backup**.

## Guardrails

Downloads are disabled by default and worker passes are bounded. The filesystem
remains the durable archive; SQLite is the searchable index.

For LAN/NAS demos, set `CVN_AUTH_TOKEN` and place the app behind a trusted
reverse proxy or VPN. Keep downloads limited to media you own, are authorized to
archive, or have already exported from your own account.

## Links

- GitHub: <https://github.com/hyeonsangjeon/channel-vault-nas>
- Manual: <https://hyeonsangjeon.github.io/channel-vault-nas/>
- Compatibility reports: <https://github.com/hyeonsangjeon/channel-vault-nas/discussions/7>
- Release: <https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.2>
- Security notes: <https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/SECURITY.md>
