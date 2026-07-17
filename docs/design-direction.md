# Channel Vault NAS Design Direction

Updated: 2026-07-16

## North Star

Channel Vault NAS should feel like a small, dependable backup app that happens
to run on a NAS. A first-time user should be able to register a channel, start a
schedule, and understand the result without learning how the service works
internally.

The default experience is light, calm, and task-led. It is not an operations
cockpit and it does not ask a general user to interpret infrastructure before
their first backup.

The first screen should answer three questions:

1. Which channel am I backing up?
2. Is automatic backup on, and when will it run next?
3. Does anything need my attention?

Everything else is secondary.

## Product Promise

The primary flow has three steps and uses the same words everywhere in the app
and manual:

1. Paste a channel URL, select **Check channel**, then **Register channel**.
2. Choose **All-channel check interval** and **Per run**, then select
   **Start automatic backup**.
3. Read one plain-language status: **Automatic backup is on**,
   **Automatic backup is running**, **Automatic backup is paused**, or
   **Needs attention**.

Each step should have one obvious primary action. A user should never need to
open a separate control room to finish this flow.

## Default Mode

Default mode is designed for people who want reliable backups, not a monitoring
dashboard.

- Use a light neutral canvas, generous whitespace, familiar form controls, and
  one restrained blue or green accent.
- Put the current channel, backup status, next check, and remaining-video count
  in the first viewport.
- Prefer a single open layout over grids of nested cards.
- Use short, direct labels: **Register channel**, **Start automatic backup**,
  **Pause**, and **Saved videos**.
- Explain consequences next to the action. For example, checking and registration
  do not download files; starting automatic backup does.
- Show only information that helps the user choose or confirm the next action.
- Use progressive disclosure for optional quality and subtitle choices.
- Keep destructive or uncommon actions away from the primary button.

The empty state should immediately show the channel URL field. The active state
should immediately show the schedule and current result. The completed state
should feel reassuring rather than empty.

## Status Language

Default mode uses four user-facing states:

| Status | Meaning | User guidance |
| --- | --- | --- |
| **Automatic backup is on** | The channel is waiting for the next check. | Show the next check time. |
| **Automatic backup is running** | Videos are being checked or saved now. | Show simple progress without internal stages. |
| **Automatic backup is paused** | No new scheduled pass will start for this channel. | Offer **Start automatic backup** to resume. |
| **Needs attention** | The app could not continue safely. | State the problem in plain language and offer one recovery action. |

Completion is shown by the channel heading and remaining count, not as a
conflicting scheduler state. When no videos remain, say that every discovered
video is backed up while still showing whether automatic backup is on or paused.

Color supports the label but never replaces it. Avoid exposing internal state
names when a plain-language status is available.

## Progressive Disclosure

Advanced operator tools remain available, but they must not compete with the
default path.

- Put detailed job history, logs, per-channel policy, storage analysis, runtime
  controls, import tools, and diagnostic exports under **Advanced management**.
- Keep **Advanced management** collapsed by default and out of first-run
  guidance.
- Preserve a direct URL for experienced operators and support staff.
- Returning from an advanced screen should restore the selected channel and
  default-mode context.
- An advanced warning may surface in default mode only when the user must act;
  translate it into a plain-language **Needs attention** message.

Progressive disclosure is a hierarchy, not removal: the product stays capable
without making every user carry its full operational complexity.

## Screen Direction

### Home

- Empty workspace: channel URL field, **Check channel**, and a short safety note.
- Registered workspace: channel name, four-state backup status, remaining count,
  next check, schedule summary, and the most relevant action.
- Secondary actions: **Register channel**, **Saved videos**, and collapsed
  **Advanced management**.

### Channel registration

- One focused form: URL / `@handle` / channel ID.
- **Check channel** confirms the channel identity before registration.
- Optional download choices stay collapsed until requested.
- Validation errors explain what to correct beside the field.

### Automatic backup

- Keep interval and per-run count beside one primary start button.
- After start, replace setup language with status, next check, and **Pause**.
- Schedule edits should be reversible and should not silently start a download.

### Saved videos

- Lead with recognizable thumbnails, titles, channel, and saved date.
- Put codec, file integrity, and sidecar metadata in secondary details.

### Advanced management

- Retain dense operational information for users who explicitly open it.
- Charts and diagnostic visualizations belong here when they help investigation.
- Do not reuse the advanced visual density as the default app shell.

## Visual System

- Light-first neutral background with clear surface separation.
- High-contrast body text and quiet secondary text.
- Blue or green for the primary action; amber and red only for actionable
  attention states.
- Rounded controls and surfaces may be used sparingly; avoid a dashboard made of
  identical floating cards.
- Use normal UI typography for tasks and reserve monospace for paths, IDs, or
  copyable technical values inside advanced management.
- Avoid neon borders, decorative grids, translucent cockpit panels, status-chip
  walls, and motion that does not explain a state change.

Dark mode may remain an optional preference, but it must follow the same simple
information hierarchy.

## Interaction And Accessibility

- Keyboard focus, labels, validation, and screen-reader names are required for
  every primary control.
- Critical information must be visible without hover.
- Loading states keep the action and expected result clear.
- Motion should be short and functional: registration confirmed, backup started,
  status changed.
- Mobile keeps the same three-step order and primary labels. Do not move a
  required action into an icon-only menu.
- Use readable target sizes and do not rely on color alone for status.

## Manual And Screenshot Standard

The user manual follows the product's three-step flow. Every screenshot should
show the exact control named by the adjacent instruction, and every caption
should tell the reader what to confirm after clicking.

- Use one screenshot per decision, not one screenshot per internal subsystem.
- Keep the pointer or focus near the relevant field or button when practical.
- Match English and Korean control names exactly.
- Retake screenshots when a primary label or hierarchy changes.
- Keep video guides as supplemental material; the written guide must stand on
  its own.

## Default-Mode Release Bar

A default-mode release is ready when a new user can:

- register a channel without documentation;
- start automatic backup from the same guided path;
- identify automatic-backup on, running, paused, and Needs attention states;
- recover from a common input or download error using the offered action;
- complete the same flow on desktop and mobile;
- reach advanced management without it appearing in the first-run path.

Polish is measured by confidence and task completion, not by dashboard density.
