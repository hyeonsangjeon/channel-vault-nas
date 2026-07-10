# Bring an existing archive

You do not need to start over. Channel Vault NAS can reconcile the two things
many long-time `youtube-dl` / `yt-dlp` users already have:

- media and sidecar files in a NAS folder
- a `--download-archive` text file

The goal is to mark existing videos as archived **before** automatic backup is
started, so they are not downloaded again.

## 1. Mount the existing folder

Point `CVN_DOWNLOAD_HOST_DIR` at the folder that contains your archive:

```env
CVN_DOWNLOAD_HOST_DIR=/volume1/video/channel-vault
```

Then start or restart the Compose stack. Channel Vault never renames or deletes
existing files during a scan.

## 2. Scan the NAS folder

Open **Channels → Import kit → Existing NAS folder**, preview the scan, and
apply it. Media, thumbnails, subtitles, and `info.json` sidecars are indexed from
disk.

!!! tip "Keep sidecars beside the video"
    `video.info.json` gives Channel Vault the strongest match. Files can still be
    recovered without it, but title-only matching is less precise.

## 3. Import archive.txt

Open **Channels → Import kit → archive.txt**, paste the file contents or
choose the file, then preview the reconciliation. Review the recognized,
duplicate, and invalid rows before applying it.

Common formats are accepted, including:

```text
youtube VIDEO_ID
VIDEO_ID
https://www.youtube.com/watch?v=VIDEO_ID
```

## 4. Verify before downloading

Open the channel. Confirm that **Downloaded** increased and **Remaining** only
contains videos that are truly missing. Then choose the download interval and
videos per run and click **Start automatic backup**.

Already downloaded videos are skipped in every later pass. If the database is
lost, restore it from backup or scan the filesystem again; the media remains the
durable archive.
