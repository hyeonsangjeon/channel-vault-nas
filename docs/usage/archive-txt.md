# archive.txt import

Already have a `youtube-dl` / `yt-dlp` download archive? Channel Vault NAS
understands the classic ledger so you can reconcile an existing collection instead
of re-downloading everything.

## The classic workflow

The traditional command records every downloaded video ID in a text ledger:

```bash
youtube-dl --download-archive archive.txt "https://www.youtube.com/playlist?list=..."
```

## The app workflow

In Channel Vault NAS, that same `archive.txt` becomes a guided reconciliation:

1. **Paste or drop** `archive.txt` into the import panel on the **Channels** tab.
2. **Preview** the parsed rows — already archived, known missing, unknown,
   duplicate, and invalid entries are separated for you.
3. **Stage only** the videos that still need records or candidates.
4. **Sync metadata** for placeholder rows so titles, dates, and sizes fill in.
5. **Queue/download** only the fresh candidates — nothing already in the ledger is
   re-fetched.

!!! tip "Reconcile an existing NAS folder too"
    You can also rescan an existing archive folder and index it without moving any
    files. See the [Filesystem contract](../reference/filesystem.md) for the
    expected layout — the database indexes the filesystem, not the other way
    around.

!!! note "Safe by default"
    Importing a ledger never starts real transfers on its own. Downloads still go
    through the [guarded confirmation](enable-downloads.md) and the 5-per-pass cap.
