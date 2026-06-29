# Camera Events v2 — Memory Vault

This folder is an **Obsidian vault** used as the long-term, durable memory for the
Camera Events v2 project. Open this folder (`docs/memory/`) directly in Obsidian.

It is for knowledge that should outlive a single work session: architectural
decisions, the _why_ behind non-obvious code, gotchas, platform quirks, and
context that isn't already captured in the code, git history, or `CLAUDE.md`.

## How this relates to `bd` (beads)

| Tool                    | Use for                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **bd (beads)**          | Issue tracking — tasks, bugs, ready work, status. Short-lived, actionable.                         |
| **This Obsidian vault** | Durable knowledge — decisions, architecture rationale, gotchas, glossary. Long-lived, explanatory. |

A bd issue says _"fix the iOS push race"_. A vault note says _"why iOS standalone
PWAs drop the session cookie and how we work around it"_. The issue closes; the
note stays.

## Structure

```
docs/memory/
  Home.md            ← start here: map of content (MOC) / dashboard
  README.md          ← this file: purpose & conventions
  templates/         ← note templates (used by the Templates core plugin)
  architecture/      ← how the system fits together and why
  decisions/         ← dated decision records (ADR-style)
  gotchas/           ← platform quirks, footguns, "don't do X because Y"
  glossary.md        ← domain & project terms
```

## Conventions

- **One idea per note.** Small, atomic notes link better than long documents.
- **Link liberally** with `[[wikilinks]]`. A link to a note that doesn't exist yet
  is fine — it marks something worth writing later.
- **Use frontmatter** (`tags`, `created`) — see [[templates/memory-note]].
- **Date decision records** as `YYYY-MM-DD-slug.md` in `decisions/`.
- **Don't duplicate the code or `CLAUDE.md`.** Capture what's _non-obvious_ — the
  reasoning, the trade-off, the thing that bit us.
- The `.obsidian/` config folder is **gitignored** (per-user UI state). The notes
  themselves are committed and shared with the team.

## Maintaining this vault

When you (or Claude) learn something durable about this project, add a note here
rather than letting it evaporate at the end of the session. Start from
[[Home]] to find the right place.
