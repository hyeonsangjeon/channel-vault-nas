# Runtime flags

Channel Vault NAS is configured with `CVN_*` environment variables. Set them in
`.env`, `.env.runtime`, your Compose file, or the process environment.

## Common flags

```bash
CVN_DOWNLOAD_DIR=./downfolder
CVN_DATABASE_URL=sqlite+aiosqlite:///./metadata/app.db
CVN_DB_MIGRATE_ON_STARTUP=true
CVN_DOWNLOAD_WORKER_ENABLED=false
CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED=false
CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS=300
CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT=5
CVN_METADATA_SYNC_SCHEDULER_ENABLED=false
CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS=900
CVN_METADATA_SYNC_SCHEDULER_LIMIT=2
CVN_CHANNEL_PROBE_VIDEO_LIMIT=500
CVN_PRESERVATION_CONFIRM_HOURS=24
CVN_YTDLP_BINARY=yt-dlp
CVN_FFPROBE_BINARY=ffprobe
```

## What they do

| Flag | Purpose |
| --- | --- |
| `CVN_DOWNLOAD_DIR` | Archive root. Media is written under here (see [Filesystem contract](filesystem.md)). |
| `CVN_DATABASE_URL` | SQLAlchemy URL for the metadata index (SQLite by default). |
| `CVN_DB_MIGRATE_ON_STARTUP` | Run schema migrations on boot. |
| `CVN_DOWNLOAD_WORKER_ENABLED` | Master switch for real transfers. **`false` = safe by default.** |
| `CVN_DOWNLOAD_WORKER_SCHEDULER_ENABLED` | Let the scheduler auto-claim download jobs. |
| `CVN_DOWNLOAD_WORKER_SCHEDULER_INTERVAL_SECONDS` | How often the download scheduler ticks. |
| `CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT` | Max jobs claimed per scheduler tick. |
| `CVN_METADATA_SYNC_SCHEDULER_ENABLED` | Let the scheduler auto-sync channel metadata. |
| `CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS` | How often the metadata scheduler ticks. |
| `CVN_METADATA_SYNC_SCHEDULER_LIMIT` | Max channels synced per tick. |
| `CVN_CHANNEL_PROBE_VIDEO_LIMIT` | Maximum uploads returned by a channel probe (default `500`). |
| `CVN_PRESERVATION_CONFIRM_HOURS` | Age of the last recorded source sighting before an absent upload can be marked removed (default `24` hours). |
| `CVN_YTDLP_BINARY` | Path/name of the `yt-dlp` binary. |
| `CVN_FFPROBE_BINARY` | Path/name of the `ffprobe` binary. |

!!! tip "Turn on downloads deliberately"
    **Start automatic backup** and the Settings controls apply worker/scheduler
    changes immediately. Environment edits outside the UI need a process restart;
    changes to Compose `.env` values require container recreation, not just
    `docker compose restart`. See [Enable real downloads](../usage/enable-downloads.md).

## Preservation Watch limits

A sync compares known videos with the returned channel listing, not with every
video's watch page. Empty results are ignored. For a truncated listing, older
videos outside the covered upload-date window are left unchanged.

The confirmation threshold is measured from `last_seen_in_source_at` (falling
back to discovery/creation time), **not** from the first sync that reports an
absence. A video last seen more than 24 hours ago can therefore be marked removed
on its first absent sync. This is not evidence of continuous absence, a specific
removal reason, or the absence of copies elsewhere. **Preserved** means the source
is marked absent and the app has a local archived-media record; use storage checks
to verify the files. Reappearance resets the source state to available.

## Process and recovery model

Run **one API process and one replica per metadata database**. Do not start
multiple Uvicorn workers or API containers against the same database. Schedulers,
child-process ownership, and WebSocket delivery are process-local.

On shutdown, active downloads are terminated and marked failed. On startup,
stale running jobs, worker runs, and download scheduler ticks are marked failed
so they cannot stay stuck indefinitely. Partial files remain in place; explicitly
retry the job to let `yt-dlp --continue` attempt to resume it. Resume depends on
the source and file format and is not guaranteed.

## Access flags

| Flag | Purpose |
| --- | --- |
| `CVN_AUTH_TOKEN` | Require a bearer / `X-CVN-Token` for API and unlock the console. See [Access token](../install/access-token.md). |

## Restart adapters

Restart adapter flags are documented in the **Settings** tab. Supported adapter
families in the backend are:

- Manual / local dev
- Docker Compose guidance
- systemd
- supervisor
- Synology package
- QNAP package
- an explicit supervised restart hook

These let the **Settings → Runtime env manifest** drawer emit the exact restart
command for your platform after you change a non-secret runtime override.
