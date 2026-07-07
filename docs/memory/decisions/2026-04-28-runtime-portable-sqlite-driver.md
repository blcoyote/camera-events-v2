---
tags: [decision, sqlite, runtime, testing]
created: 2026-04-28
---

# SQLite access goes through a runtime-branching driver, not a Bun-only one

> `openSqlite(path)` picks `better-sqlite3` on Node and `bun:sqlite` on Bun
> behind one shared interface — not a Bun-only swap.

## Context

Production runs on Bun (`nitro({ preset: 'bun' })`, started via
`bun run .output/server`). `better-sqlite3` is a native N-API addon that
crashes on Bun (oven-sh/bun#4290), so the original push-store crashed on the
first call to `/api/push/subscribe`. The fix needed a driver that works in
production (Bun) — but the test suite (`bun run test`, i.e. Vitest) runs on
Node, and Node cannot import the Bun-only built-in `bun:sqlite`.

## Decision

`src/features/shared/server/sqlite/index.ts` exports a single
`openSqlite(path): Promise<SqliteDatabase>`. It branches at runtime on
`process.versions.bun`:

- **Node** (Vitest) → `better-sqlite3`
- **Bun** (production) → `bun:sqlite`, lazily dynamic-imported (`bun:sqlite`
  can't be statically resolved under Node)

Both branches return the same `SqliteDatabase` shape — `prepare`, `exec`,
`pragmaRead`, `pragmaWrite`, `close` — so `push-store.ts` and any future
SQLite consumer never see which driver is underneath.

The database lives at `data/camera-events.db` and is opened in WAL mode
(`db.pragmaWrite('journal_mode = WAL')` in `push-store.ts`).

`better-sqlite3` and `@types/better-sqlite3` are `devDependencies` only
(`package.json`) — they exist for the Node/Vitest test run and are never
bundled into the production Bun image.

Test coverage mirrors the two branches plus the seam between them:

- `sqlite.test.ts` — Node branch, real `better-sqlite3`
- `sqlite.bun-branch.test.ts` — mocks `bun:sqlite` and fakes
  `process.versions.bun` so the Bun branch is exercised under Node/CI
- `sqlite.bun-runtime.test.ts` — real `bun:sqlite`, gated by
  `it.skipIf(!process.versions.bun)`, only runs under `bun test`
- `push-store.driver-contract.test.ts` — asserts `PushStore`'s full public
  API behaves identically regardless of which driver is loaded

## Deviation from the plan

`plans/bun-sqlite-push-store.md` scoped this as a **Bun-only** swap: "use
Bun's built-in `bun:sqlite` when running on Bun (production) and continues to
use `better-sqlite3` everywhere else." That's already dual-runtime in intent,
but the plan's title and framing ("bun-sqlite-push-store") read as if
`bun:sqlite` were the destination and `better-sqlite3` merely tolerated
elsewhere.

The shipped code is unambiguously a **runtime-portable driver**: neither
branch is primary, `openSqlite` doesn't prefer one over the other, and the
module's own doc comment frames it as "Node uses `better-sqlite3`, Bun uses
the built-in `bun:sqlite`" with no hierarchy. This is the correct shape
because Vitest — the project's only test runner — executes under Node and has
no path to `bun:sqlite` at all. A "Bun-only" driver would leave the test
suite with nothing to run against; the dual-runtime abstraction is what makes
the Node-side tests (`sqlite.test.ts`, `push-store.test.ts`, the
driver-contract test) possible in the first place, not an accidental
side effect of the Bun fix.

## Why it matters

This is why `push-store.ts` and its tests never branch on runtime themselves
— the branching is centralized once, in `openSqlite`, and every caller just
gets a `SqliteDatabase`. It's also why `better-sqlite3` can stay a
devDependency instead of shipping a native addon Bun can't load into
production.

Operator footgun to remember: WAL/SHM file ownership differs between the two
drivers. Never run a Node dev server and a Bun production server
concurrently against the same `data/camera-events.db` file.

## Related

- [[Home]]
