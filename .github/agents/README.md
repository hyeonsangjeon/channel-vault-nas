# Channel Vault NAS Agent Operating Mode

These agents should help Channel Vault NAS grow, not trap it inside an early
MVP checklist.

## Copilot CLI Mode

These profiles are intended to be used as Copilot CLI / GitHub Copilot custom
agents. Agent files use the `*.agent.md` extension for CLI compatibility.

Run unattended sessions with CLI-level permissions:

```bash
copilot --yolo
```

or:

```bash
copilot --allow-all
```

`--yolo` is a session flag, not an agent frontmatter property. It grants all
tools, paths, and URLs for the CLI session. Each agent profile also declares:

```yaml
tools: ["*"]
```

That means the selected subagent can use the full available tool surface once
the CLI session has permission to proceed.

## Model Routing

Use `claude-opus-4.8` for fast, strong day-to-day execution agents:

- `implementer`
- `frontend-developer`
- `ui-designer`
- `qa-tester`
- `git-committer`

Use `claude-opus-4.7` with 1M context and `--effort xhigh` for long-context,
high-judgment agents:

- `ai-strategy-consultant`
- `architect`
- `reviewer`
- `scout`
- `ux-researcher`

The model goes in each agent profile. The reasoning effort is a CLI session
option, so call the 1M/xhigh lane like this:

```bash
copilot --yolo --model claude-opus-4.7 --effort xhigh --agent architect \
  --prompt "Design the channel sync MVP architecture."
```

Typical direct invocation:

```bash
copilot --yolo --agent implementer --prompt "Scaffold the backend MVP slice."
```

During interactive sessions, use `/agent` to choose a profile or call one by
name in the prompt.

## Guardrails, Not Constitution

Use rules as guardrails for safety and coherence:

- protect private media
- protect filesystem paths
- protect Docker/NAS deployment expectations
- keep `youtube-dl-nas` v1 separate
- keep runtime data and secrets out of git

Do not use rules to suppress promising product ideas. If a concept is outside
the current MVP, label it instead of rejecting it.

## Three Lanes

Every agent may use these lanes:

- `Core`: needed for the current reliable archive loop.
- `Explore`: a small prototype, design spike, or research lead.
- `Vision`: a larger product bet for later.

Good agent behavior:

- "This is not Core, but it is a strong Explore candidate."
- "Build a reversible spike first."
- "Keep this as an extension point, not a full abstraction yet."
- "This idea is exciting, but it would touch auth/path safety, so prove it in a
  sandbox."

Bad agent behavior:

- "Outside MVP, therefore no."
- "Let's secretly add the future feature while touching the core."
- "Security and file safety can be relaxed for creativity."

## Creative Directions Worth Exploring

- channel timeline memory
- "new since last sync" digest
- channel health score
- storage forecast and pressure map
- policy simulator before auto-download
- subtitle keyword river
- local-first semantic search
- plugin-like source providers
- import assistant for v1 history and existing folders
- D3 channel constellation
- live queue flow visualization
- storage treemap / sunburst
- archive observatory dashboard inspired by
  https://hyeonsangjeon.github.io/gdpval-realworks/

The core loop still matters: register source, sync, detect videos, apply policy,
download, store metadata, browse library, stream media, recover from failures.
Creativity should make that loop more powerful and legible.
