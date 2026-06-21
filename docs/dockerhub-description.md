# Channel Vault NAS

[![GitHub release](https://img.shields.io/github/v/release/hyeonsangjeon/channel-vault-nas?include_prereleases&label=release)](https://github.com/hyeonsangjeon/channel-vault-nas/releases)
[![CI](https://github.com/hyeonsangjeon/channel-vault-nas/actions/workflows/ci.yml/badge.svg)](https://github.com/hyeonsangjeon/channel-vault-nas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399)](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE)

![Channel Vault NAS archive console](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/readme-hero.svg)

Self-hosted NAS console for YouTube channel archiving. Channel Vault NAS turns
the classic `archive.txt` idea into a visual operator console: register a
channel, sync metadata, skip videos already on disk, queue only missing videos,
run bounded download passes, and keep the local archive searchable from the app.

> Guarded self-hosted release: designed for localhost, private LAN, VPN, or trusted
> reverse-proxy use. Do not expose the raw API directly to the public internet.

## Images

This app is published as two images that run together with Docker Compose:

- `modenaf360/channel-vault-nas-api:0.1.0-alpha.1`
- `modenaf360/channel-vault-nas-web:0.1.0-alpha.1`

Both images are multi-arch: `linux/amd64` and `linux/arm64`.

## What it gives you

- Channel registration, metadata sync, and scheduler audit logs
- `archive.txt`-style skip visibility: already archived videos are obvious
- Missing-video candidate generation and guarded worker passes
- Library indexing for media files, sidecars, thumbnails, and coverage
- NAS storage scanner for drift, pressure, orphan sidecars, and recovery checks
- Runtime settings, restart guidance, support bundle, and operator manual

## Screenshots

| Dashboard overview | Guarded download queue |
| --- | --- |
| ![Dashboard overview](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/dashboard-cockpit.png) | ![Channel downloads](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/channel-downloads.png) |

| Queue console | Library shelf |
| --- | --- |
| ![Queue console](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/queue-console.png) | ![Library shelf](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/library-shelf.png) |

## Architecture

![Channel Vault NAS architecture overview](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/architecture-overview.svg)

## Quick Start

```bash
git clone https://github.com/hyeonsangjeon/channel-vault-nas.git
cd channel-vault-nas
cp .env.example .env
mkdir -p metadata downfolder runtime

export CVN_API_IMAGE=modenaf360/channel-vault-nas-api:0.1.0-alpha.1
export CVN_WEB_IMAGE=modenaf360/channel-vault-nas-web:0.1.0-alpha.1
docker compose pull
docker compose up -d --no-build
```

Open `http://127.0.0.1:5173/`.

## Guardrails

Downloads are disabled by default and worker passes are bounded. The filesystem
remains the durable archive; SQLite is the searchable index.

For LAN/NAS demos, set `CVN_AUTH_TOKEN` and place the app behind a trusted
reverse proxy or VPN. Keep downloads limited to media you own, are authorized to
archive, or have already exported from your own account.

## Links

- GitHub: <https://github.com/hyeonsangjeon/channel-vault-nas>
- Manual: <https://hyeonsangjeon.github.io/channel-vault-nas/>
- Release: <https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.1>
- Security notes: <https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/SECURITY.md>
