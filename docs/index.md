---
title: YouTube Channel Backup for NAS
description: >-
  Back up YouTube channels to a Docker NAS. Reuse archive.txt and existing
  media, download only what is missing, and recover the index from disk.
hide:
  - navigation
---

# Channel Vault NAS

**Back up YouTube channels to your NAS without throwing away the archive you
already have.** Paste a channel URL, reuse existing media and `archive.txt`, and
let `yt-dlp` download only what is missing. The files stay durable even if the
searchable SQLite index must be rebuilt.

[Install in 60 seconds :material-rocket-launch:](install/index.md){ .md-button .md-button--primary }
[Bring an existing archive :material-folder-sync:](usage/migrate-existing-archive.md){ .md-button }
[View source on GitHub :fontawesome-brands-github:](https://github.com/hyeonsangjeon/channel-vault-nas){ .md-button }

---

## The part other download queues leave out

<div class="grid cards" markdown>

-   :material-folder-check:{ .lg .middle } __Keep your current archive__

    ---

    Index media, thumbnails, subtitles, and `info.json` sidecars already stored
    on the NAS. Nothing is renamed or deliberately downloaded again.

    [:octicons-arrow-right-24: Migration guide](usage/migrate-existing-archive.md)

-   :material-format-list-checks:{ .lg .middle } __See every skip decision__

    ---

    Downloaded, missing, queued, and skipped videos are visible in the UI instead
    of disappearing inside a command-line flag.

    [:octicons-arrow-right-24: archive.txt import](usage/archive-txt.md)

-   :material-database-refresh:{ .lg .middle } __Recover from disk__

    ---

    Media is durable data. SQLite is a searchable index that can be backed up or
    rebuilt from mounted folders and sidecars.

    [:octicons-arrow-right-24: Filesystem contract](reference/filesystem.md)

-   :material-calendar-sync:{ .lg .middle } __Set it once__

    ---

    Choose the interval and videos per run, start automatic backup, and pause it
    from the same channel screen.

    [:octicons-arrow-right-24: First backup](usage/first-backup.md)

</div>

---

## Your first backup is one screen

Open **Channels**, paste and preview the source, then register it. The channel
screen shows **Total / Downloaded / Remaining** once, beside the one primary
action: **Start automatic backup**. Download interval, videos per run, next run,
and pause all stay together.

[![Channel Vault NAS channel backup screen](assets/screenshots/channel-downloads.png)](usage/first-backup.md)

[Start the click-by-click guide :material-arrow-right:](usage/first-backup.md){ .md-button .md-button--primary }

---

## Why it exists

Most download tools answer one question: *"Can this URL be downloaded?"*

Channel Vault NAS answers the NAS operator question:

> "What changed, what is already archived, what is safe to download next, and can
> I recover the archive if the app database disappears?"

The filesystem remains the durable archive. SQLite is the index over that archive
— rescan an existing NAS folder and it gets indexed without moving a single file.

### A deliberate fit, not the only downloader

Choose TubeArchivist when an established media-server experience matters most,
Pinchflat when you want a focused subscription downloader, and Channel Vault
when an existing NAS archive, visible skip decisions, and disk-first recovery
matter most.

[Compare the workflows honestly :material-compare:](about/comparison.md){ .md-button }

!!! warning "Self-hosted guardrail"
    This self-hosted release is built for localhost, private LAN, VPN, or a
    trusted reverse proxy. Do **not** expose it directly to the public internet. See
    [Access token](install/access-token.md) and the
    [NAS install guide](install/nas.md).

---

## Registry & links

- Docker Hub API image: [`modenaf360/channel-vault-nas-api`](https://hub.docker.com/r/modenaf360/channel-vault-nas-api)
- Docker Hub web image: [`modenaf360/channel-vault-nas-web`](https://hub.docker.com/r/modenaf360/channel-vault-nas-web)
- GHCR mirror: [`ghcr.io/hyeonsangjeon/channel-vault-nas-api`](https://github.com/hyeonsangjeon/channel-vault-nas/pkgs/container/channel-vault-nas-api)
- Source: [`github.com/hyeonsangjeon/channel-vault-nas`](https://github.com/hyeonsangjeon/channel-vault-nas)
