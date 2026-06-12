# Backup &amp; restore runbook

Channel Vault NAS keeps two durable layers:

- **SQLite metadata** (`CVN_METADATA_DIR`) — the operational index (channels,
  videos, jobs, library, telemetry) plus timestamped startup backups.
- **Filesystem sidecars** (`CVN_DOWNLOAD_DIR`) — media files alongside
  `video.info.json`, subtitles, thumbnails, and NFO. The archive is
  **self-describing**, so the index can be rebuilt from sidecars if the DB is
  lost.

You are responsible for backing up these folders; the app does not manage
off-NAS backups.

The same path checks and copyable command templates are available in the app at
**Settings → Env guide → Backup / restore confidence**.

## What to back up

| Item | Path (host) | Why |
| --- | --- | --- |
| Metadata DB + startup backups | `CVN_METADATA_DIR` (e.g. `/volume1/channel-vault-nas/metadata`) | operational index; fast restore |
| Archive media + sidecars | `CVN_DOWNLOAD_DIR` (e.g. `/volume1/channel-vault-nas/archive`) | source of truth; enables index rebuild |
| Runtime overrides | `CVN_RUNTIME_HOST_DIR` → `.env.runtime` (`CVN_RUNTIME_ENV_FILE`) | non-secret runtime flags |
| Operator token / `.env` | wherever you store `CVN_AUTH_TOKEN` | secret — keep in a password manager / secrets store, **not** beside the public archive |

The metadata folder already retains the last `CVN_DB_BACKUP_KEEP` (default `5`)
startup backups, created before each migrate-on-startup.

## Back up

Prefer a **consistent** copy. Either stop the stack briefly, or take a
transactional SQLite copy while it runs:

```bash
# Option A: quiesce, then copy (simplest).
docker compose stop        # or: systemctl stop channel-vault-nas-api
rsync -a --delete /volume1/channel-vault-nas/metadata/  /backup/cvn/metadata/
rsync -a            /volume1/channel-vault-nas/archive/   /backup/cvn/archive/
rsync -a --delete /volume1/channel-vault-nas/runtime/   /backup/cvn/runtime/
docker compose start

# Option B: hot SQLite snapshot (no downtime for the DB file).
# Use the path CVN_DATABASE_URL resolves to. Docker: the mounted metadata dir.
# Bare-metal: set CVN_DATABASE_URL to an absolute path (otherwise the DB lives
# under <backend>/metadata/app.db, not CVN_METADATA_DIR).
sqlite3 /volume1/channel-vault-nas/metadata/app.db ".backup '/backup/cvn/app.db'"
```

The archive is large; back it up on its own schedule. Sidecars are small but
**essential** — never exclude `*.info.json`.

## Restore

1. Restore the three folders to the **same host paths**, then start the stack.
   The dashboard **NAS Mount Doctor** confirms the paths are writable/separated.
2. If only the **DB** was lost or corrupted but the archive survived, start with
   an empty metadata DB and **rebuild the index from sidecars**:
   - UI: Import kit → scan the existing NAS folder → **Apply**.
   - API: `POST /api/library/_rescan/apply` (preview with
     `GET /api/library/_rescan/plan`).
   - For targeted gaps, Insights → Storage → drift, or
     `POST /api/storage/drift/recover-unindexed` (dry-run first).
3. The rescan is **read-only** against your files — it indexes what already
   exists and never re-downloads or moves media.

## Verify

- Dashboard release-readiness score and **library coverage** counts.
- `GET /api/storage/scan` (Insights → Storage) shows media/sidecar counts and
  any remaining drift.
- Spot-check a channel's library tab for archived/missing state.

## Notes

- Keep at least one **off-NAS** copy of metadata + sidecars; a single NAS volume
  is not a backup.
- The optional `CVN_AUTH_TOKEN` is not stored in the DB or sidecars; restoring
  the folders does not restore the token — re-supply it via env.
