# Install

There are three ways to run Channel Vault NAS. Pick one:

<div class="grid cards" markdown>

-   :material-docker:{ .lg .middle } __Docker (recommended)__

    ---

    Pull both published images (`api` and `web`) and run them with Compose, the
    fastest path and the one used for NAS deployments.

    [:octicons-arrow-right-24: Docker install](docker.md)

-   :material-nas:{ .lg .middle } __NAS (Synology / QNAP)__

    ---

    Container Manager / Container Station, separate host folders, reverse proxy,
    and a public compatibility-report thread.

    [:octicons-arrow-right-24: NAS install](nas.md)

-   :material-language-python:{ .lg .middle } __Local development__

    ---

    Run the FastAPI backend and the Vite dev server directly for hacking on the
    code.

    [:octicons-arrow-right-24: Local dev](local-dev.md)

</div>

## Prerequisites

=== "Docker / NAS"

    - Docker with the Compose plugin (`docker compose`)
    - ~300 MB for the images, plus disk space for your archive

=== "Local development"

    - Python 3.11+
    - Node.js 20+ (CI verifies with Node.js 24)
    - `yt-dlp`
    - `ffmpeg` / `ffprobe`

## The three run modes

| Mode | Best for | Guide |
| --- | --- | --- |
| **Pull a published image** | A fast, reproducible install | [Docker → published images](docker.md#start-in-60-seconds-published-images) |
| **Compose build from source** | Evaluating the current `main` / a branch | [Docker → build from source](docker.md#build-from-source) |
| **Local development** | Editing backend/frontend code | [Local development](local-dev.md) |

Both Docker paths store archive data in bind-mounted host folders, so your media
and metadata live on disk, not inside a container layer.

!!! tip "NAS operators: separate your folders first"
    Before the first start, put SQLite metadata, downloaded media, and runtime
    overrides on **three separate host folders** so each can be backed up
    independently. See [NAS install](nas.md#before-you-start).

    Check [compatibility and real NAS reports](compatibility.md) for verified
    architectures and community-tested hardware.

## After install

1. Open the web console at `http://127.0.0.1:5173/`.
2. Follow [Your first channel backup](../usage/first-backup.md) to archive your
   first channel.
3. Real downloads stay disabled until you click **Start automatic backup**
   (which [enables the worker](../usage/enable-downloads.md) for you) or run the
   advanced manual test.

!!! question "You only see `{\"detail\":\"Not Found\"}`?"
    You opened the raw **API** port instead of the **web** console. Open the web
    port (`CVN_WEB_PORT`, default `5173`). The API port only serves paths like
    `/api/health`. If there is no web port at all, you are probably running only
    the `api` container. Channel Vault needs both the `api` and `web` images.
    Full explanation in [NAS troubleshooting](nas.md#troubleshooting-detailnot-found).
