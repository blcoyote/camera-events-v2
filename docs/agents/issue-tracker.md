# Issue tracker: Beads (`bd`)

Issues and specs for this repo live in beads, a local Dolt-backed tracker. Use the `bd` CLI for all operations. Do not use GitHub Issues, TodoWrite, or markdown TODO lists.

## Conventions

- **Create an issue**: `bd create --title="..." --description="..." --type=task|bug|feature --priority=2`. Priority is 0-4 (0 = critical, 4 = backlog), not words. Add `--parent=<id>` for a child and `-l label1,label2` for labels.
- **Read an issue**: `bd show <id>`
- **List issues**: `bd list --status=open --json`, filtered with `--label <l>`, `--label-any`, or `--exclude-label`. `bd ready` lists issues with no open blockers.
- **Comment on an issue**: `bd comment <id> "..."`
- **Apply / remove labels**: `bd label add <id> <label>` / `bd label remove <id> <label>`
- **Claim**: `bd update <id> --claim`
- **Close**: `bd close <id> --reason="..."`
- **Update fields**: `bd update <id> --title/--description/--notes/--design`

**Never use `bd edit`**: it opens `$EDITOR` and blocks the agent.

Run `bd prime` for full workflow context.

## When a skill says "publish to the issue tracker"

Run `bd create`.

## When a skill says "fetch the relevant ticket"

Run `bd show <id>`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single epic with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `bd create --type=epic -l wayfinder:map ...`.
- **Child ticket**: `bd create --parent=<map> -l wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: `bd dep add <blocked> <blocker>`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: `bd ready`, scoped to the map's children and excluding any that are assigned. First in map order wins.
- **Claim**: `bd update <id> --claim`, the session's first write.
- **Resolve**: `bd comment <id> "<answer>"`, then `bd close <id>`, then append a context pointer to the map's Decisions-so-far.
