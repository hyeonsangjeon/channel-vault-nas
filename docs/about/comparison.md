# Is Channel Vault NAS for me?

There is no single best YouTube archiver. Choose the workflow you want to live
with on your NAS.

| Choose this when... | A strong place to start |
| --- | --- |
| You want a polished media server, search, playback, and a large established community | [TubeArchivist](https://github.com/tubearchivist/tubearchivist) |
| You want a focused subscription downloader with a mature, simple workflow | [Pinchflat](https://github.com/kieraneglin/pinchflat) |
| You want channel subscriptions and filesystem-oriented downloading | [TubeSync](https://github.com/meeb/tubesync) or [ytdl-sub](https://github.com/jmbannon/ytdl-sub) |
| You already have NAS folders or `archive.txt`, want to see every skip/missing decision, value disk-first recovery, and want to know when your NAS holds the last copy of a video that vanished from YouTube | **Channel Vault NAS** |

## Where Channel Vault is strongest

- importing an existing archive without deliberately re-downloading it
- making `archive.txt` decisions visible and reviewable
- **noticing when an archived video disappears from YouTube** (removed, privated,
  or taken down) and confirming your NAS holds the last copy, with an
  exportable preservation manifest
- treating the filesystem as durable data and the database as a rebuildable index
- combining channel sync, bounded automatic downloads, queue audit, and storage
  recovery in one operator console

## Preservation Watch: the part clones tend to skip

Most subscription downloaders stop caring about a video the moment it is saved.
Channel Vault keeps watching. On each sync it reconciles your saved videos
against the live channel listing, and when one you already archived disappears
upstream — removed, privated, or taken down — it is confirmed after a short grace
window and surfaced as **preserved**: your NAS now holds the last copy.

- A **Preserved** count on the dashboard and on each channel, so rescue is a
  headline number, not a buried filter.
- A **preservation manifest** export (CSV or NDJSON) of every video that only
  exists on your disk now, useful for proving provenance or seeding a mirror.
- No automatic deletion. A source disappearing is treated as a reason to keep
  your copy, never to prune it.

TubeArchivist can flag a source as deactivated, but leaves it as a filter state.
Pinchflat, TubeSync, and ytdl-sub do not track upstream disappearance at all. If
"did I just become the last copy of this?" matters to you, that question is a
first-class answer here.

## Where another tool may fit better today

- You need a mature in-app viewing experience or a very large community.
- You need cookies or authenticated/private-video acquisition. Channel Vault does
  not currently expose a supported cookies workflow.
- You want the smallest possible downloader with few operational surfaces.

Channel Vault is intentionally an archive operations console, not a replacement
for Plex/Jellyfin and not a promise to bypass source access controls. It is for
content you own or are authorized to archive.
