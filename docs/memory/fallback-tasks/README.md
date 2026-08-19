---
tags: [convention, fallback, bd]
created: 2026-08-18
---

# Fallback task tracking (bd-unavailable only)

> Only use this folder when `bd` is not installed — see
> [[gotchas/bd-unavailable-in-claude-containers]]. Check `which bd` first.

## This is not vault knowledge

Everything else in `docs/memory/` is durable, explanatory knowledge meant to
outlive individual tasks (see [[README]]). Files in this folder are the opposite:
short-lived, actionable, and meant to be deleted or migrated into real `bd`
issues as soon as a `bd`-capable environment picks the work back up. Don't link
to a fallback-task file from a decision record or architecture note as if it
were permanent, and don't apply the "one idea per note, link liberally" vault
convention here beyond what's useful for the task itself.

## Convention

One file per task, named `YYYY-MM-DD-slug.md` (same dating convention as
`decisions/`). One file per task — not a shared list — so two agents creating
tasks concurrently never collide on the same file.

```markdown
---
status: open # open | in_progress | closed
priority: normal # low | normal | high
created: 2026-08-18
depends_on: [] # slugs of other fallback-tasks files this is blocked on
---

# Fix isValidEventId test gap

Security validator has zero dedicated tests despite being the same tier
as isValidCameraName. See docs/memory/conventions/test-quality-heuristics.md.

## Outcome

(filled in on close — what was done, or why it was closed without action)
```

## Working the queue (grep instead of `bd` commands)

| `bd` command             | Fallback equivalent                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bd ready`               | `grep -rL "^status: open" docs/memory/fallback-tasks/*.md` won't work as a negative match — use: `grep -l "^status: open" docs/memory/fallback-tasks/*.md`, then manually skip any with an unmet `depends_on` |
| `bd show <id>`           | `cat docs/memory/fallback-tasks/<slug>.md`                                                                                                                                                                    |
| `bd update <id> --claim` | Edit the file's frontmatter: `status: open` → `status: in_progress`                                                                                                                                           |
| `bd close <id>`          | Edit frontmatter to `status: closed`, fill in `## Outcome`                                                                                                                                                    |

## Migrating back to `bd`

Once a session in this repo finds `bd` actually installed (`which bd` resolves):

1. For each file with `status: open` or `in_progress`, `bd create` an equivalent
   issue with the same title/body (check `bd prime` for the exact flags — don't
   assume a bulk-import path exists without checking).
2. Delete the fallback file (or move it to `docs/memory/fallback-tasks/archive/`
   if you want a paper trail of what was migrated).
3. If the folder is empty afterward, it can stay empty — it's git-tracked via
   this README regardless.

## Known limitations vs. real `bd`

No atomic claim (two agents editing the same file's frontmatter at the same
moment can race), no enforced dependency graph beyond whatever reads
`depends_on`, and no `bd ready`-style query beyond a grep. Fine for a solo-ish,
mostly-sequential workflow; not a substitute for `bd`'s concurrency guarantees
under real parallel agent use.

## Related

- [[gotchas/bd-unavailable-in-claude-containers]]
- [[Home]]
