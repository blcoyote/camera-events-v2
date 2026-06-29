---
tags: [decision, tooling, meta]
created: 2026-06-29
---

# Adopt an Obsidian vault for long-term project memory

> Use `docs/memory/` as an Obsidian vault for durable knowledge, alongside `bd`
> for issue tracking.

## Context

The project tracks issues with `bd` (beads), which is great for actionable,
short-lived work items but not for durable, explanatory knowledge — the _why_
behind decisions, architecture rationale, and platform gotchas. We wanted a
linkable, browsable home for that knowledge that survives across work sessions.

## Decision

- Create an Obsidian vault rooted at `docs/memory/`.
- **Notes are committed** to git (shared team knowledge); the per-user
  `.obsidian/` config folder is **gitignored**.
- Division of labor: `bd` for issues, this vault for durable knowledge. See
  [[README]].

## Alternatives considered

- **Repo root as the vault** — rejected: every `.md` in the repo (CLAUDE.md,
  specs, plans) would clutter the Obsidian graph.
- **Fully gitignored / personal vault** — rejected: the knowledge should be
  shared with the team.
- **Commit the `.obsidian` config too** — rejected: `workspace.json` churns on
  every UI interaction and is per-user.

## Why it matters

Without a designated home, durable insight evaporates at the end of each session
or gets buried in closed bd issues. This vault is the agreed place to write it
down.

## Related

- [[README]]
- [[Home]]
