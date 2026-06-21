# Channel Vault NAS Design Direction

작성일: 2026-05-30

## North Star

Channel Vault NAS should feel like a beautiful archive console for a NAS:
dense enough for daily operation, visual enough that the state of the archive is
understood at a glance.

This is not a plain admin panel. The UI should be genuinely polished, dynamic,
and memorable while staying useful for repeated NAS management.

## Visual Reference

Reference:

- https://hyeonsangjeon.github.io/gdpval-realworks/
- Local source reference: `/Users/hyeonsang/git/gdpval-realworks`

Useful patterns from that dashboard:

- dark-first dashboard tokens
- compact sticky header
- translucent surfaces with subtle blur
- KPI cards with thin accent bars
- mono typography for numbers and operational metrics
- color-coded tabs and animated active underline
- compact data tables with hover states
- chart tooltips tuned for dark mode
- Framer Motion fade/slide entrance and subtle hover lift

Channel Vault should borrow the polish, not the exact product layout.

## Visual Personality

Keywords:

- cinematic operations room
- archive console
- calm NAS operations
- luminous data surfaces
- beautiful but not decorative
- dense, legible, alive

The interface should make the user feel:

- "I know what changed."
- "I trust this archive."
- "Failures are visible and fixable."
- "Storage and channel health are tangible."
- "This is my private media command center."

## Creator And Fan Questions

The first screen should answer the questions that YouTubers, channel operators,
and serious fans will ask before they care about queue mechanics:

- How many videos exist on this channel or playlist?
- How many are already mirrored locally, and what is still missing?
- When was the latest upload, and what day or time does this channel usually
  publish?
- Where exactly are the downloaded media, subtitles, thumbnails, and metadata
  stored on the NAS?
- Is the folder naming structure predictable enough to trust outside the app?
- If I lose access to YouTube tomorrow, how complete is my private copy?

This means dashboard real estate should favor archive coverage, upload cadence,
last upload, expected next upload, and folder structure before secondary
operational detail.

## Data Visualization Direction

Dynamic visualizations are first-class UI, not an afterthought.

Good candidates for D3.js:

- Channel constellation: channels as nodes sized by archive volume, colored by
  health, with edges for shared keywords or playlists.
- Sync timeline: new videos, failed syncs, policy changes, and completed
  downloads on a horizontal time axis.
- Storage pressure map: treemap or sunburst showing storage by channel,
  playlist, quality, and age.
- Subtitle keyword river: animated stream graph showing topic changes across a
  channel timeline.
- Queue flow: live Sankey-style flow from discovered video to metadata,
  thumbnail, subtitle, download, media file, and library availability.
- Policy simulator: forecast how much storage a channel will consume under
  different quality/subtitle/retention settings.

Good candidates for Recharts or similar React chart libraries:

- upload cadence line chart
- video length distribution
- success/failure trend
- storage growth trend
- download throughput
- channel health score history

Use the simplest library that fits the visualization:

- Recharts for standard charts.
- D3.js for custom, expressive, or highly interactive visuals.
- SVG for crisp operational diagrams.
- Canvas/WebGL only when data volume demands it.

## Screen Concepts

`Dashboard`

- Above the fold: archive health, new videos, active sync, failed jobs, storage
  pressure, recent completions.
- Visual centerpiece: live sync/download flow or channel health matrix.

`Channels`

- Dense list with status badges, sync age, policy, new count, archived count,
  storage, failures.
- Optional Explore view: channel constellation or health board.

`Channel Detail`

- Timeline is the hero: uploads, discovered videos, archived files, subtitles,
  failures, and policy changes.
- Include upload cadence, duration distribution, keyword/subtitle flow, and
  storage trend.

`Library`

- Searchable media table plus rich preview pane.
- Filters should feel fast: channel, date, status, quality, subtitle language,
  archived/missing.

`Queue`

- Live lanes for sync, metadata, subtitle, thumbnail, download, postprocess.
- Failed jobs should look actionable, not buried.

`Insights`

- This can become the visual playground after the MVP loop works.
- It should eventually feel like an observability dashboard for a private media
  archive.

## Interaction Principles

- Motion should explain state changes: discovered, queued, downloading,
  completed, failed, retried.
- Hover states can reveal detail, but critical state must be visible without
  hover.
- Realtime updates should feel alive but not noisy.
- Prefer animated transitions between filtered states over abrupt redraws.
- Use skeletons and shimmer carefully for loading, especially in charts.
- Keep keyboard and screen-reader basics intact even for beautiful visuals.

## Palette And Surface

Start from a dark-first operational palette:

- near-black page background
- slightly lifted card/surface layer
- thin low-contrast borders
- high-contrast text
- muted secondary text
- saturated accent colors only for meaningful status/data

Possible semantic accents:

- sync / discovery: blue or cyan
- completed / healthy: emerald
- warning / backlog: amber
- failed / blocked: red
- subtitles / metadata: violet
- storage pressure: magenta or orange

Avoid a single-hue dashboard. The interface should have a rich but disciplined
data palette.

## Implementation Notes

Initial frontend stack can include:

- React + Vite
- Tailwind CSS or CSS variables for design tokens
- lucide-react for icons
- Framer Motion for measured UI motion
- Recharts for standard charts
- D3.js for custom visualizations

If a visualization needs D3, use it proudly. Do not force standard chart
libraries to do custom work badly.

## MVP Visual Bar

Even the first MVP should not look like a placeholder.

Minimum bar:

- polished dark dashboard shell
- beautiful KPI/status metrics
- at least one meaningful dynamic visualization
- high-quality empty/error/loading states
- realtime progress that feels designed
- compact tables that look intentional

The app can be technically early and still feel visually serious.
