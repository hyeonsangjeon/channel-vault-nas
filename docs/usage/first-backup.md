# Your first channel backup

This is the click-by-click walkthrough from an empty workspace to a verified,
self-updating archive. It matches the [5-minute video guide](../index.md#watch-the-5-minute-guide).

!!! info "Sample channel"
    The screenshots register a real channel handle
    (`https://www.youtube.com/@wingnut987s4`). Substitute any channel you own —
    Channel Vault NAS is for archiving **your own** channels.

---

## Step 1 — Open the console

Open **`http://127.0.0.1:5173/`**. The Dashboard is a read-only overview: it
shows your archive score and the next useful action, then points you to the
**Channels** tab to do the work.

<figure markdown="span">
  ![Dashboard first-run overview](../assets/user-manual/en/01-dashboard-cockpit.png){ loading=lazy }
  <figcaption>Dashboard — archive score, the next useful action, and worker / storage / library state at a glance. No deep controls here; the Channels tab is where you register and archive.</figcaption>
</figure>

!!! note "What to click"
    Open **Channels** in the left sidebar. The top **Channel management** card is
    an informational summary of the current channel — the buttons you actually
    click are in the **Channel registration** panel and the **Channel detail**
    below it.

---

## Step 2 — Register the channel

In the **Channel registration** panel, paste the channel URL, an `@handle`, or a
`UC…` channel ID, choose a quality (`720p` / `1080p` / `best`), toggle
**Subtitles** / **Audio only** as needed, then click **Preview** to inspect the
source before anything is saved. Review the preview, then click **Register
channel** to add it to the vault.

<figure markdown="span">
  ![Channel management and registration](../assets/user-manual/en/03-download-launch-control.png){ loading=lazy }
  <figcaption>Channels — the Channel management card (Channel admin, Add another channel) is informational; registration is the paste → Preview → Register channel flow, and the channel detail below drives the backup.</figcaption>
</figure>

!!! note "What to click"
    1. Paste the channel URL / `@handle` / `UC…` ID.
    2. Pick **1080p** (or your preferred quality) and enable **Subtitles**.
    3. Click **Preview** to inspect the source.
    4. Click **Register channel** to save it. Use **Add another channel** later to
       register more without losing the current one.

---

## Step 3 — Review the remaining videos

Open the registered channel. The **Channel backup** guide leads with
**"Archive the remaining videos automatically"** and three counts — **Total
videos**, **Downloaded**, and **Remaining** — so you always know how much work
is left.

!!! note "What to check"
    - **Total / Downloaded / Remaining** — how many videos still need archiving.
    - **Save folder** — where media will land (see
      [Filesystem contract](../reference/filesystem.md)).
    - Click **Check again** any time to refresh the source and archive state.

!!! success "Already fully archived?"
    If everything is saved, the guide reads **"This channel is fully archived"**
    — that is a **completed** state, not a failure. The schedule simply has no
    remaining work; check again when the channel publishes new videos.

---

## Step 4 — Start the automatic download schedule

This is the main backup flow. Click **Configure automatic downloads** to open the
**Automatic download schedule**, then choose:

- **Run every N minutes** — how often the scheduler wakes up.
- **Downloads per pass** — how many videos each pass claims.

Click **Start schedule** to begin. Starting the schedule automatically enables
real downloads and the scheduler, and it queues **only the remaining videos** at
the interval you chose — already-downloaded videos are skipped. Prefer to set it
up without starting yet? Use **Save only**, and **Stop schedule** halts future
passes.

<figure markdown="span">
  ![Automatic download schedule](../assets/user-manual/en/04-download-confirm-modal.png){ loading=lazy }
  <figcaption>Automatic download schedule — interval and batch size, live status (On / Off / Running), next run, and Total / Downloaded / Remaining counts. Hover the info (i) hint for a plain-language explanation.</figcaption>
</figure>

!!! warning "Safe by default"
    Nothing transfers until you start the schedule (or run the advanced manual
    test below). Registering and previewing never download anything. See
    [Enable real downloads](enable-downloads.md).

---

## Step 5 — Watch the queue

Open the **Queue** tab to watch progress, failures, retries, and the worker audit
detail. It shows the current **Visible jobs** across every channel; past failures
for videos that are already archived are hidden so you see only real, current
work.

<figure markdown="span">
  ![Global queue control](../assets/user-manual/en/05-queue-console.png){ loading=lazy }
  <figcaption>Queue — counters, filters, and per-job cards, with the Worker control room on the right. When the schedule is running the worker reads “armed” and jobs move to Running.</figcaption>
</figure>

Once the worker is armed, jobs move to **Running** and progress bars fill to 100%.

---

## Step 6 — Verify the library

Open the **Library** tab. Archived and missing videos are shown together, indexed
against the real files on disk — codec/profile, thumbnails, subtitles, queue
state, and path integrity.

<figure markdown="span">
  ![Library coverage](../assets/user-manual/en/06-library-coverage.png){ loading=lazy }
  <figcaption>Library — archived and missing videos in one view, disk-aware so stale DB rows show as missing media instead of pretending the file is still on the NAS.</figcaption>
</figure>

!!! success "Done"
    You've registered a channel, reviewed the remaining videos, and started the
    automatic download schedule that keeps the archive current. Next: explore
    [Insights](product-tour.md#insights) and lock down
    [Settings](product-tour.md#settings).

---

## Advanced — run a manual one-pass test

Under **Advanced actions** you can run a **Manual one-pass test** — **Run up to 5
now only**. It is separate from the schedule: this pass starts up to your
configured batch size immediately, which is handy for verifying one batch before
you rely on the schedule. Real transfers still stop at a confirmation modal.

!!! note "What to click"
    Open **Advanced actions → Manual one-pass test**, review the confirmation
    modal (**Max this pass**, **Already downloaded skipped**, **Queued**), and
    confirm to launch a single guarded pass. It only runs if you have
    [enabled real downloads](enable-downloads.md) or start it from here.

---

## Optional — explore with the Safe demo

To walk through everything **without calling YouTube**, expand the secondary
**Safe demo and advanced import options** panel on the Dashboard and load the
`Signal Lab` fixture. It seeds a channel, one archived item, missing-video
candidates, queue history, scheduler ticks, library sidecars, storage drift, and
orphan sidecars.

!!! note "Demo safety"
    The demo path does **not** call YouTube and does **not** start downloads. If
    the workspace already has real registered channels, the backend refuses to
    seed the demo so real archives are never mixed with fixture data. A demo
    banner and a one-click removal action keep it isolated.
