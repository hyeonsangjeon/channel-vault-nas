---
title: Project Facts and Media
description: >-
  Verified facts, concise descriptions, screenshots, and links for directory
  editors, reviewers, and people sharing Channel Vault NAS.
---

# Project facts and media

This page is the canonical source for directory listings, reviews, and community
posts about Channel Vault NAS. It contains factual copy and current assets rather
than launch slogans.

## One sentence

Channel Vault NAS is an open-source Docker console that backs up YouTube
channels to a NAS, reuses existing media and `archive.txt`, downloads only
missing videos, and can rebuild its searchable index from files on disk.

## Short directory description

Back up YouTube channels to a Docker NAS. Import existing media and
`archive.txt`, review every missing or skipped video, schedule bounded `yt-dlp`
downloads, and recover the library index from mounted folders and sidecars.

## Verified facts

| Field | Current value |
| --- | --- |
| License | [MIT](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE) |
| Source | [GitHub](https://github.com/hyeonsangjeon/channel-vault-nas) |
| Current release | [`v0.1.0-alpha.3`](https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.3) |
| First public release | June 11, 2026 |
| Deployment | Two Docker images with one Compose file |
| Architectures | `linux/amd64`, `linux/arm64` |
| Public registry | [Docker Hub API](https://hub.docker.com/r/modenaf360/channel-vault-nas-api) and [web](https://hub.docker.com/r/modenaf360/channel-vault-nas-web) |
| Durable storage | Separate bind mounts for metadata, archive media, and runtime settings |
| Acquisition engine | `yt-dlp`, with `ffmpeg` and `ffprobe` in the API image |
| Interface languages | English, Korean, Japanese, Simplified Chinese, Hindi |
| Intended network | Localhost, private LAN/VPN, or trusted authenticated reverse proxy |

## What is distinctive

- Existing NAS media, subtitles, thumbnails, and `info.json` sidecars can be
  indexed without deliberately downloading them again.
- `archive.txt` decisions remain visible as downloaded, missing, queued, or
  skipped records instead of disappearing inside a command-line option.
- The filesystem is durable archive data; SQLite is a backupable and
  rebuildable search index.
- Channel registration and actual downloading are separate. Downloads begin
  only after the operator starts automatic backup.

See the [honest workflow comparison](comparison.md) for cases where
TubeArchivist, Pinchflat, TubeSync, or ytdl-sub may be a better fit.

## Media assets

All assets below show the current `alpha.3` workflow and may be used when
linking to the project with attribution.

- [1280x640 social preview](../assets/social-preview.png)
- [240x240 project icon](../assets/producthunt-thumbnail.png)
- [Automatic backup screen](../assets/screenshots/channel-downloads.png)
- [Channel registration screen](../assets/screenshots/channel-registration.png)
- [Existing archive import](../assets/screenshots/existing-archive-import.png)
- [Dashboard overview](../assets/screenshots/dashboard-cockpit.png)
- [12-second product demo](../assets/demo/channel-vault-public-alpha.gif)

## Suggested directory fields

| Field | Suggested value |
| --- | --- |
| Name | Channel Vault NAS |
| Category | Self-hosted media archive / NAS backup |
| Tags | self-hosted, NAS, YouTube backup, yt-dlp, archive.txt, Docker |
| Website | `https://hyeonsangjeon.github.io/channel-vault-nas/` |
| Repository | `https://github.com/hyeonsangjeon/channel-vault-nas` |
| Install guide | `https://hyeonsangjeon.github.io/channel-vault-nas/install/docker/` |

## Current limitations

- This is a public alpha, not a mature media-server replacement.
- A supported cookies or authenticated/private-video workflow is not exposed.
- Operators are responsible for source terms, copyright, storage capacity, and
  securing remote access.
