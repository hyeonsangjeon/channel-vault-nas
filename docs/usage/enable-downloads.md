# Enable real downloads

Channel Vault NAS can register and preview without starting any media transfer.
The app arms the worker when you click **Start automatic backup**.

## Turn on the worker

The simplest path is the UI: open a channel, choose the download interval and
videos per run, then click **Start automatic backup**. It turns on real
downloads, metadata sync, and the scheduler immediately (see
[Channel backup → Step 4](first-backup.md#step-4-start-the-automatic-download-schedule)).
To arm the NAS globally instead, set these runtime env values:

```bash
CVN_DOWNLOAD_WORKER_ENABLED=true
CVN_YTDLP_BINARY=yt-dlp
CVN_FFPROBE_BINARY=ffprobe
```

The channel button and **Settings** tab hot-apply these worker/scheduler values;
no container restart is required. Restart only when you edit `.env` manually.

=== "Docker / Compose"

    Add the values to `.env` (or `.env.runtime`) and restart the `api` service:

    ```bash
    docker compose -f compose.release.yml restart api
    ```

=== "Local development"

    Export the flag and restart uvicorn:

    ```bash
    CVN_DOWNLOAD_WORKER_ENABLED=true \
    CVN_DB_MIGRATE_ON_STARTUP=true \
    uvicorn app.main:app --host 127.0.0.1 --port 8000
    ```

!!! tip "Do it from the UI"
    Open **Settings → Runtime env manifest**. It shows the active values and
    pending overrides. See the
    [Settings tour](product-tour.md#settings).

## The pass is always bounded

Worker passes are intentionally capped so an accidental click can't saturate your
NAS or your network:

- **Automatic backup** claims only your **Per run**
  batch size each time it runs — never the whole channel at once.
- The advanced **Manual one-pass test** runs up to that same batch size **once**,
  behind a confirmation modal.
- API `run-once` limits are capped.
- Per-channel policy can **pause** worker claims.
- Candidate creation can continue **even when workers are paused**.

<figure markdown="span">
  ![Automatic download schedule](../assets/user-manual/en/04-download-confirm-modal.png){ loading=lazy }
  <figcaption>Starting the schedule enables real downloads; each pass claims only the configured batch size. The advanced Manual one-pass test is gated by the same confirmation modal.</figcaption>
</figure>

!!! warning "Verify before you expose"
    Enabling downloads does not expose your NAS. Keep the raw API loopback-bound,
    set an [access token](../install/access-token.md), and publish only the web
    tier through a trusted reverse proxy or VPN.
