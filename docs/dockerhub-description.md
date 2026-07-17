# Channel Vault NAS

[![GitHub release](https://img.shields.io/github/v/release/hyeonsangjeon/channel-vault-nas?include_prereleases&label=release)](https://github.com/hyeonsangjeon/channel-vault-nas/releases)
[![CI](https://github.com/hyeonsangjeon/channel-vault-nas/actions/workflows/ci.yml/badge.svg)](https://github.com/hyeonsangjeon/channel-vault-nas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399)](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE)

![Channel Vault NAS Home showing its simple three-step backup flow](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/user-manual/en/01-home.png)

Turn a YouTube channel into a recoverable NAS archive in three steps: register
the channel, start a schedule, and check one clear backup status. Channel Vault
NAS reuses existing media and `archive.txt`, downloads only missing videos, and
keeps new uploads backed up with `yt-dlp`.

> Guarded self-hosted release: designed for localhost, private LAN, VPN, or trusted
> reverse-proxy use. Do not expose the raw API directly to the public internet.

## Images

This app is published as two images that run together with Docker Compose:

- `modenaf360/channel-vault-nas-api:0.1.0-alpha.3`
- `modenaf360/channel-vault-nas-web:0.1.0-alpha.3`

Both images are multi-arch: `linux/amd64` and `linux/arm64`.

## Why use it

- A simple default UI for channel registration, schedules, and backup status
- Queue, storage, diagnostics, and runtime controls kept under Advanced management
- Import existing NAS folders without deliberately re-downloading them
- See downloaded, missing, queued, and skipped `archive.txt` decisions
- Start or pause automatic backup from the channel screen
- Rebuild the searchable SQLite index from durable media and sidecars
- Library indexing for media files, sidecars, thumbnails, and coverage
- NAS storage scanner for drift, pressure, orphan sidecars, and recovery checks

## Everyday workflow

| 1. Register a channel | 2–3. Start the schedule and check its status |
| --- | --- |
| ![Check and register a channel](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/user-manual/en/03-channel-registration.png) | ![Channel view showing saved and remaining counts, current status, and next run](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/user-manual/en/02-channel-overview.png) |

Already have files? Use the [existing archive import](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/existing-archive-import.png) before starting the schedule.

Advanced management stays available when you need queue or library detail:

| Queue | Saved videos |
| --- | --- |
| ![Advanced download queue](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/queue-console.png) | ![Saved videos library](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/screenshots/library-shelf.png) |

## Architecture

![Channel Vault NAS architecture overview](https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/docs/assets/architecture-overview.svg)

## Quick Start

```bash
mkdir channel-vault-nas && cd channel-vault-nas
curl -fsSLO https://raw.githubusercontent.com/hyeonsangjeon/channel-vault-nas/main/compose.release.yml
docker compose -f compose.release.yml up -d
```

Open `http://127.0.0.1:5173/`, then:

1. Select **Register channel**, paste a channel address, select **Check
   channel**, and confirm it.
2. Choose the interval and videos per run, then select **Start automatic
   backup**.
3. Confirm the channel shows **Automatic backup is on** or **Automatic backup
   is running** and check the saved, remaining, and next-run details.

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
- Release: <https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.3>
- Security notes: <https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/SECURITY.md>
