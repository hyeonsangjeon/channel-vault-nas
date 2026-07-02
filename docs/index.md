---
title: Channel Vault NAS
description: >-
  Self-hosted NAS console that archives your own YouTube channels with yt-dlp.
  Install guide and screen-by-screen usage manual.
hide:
  - navigation
---

# Channel Vault NAS

**Self-hosted console for archiving _your own_ YouTube channels to a NAS.**
It plans, verifies, and downloads with `yt-dlp` — and keeps the filesystem as the
durable archive, with SQLite as the index over it.

[Install in 60 seconds :material-rocket-launch:](install/index.md){ .md-button .md-button--primary }
[Open the usage manual :material-book-open-variant:](usage/index.md){ .md-button }

---

## Watch the 5-minute guide

A click-by-click screencast — from a fresh Docker install to a completed channel
backup, recorded on the real UI with on-screen step markers the whole way.

[![Watch the 5-minute Channel Vault NAS getting-started guide](assets/demo/tutorial-poster.png)](https://github.com/hyeonsangjeon/channel-vault-nas/releases/download/v0.1.0-alpha.1/channel-vault-nas-guide-en.mp4)

**▶ Watch / download:**
[English](https://github.com/hyeonsangjeon/channel-vault-nas/releases/download/v0.1.0-alpha.1/channel-vault-nas-guide-en.mp4) ·
[한국어](https://github.com/hyeonsangjeon/channel-vault-nas/releases/download/v0.1.0-alpha.1/channel-vault-nas-guide-ko.mp4) ·
[日本語](https://github.com/hyeonsangjeon/channel-vault-nas/releases/download/v0.1.0-alpha.1/channel-vault-nas-guide-ja.mp4) ·
[中文](https://github.com/hyeonsangjeon/channel-vault-nas/releases/download/v0.1.0-alpha.1/channel-vault-nas-guide-zh.mp4) ·
[हिन्दी](https://github.com/hyeonsangjeon/channel-vault-nas/releases/download/v0.1.0-alpha.1/channel-vault-nas-guide-hi.mp4)

---

## What you get

<div class="grid cards" markdown>

-   :material-clock-fast:{ .lg .middle } __Install in 60 seconds__

    ---

    Pull the published Docker images and run the Compose stack. No build step,
    no toolchain — just Docker.

    [:octicons-arrow-right-24: Install guide](install/index.md)

-   :material-television-guide:{ .lg .middle } __A guided first backup__

    ---

    Paste a channel URL, `@handle`, or `UC…` ID, analyze it, review the plan, and
    start a guarded backup pass — capped at 5 per run.

    [:octicons-arrow-right-24: Usage manual](usage/index.md)

-   :material-nas:{ .lg .middle } __Built for NAS__

    ---

    Separate host folders for metadata, media, and runtime overrides. Synology,
    QNAP, and bare-metal recipes, with reverse-proxy guidance.

    [:octicons-arrow-right-24: NAS install](install/nas.md)

-   :material-shield-check:{ .lg .middle } __Safe by default__

    ---

    Real downloads stay off until you flip the worker flag and confirm the pass.
    The filesystem is never destructively rewritten.

    [:octicons-arrow-right-24: Enable downloads](usage/enable-downloads.md)

</div>

---

## Why it exists

Most download tools answer one question: *"Can this URL be downloaded?"*

Channel Vault NAS answers the NAS operator question:

> "What changed, what is already archived, what is safe to download next, and can
> I recover the archive if the app database disappears?"

The filesystem remains the durable archive. SQLite is the index over that archive
— rescan an existing NAS folder and it gets indexed without moving a single file.

!!! warning "Self-hosted guardrail"
    This alpha is built for localhost, private LAN, VPN, or a trusted reverse
    proxy. Do **not** expose it directly to the public internet. See
    [Access token](install/access-token.md) and the
    [NAS install guide](install/nas.md).

---

## Registry & links

- Docker Hub API image: [`modenaf360/channel-vault-nas-api`](https://hub.docker.com/r/modenaf360/channel-vault-nas-api)
- Docker Hub web image: [`modenaf360/channel-vault-nas-web`](https://hub.docker.com/r/modenaf360/channel-vault-nas-web)
- GHCR mirror: [`ghcr.io/hyeonsangjeon/channel-vault-nas-api`](https://github.com/hyeonsangjeon/channel-vault-nas/pkgs/container/channel-vault-nas-api)
- Source: [`github.com/hyeonsangjeon/channel-vault-nas`](https://github.com/hyeonsangjeon/channel-vault-nas)
