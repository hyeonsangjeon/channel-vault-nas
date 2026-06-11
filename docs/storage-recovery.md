# Storage and Recovery Contract

작성일: 2026-05-30

## Principle

Channel Vault NAS uses two layers:

- SQLite is the operational index.
- Filesystem sidecars are the durable archive record.

The app should feel fast and queryable because of SQLite, but the NAS folder
must remain understandable and recoverable without SQLite.

## SQLite Responsibilities

SQLite owns runtime and UI state:

- registered channels and playlists
- sync jobs
- download jobs
- queue progress
- channel policies
- search/filter indexes
- dashboard aggregates
- local account/auth state

SQLite is allowed to be rebuilt from sidecars where possible.

## Sidecar Responsibilities

Every downloaded video folder must carry enough metadata to survive DB loss:

```text
downfolder/
  channels/
    @wingnut987s4 [UCmLADXQtWVuzOnOK5TNrWaw]/
      _channel.info.json
      poster.jpg
      2022/
        2022-05-20 - HEAVY BAG DRILLS [6lXl1hkEgcA]/
          video.mp4
          video.info.json
          thumbnail.jpg
          video.ko.srt
          video.nfo
```

Required video sidecar:

- `video.info.json`

Preferred sidecars:

- `thumbnail.jpg`
- `video.{lang}.srt` or `video.{lang}.vtt`
- `video.nfo`

Required stable anchors:

- channel ID, for example `UCmLADXQtWVuzOnOK5TNrWaw`
- video ID, for example `6lXl1hkEgcA`
- upload date, for example `20220520`

## Migration Rules

Schema changes must be boring and recoverable:

- Alembic migrations are the source of truth before alpha.
- Startup may use `create_all()` only during the earliest scaffold.
- Before schema migration, copy the SQLite file into `metadata/db-backups/`.
- Migrations should be additive by default.
- Destructive changes are split across releases:
  - add new column/table
  - dual-read or backfill
  - switch writes
  - remove old field in a later release
- A failed migration should stop the app with a recoverable error rather than
  silently creating a new empty database over user state.

## Reinstall Recovery

If the metadata volume is missing but `downfolder` survives:

1. Scan for `video.info.json`.
2. Parse channel/video IDs from sidecars and folder anchors.
3. Recreate `Channel`, `Video`, `MediaFile`, and `Subtitle` rows.
4. Mark unknown job history as unavailable rather than inventing it.
5. Show a recovery report before writing changes.

Current scaffold endpoint:

```text
GET /api/library/_rescan/plan
```

This endpoint is read-only. It returns candidate video folders that can
repopulate the DB.

Current startup guard:

```text
CVN_DB_BACKUP_ON_STARTUP=true
CVN_DB_BACKUP_KEEP=5
```

When enabled, an existing SQLite DB is copied into `metadata/db-backups/` before
the app initializes schema state. This is the future Alembic migration backup
hook.

## User-Facing Docker Guidance

Docker installs should mount both:

```text
/app/metadata
/app/downfolder
```

If `metadata` is not persistent, the app can recover the library index from
`downfolder`, but it cannot recover runtime-only history such as old queue
attempts or auth/session state.
