---
tags: [gotcha, tooling, bd, claude-code]
created: 2026-08-18
---

# ⚠️ `bd` (beads) isn't installed in Claude Code remote/cloud containers

> `which bd` → not found. Confirmed on a Claude Code web/cloud session container.

## What bites

CLAUDE.md mandates `bd` for all issue tracking ("Use `bd` for ALL task tracking —
do NOT use TodoWrite, TaskCreate, or markdown TODO lists"). That's fine on a
machine where `bd` is actually installed, but on a Claude Code **remote execution
container** (claude.ai/code web sessions, GitHub Action runs, etc.) there is no
`bd` binary at all — not a PATH issue, not a missing repo init, just absent from
the image. Any session running in that environment cannot follow the mandated
workflow as written, and there's no local Dolt DB to sync even if the binary
existed unless the container also has the right git remote access.

## What to do instead

Check first: `which bd`. If it resolves, use it normally per `bd prime`. If it
doesn't, fall back to [[fallback-tasks/README]] — a plain-markdown, one-file-
per-task convention under `docs/memory/fallback-tasks/` designed to be cheaply
migrated into real `bd` issues once a `bd`-capable environment picks the work
back up. Do not silently switch to `TodoWrite`/`TaskCreate` instead — those are
this-session-only and the whole point of `bd` is that work survives the session.

## Why it matters

Without this note, every bd-less session either silently violates CLAUDE.md's
tracking rule or loses track of follow-up work the moment the container is
reclaimed. This isn't a one-off: any Claude Code web/cloud session for this repo
will hit it.

## Related

- [[fallback-tasks/README]]
- [[Home]]
