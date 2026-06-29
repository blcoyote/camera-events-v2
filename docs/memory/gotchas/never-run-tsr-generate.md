---
tags: [gotcha, tooling, destructive]
created: 2026-06-29
---

# ⚠️ Never run `npx tsr generate`

> It is **not** the TanStack Router generator. It deletes files.

## What bites

`tsr` (the npm package) is an unrelated **unused-code removal** tool. Running it —
especially `tsr --write` — will **delete** test files and `vite.config.ts`. It is
destructive and irreversible without git.

## What to do instead

Route tree generation (`src/routeTree.gen.ts`) is handled automatically by the
`tanstackStart()` Vite plugin during `bun run dev` and `bun run build`. There is
**no separate CLI step**. To regenerate after adding a route file under
`src/routes/`, just start `bun run dev`.

## Related

- [[Home]]
