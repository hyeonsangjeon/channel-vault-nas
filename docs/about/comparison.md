# Is Channel Vault NAS for me?

There is no single best YouTube archiver. Choose the workflow you want to live
with on your NAS.

| Choose this when... | A strong place to start |
| --- | --- |
| You want a polished media server, search, playback, and a large established community | [TubeArchivist](https://github.com/tubearchivist/tubearchivist) |
| You want a focused subscription downloader with a mature, simple workflow | [Pinchflat](https://github.com/kieraneglin/pinchflat) |
| You want channel subscriptions and filesystem-oriented downloading | [TubeSync](https://github.com/meeb/tubesync) or [ytdl-sub](https://github.com/jmbannon/ytdl-sub) |
| You already have NAS folders or `archive.txt`, want to inspect skip/missing decisions, value disk-first recovery, and want to track archived videos absent from the channel listing | **Channel Vault NAS** |

## Where Channel Vault is strongest

- importing an existing archive without deliberately re-downloading it
- making `archive.txt` decisions visible and reviewable
- **tracking archived videos absent from the channel listing**, with local
  preservation counts and an exportable manifest
- treating the filesystem as durable data and the database as a rebuildable index
- combining channel sync, bounded automatic downloads, queue audit, and storage
  recovery in one operator console

## Preservation Watch: keep checking after the download

On each sync, Channel Vault compares known videos with the returned channel
listing. An absent video can be marked removed once the last recorded source
sighting is old enough (24 hours by default). With a local archived-media record,
it appears as **preserved**. This does not establish why it is absent or prove
that no other copies exist.

- A **Preserved** count on the dashboard and on each channel, so rescue is a
  headline number, not a buried filter.
- A **preservation manifest** export (CSV or NDJSON) of recorded source absence
  and local preservation status, useful for reviewing your archive.
- No automatic deletion. A source disappearing is treated as a reason to keep
  your copy, never to prune it.

The default probe covers up to 500 uploads. Empty results and older videos
outside a truncated listing's covered window are not treated as removals. The
24-hour threshold is measured from the last sighting, not from the first absent
sync, so it is not proof of continuous absence. See the
[runtime limits](../reference/runtime-flags.md#preservation-watch-limits).

Other projects evolve; compare their current documentation rather than treating
this page as an exhaustive feature matrix. Channel Vault's focus is making
source changes and local archive recovery visible in the same workflow.

## Where another tool may fit better today

- You need a mature in-app viewing experience or a very large community.
- You need cookies or authenticated/private-video acquisition. Channel Vault does
  not currently expose a supported cookies workflow.
- You want the smallest possible downloader with few operational surfaces.

Channel Vault is intentionally an archive operations console, not a replacement
for Plex/Jellyfin and not a promise to bypass source access controls. It is for
content you own or are authorized to archive.
