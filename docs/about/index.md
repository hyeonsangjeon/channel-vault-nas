# About

Channel Vault NAS is a **guarded, self-hosted console for archiving your own
YouTube channels** with `yt-dlp`. It syncs channel metadata, stages only missing
videos, runs guarded download passes, and keeps a disk-aware library of what you
actually have on the NAS.

!!! warning "Personal archiving only"
    Archive channels you own or have the right to archive. You are responsible for
    complying with YouTube's Terms of Service and copyright law in your
    jurisdiction. See
    [Use boundaries](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/use-boundaries.md).

## Images & releases

<div class="grid cards" markdown>

-   :fontawesome-brands-docker:{ .lg .middle } __Docker Hub__

    ---

    - [`modenaf360/channel-vault-nas-api`](https://hub.docker.com/r/modenaf360/channel-vault-nas-api)
    - [`modenaf360/channel-vault-nas-web`](https://hub.docker.com/r/modenaf360/channel-vault-nas-web)

-   :octicons-container-24:{ .lg .middle } __GitHub Container Registry__

    ---

    - [`ghcr.io/hyeonsangjeon/channel-vault-nas-api`](https://github.com/hyeonsangjeon/channel-vault-nas/pkgs/container/channel-vault-nas-api)
    - [`ghcr.io/hyeonsangjeon/channel-vault-nas-web`](https://github.com/hyeonsangjeon/channel-vault-nas/pkgs/container/channel-vault-nas-web)

-   :octicons-tag-24:{ .lg .middle } __Release__

    ---

    [`v0.1.0-alpha.1`](https://github.com/hyeonsangjeon/channel-vault-nas/releases/tag/v0.1.0-alpha.1)
    — images and the 5-language video guide.

-   :octicons-mark-github-16:{ .lg .middle } __Source__

    ---

    [github.com/hyeonsangjeon/channel-vault-nas](https://github.com/hyeonsangjeon/channel-vault-nas)

</div>

## Deep documentation

These documents live in the repository and render on GitHub:

| Document | What it covers |
| --- | --- |
| [Architecture](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/architecture.md) | Backend/frontend/worker/scheduler structure. |
| [Product brief](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/product-brief.md) | What the product is and who it's for. |
| [Roadmap](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/roadmap.md) | Planned direction. |
| [Deployment & security](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md) | Exposure model, tokens, reverse proxy. |
| [Backup & restore](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/backup-restore.md) | Protecting the metadata index. |
| [Storage recovery](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/storage-recovery.md) | Reconciling drift and orphan sidecars. |
| [Archive priorities](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/archive-priorities.md) | What to archive first. |
| [Channel registration recommendations](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/channel-registration-recommendations.md) | Getting the source right. |
| [NAS install notes](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/nas-install.md) | Extra Synology / QNAP detail. |

## Relationship to youtube-dl-nas

Channel Vault NAS is a modern, guarded successor in spirit to the classic
`youtube-dl-nas` workflow — the same "archive to my NAS" goal, rebuilt around a
FastAPI + React console, a disk-aware library, and safe-by-default download guards.

## License & responsibility

The project is open source on GitHub. It is intended for archiving content you own
or have the right to archive. Review the
[use boundaries](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/use-boundaries.md)
before you begin.
