# Is Channel Vault NAS for me?

There is no single best YouTube archiver. Choose the workflow you want to live
with on your NAS.

| Choose this when... | A strong place to start |
| --- | --- |
| You want a polished media server, search, playback, and a large established community | [TubeArchivist](https://github.com/tubearchivist/tubearchivist) |
| You want a focused subscription downloader with a mature, simple workflow | [Pinchflat](https://github.com/kieraneglin/pinchflat) |
| You want channel subscriptions and filesystem-oriented downloading | [TubeSync](https://github.com/meeb/tubesync) or [ytdl-sub](https://github.com/jmbannon/ytdl-sub) |
| You already have NAS folders or `archive.txt`, want to see every skip/missing decision, and value disk-first recovery | **Channel Vault NAS** |

## Where Channel Vault is strongest

- importing an existing archive without deliberately re-downloading it
- making `archive.txt` decisions visible and reviewable
- treating the filesystem as durable data and the database as a rebuildable index
- combining channel sync, bounded automatic downloads, queue audit, and storage
  recovery in one operator console

## Where another tool may fit better today

- You need a mature in-app viewing experience or a very large community.
- You need cookies or authenticated/private-video acquisition. Channel Vault does
  not currently expose a supported cookies workflow.
- You want the smallest possible downloader with few operational surfaces.

Channel Vault is intentionally an archive operations console, not a replacement
for Plex/Jellyfin and not a promise to bypass source access controls. It is for
content you own or are authorized to archive.
