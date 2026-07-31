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

Channel Vault NAS is an open-source Docker app that backs up YouTube channels
to a NAS through three simple steps—register a channel, start a schedule, and
check its status—while reusing existing media and `archive.txt`.

## Short directory description

Back up YouTube channels to a Docker NAS: register a channel, start a bounded
`yt-dlp` schedule, and check what is saved or remaining. Existing media and
`archive.txt` can be imported, and the index can be recovered from mounted
folders and sidecars.

## Verified facts

| Field | Current value |
| --- | --- |
| License | [MIT](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/LICENSE) |
| Source | [GitHub](https://github.com/hyeonsangjeon/channel-vault-nas) |
| Current release | [`v0.2.0`](https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.2.0) |
| First public release | June 11, 2026 |
| Deployment | Two Docker images with one Compose file |
| Architectures | `linux/amd64`, `linux/arm64` |
| Public registry | [Docker Hub API](https://hub.docker.com/r/modenaf360/channel-vault-nas-api) and [web](https://hub.docker.com/r/modenaf360/channel-vault-nas-web) |
| Durable storage | Separate bind mounts for metadata, archive media, and runtime settings |
| Acquisition engine | `yt-dlp`, with `ffmpeg` and `ffprobe` in the API image |
| Interface languages | English, Korean, Japanese, Simplified Chinese, Hindi |
| Intended network | Localhost, private LAN/VPN, or trusted authenticated reverse proxy |

## What is distinctive

- The default UI focuses on channel registration, the backup schedule, and one
  clear state. Queue inspection, storage diagnostics, and runtime controls stay
  under Advanced management.
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

The first two assets show the current everyday workflow and should be preferred
for listings and reviews. The remaining assets provide supporting context. They
may be used when linking to the project with attribution.

- [Simple Home and three-step flow](../assets/user-manual/en/01-home.png)
- [Channel backup status](../assets/user-manual/en/02-channel-overview.png)
- [Channel registration](../assets/user-manual/en/03-channel-registration.png)
- [1280x640 social preview](../assets/social-preview.png)
- [240x240 project icon](../assets/producthunt-thumbnail.png)
- [Existing archive import](../assets/screenshots/existing-archive-import.png)
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
