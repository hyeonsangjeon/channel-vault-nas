# Filesystem contract

Channel Vault NAS treats your disk as the source of truth. The database **indexes**
the filesystem — not the other way around — so existing NAS folders can be
rescanned without moving anything.

## Default layout

The default archive layout is per-video folders under the configured download
root (`CVN_DOWNLOAD_DIR`):

```text
downfolder/
  channels/
    @handle [UC...channel_id]/
      2026/
        2026-06-03 - Video title [video_id]/
          video.mp4
          video.info.json
          *.jpg / *.webp
          *.vtt / *.srt
```

## Design principles

- `video.info.json` sidecars live **beside** the media file.
- The database **indexes** the filesystem, not the other way around.
- Source title changes do **not** rename existing folders automatically.
- Source deletion / private / block events **never** delete local media by default.
- Existing NAS folders can be **rescanned and indexed** without moving files.

!!! note "Disk-aware coverage"
    Archive counts across Library, Channel detail, and Dashboard coverage are
    disk-aware: if a file is gone from the NAS, a stale database row shows as
    **missing media** instead of pretending the video is still archived.

!!! tip "Recovery"
    Insights reports unindexed media, indexed-but-missing files, and orphan
    sidecars so you can reconcile drift. For deeper recovery procedures see the
    [Storage recovery guide](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/storage-recovery.md).
