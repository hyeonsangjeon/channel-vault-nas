# Usage

Channel Vault NAS has one archive path, from source to verified media:

```mermaid
flowchart LR
  A[Register a channel] --> B[Preview and Register]
  B --> C[Review remaining videos]
  C --> D[Register the automatic download schedule]
  D --> E[Verify in Library]
```

<figure markdown="span">
  ![Dashboard: today's archive status](../assets/user-manual/en/01-dashboard-cockpit.png){ loading=lazy }
  <figcaption>The Dashboard is a read-only overview: archive score, the next useful action, and worker/storage/library state. Deep controls live on the Channels tab.</figcaption>
</figure>

## Start here

<div class="grid cards" markdown>

-   :material-play-box:{ .lg .middle } __First backup__

    ---

    The click-by-click walkthrough: paste a channel, preview it, register it,
    then register the automatic download schedule that archives the remaining
    videos for you.

    [:octicons-arrow-right-24: First backup](first-backup.md)

-   :material-download-lock:{ .lg .middle } __Enable real downloads__

    ---

    The app is safe by default. Starting the schedule enables real downloads;
    an advanced manual one-pass test is there when you want to check a single
    batch first.

    [:octicons-arrow-right-24: Enable downloads](enable-downloads.md)

-   :material-view-dashboard:{ .lg .middle } __Product tour__

    ---

    Reference for every screen: Dashboard, Channels, Queue, Library, Insights,
    and Settings.

    [:octicons-arrow-right-24: Product tour](product-tour.md)

-   :material-file-import:{ .lg .middle } __archive.txt import__

    ---

    Already have a `youtube-dl` ledger? Import it and stage only the videos you
    still need.

    [:octicons-arrow-right-24: archive.txt import](archive-txt.md)

</div>

## The navigation map

| Tab | What it's for |
| --- | --- |
| **Dashboard** | Archive overview and the next useful action. No deep controls. |
| **Channels** | The start point: register a channel (Preview → Register channel), review remaining videos, and register the automatic download schedule. |
| **Queue** | Every candidate, queued, running, completed, failed, and cancelled job. Stale failures for already-archived videos are hidden from current work. |
| **Library** | Archived and missing videos together, with codec/sidecar/path integrity. |
| **Insights** | Storage pressure, folder structure, drift, orphan sidecars — read from the real archive root. |
| **Settings** | Runtime console: worker/scheduler flags, binary paths, restart adapters, audit. |

!!! tip "Try it without touching YouTube"
    Expand the secondary **Safe demo and advanced import options** panel on the
    Dashboard to load a deterministic `Signal Lab` fixture — no external calls, no
    downloads. Great for a first look. See
    [First backup → Safe demo](first-backup.md#optional-explore-with-the-safe-demo).
