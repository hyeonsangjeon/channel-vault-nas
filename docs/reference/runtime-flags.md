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
CVN_DOWNLOAD_WORKER_SCHEDULER_LIMIT=1
CVN_METADATA_SYNC_SCHEDULER_ENABLED=false
CVN_METADATA_SYNC_SCHEDULER_INTERVAL_SECONDS=900
CVN_METADATA_SYNC_SCHEDULER_LIMIT=2
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
| `CVN_YTDLP_BINARY` | Path/name of the `yt-dlp` binary. |
| `CVN_FFPROBE_BINARY` | Path/name of the `ffprobe` binary. |

!!! tip "Turn on downloads deliberately"
    `CVN_DOWNLOAD_WORKER_ENABLED=true` plus a restart is the one intentional step
    for real transfers. See [Enable real downloads](../usage/enable-downloads.md).

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
