# Plan: Fix push-store crash on Bun by abstracting the SQLite driver

**Created**: 2026-04-28
**Branch**: main
**Status**: draft

## Goal

Restore the "Enable Notifications" flow in production. The server is built with the `nitro({ preset: 'bun' })` adapter and started via `bun run .output/server`, but `src/features/push-notifications/server/push-store.ts` imports `better-sqlite3`, a native N-API addon that Bun does not yet support (oven-sh/bun#4290). The first request that hits `/api/push/subscribe` (or any other push endpoint) calls `getPushStore()`, which throws inside `new Database(...)`, which surfaces to the client as a 500 and the toast: _"Could not enable notifications (500: 'better-sqlite3' is not yet supported in Bun…)"_.

The fix is a thin SQLite driver abstraction that uses Bun's built-in `bun:sqlite` when running on Bun (production) and continues to use `better-sqlite3` everywhere else (Node-based `vitest`, dev-time tooling). The two drivers expose nearly identical synchronous APIs, so we can wrap them behind a small interface and pick at runtime. No schema change, no data migration. The abstraction lives in `src/features/shared/server/sqlite/` because it is a runtime-portability concern, not a push-notifications concern, and the next feature that needs SQLite would otherwise either duplicate or violate the no-cross-feature-imports rule in `CLAUDE.md`.

## Alternatives considered

- **Switch nitro preset to `'node'`**: simplest possible change, one config edit. Rejected because (a) we lose Bun's startup speed and lower memory footprint that the prod runtime was chosen for, (b) other Bun-native code paths may rely on the Bun runtime (would need a separate audit), (c) `bun:sqlite` is a first-class built-in and is the recommended Bun path for SQLite, so swapping the driver is the durable answer rather than working around Bun.
- **Replace SQLite with JSON-on-disk or another store**: too large a change for a production crash fix; reopens schema and durability questions.
- **Wait for upstream Bun fix on `better-sqlite3`**: open since 2023; not a viable timeline for an actively broken feature.

## Acceptance Criteria

- [ ] AC-1: A user signed in to a production Bun server can tap "Enable Notifications" and the request completes with 200 (subscription saved)
- [ ] AC-2: `bun run .output/server` boots without throwing on first push-store access
- [ ] AC-3: When running under Node (vitest, `pnpm test`), the store continues to use `better-sqlite3` and all existing `push-store.test.ts`, `push-notify.test.ts`, `push.test.ts`, `mqtt-cache.integration.test.ts` tests pass
- [ ] AC-4: On Bun, the store reads/writes the same `data/camera-events.db` file that `better-sqlite3` previously wrote — existing subscriptions and preferences continue to work without migration. Verified on Node side by a round-trip test that opens an existing better-sqlite3 file with the wrapper and reads its rows
- [ ] AC-5: WAL mode is still enabled on the Bun runtime (manual smoke test confirms `PRAGMA journal_mode` returns `wal`)
- [ ] AC-6: All existing public API of `PushStore` keeps the same signatures and observable behavior
- [ ] AC-7: At runtime on Bun, no `better-sqlite3` `require`/`import` is evaluated. Verified by a Node-side test that mocks `bun:sqlite` and asserts the better-sqlite3 module's load function was never called when `process.versions.bun` is faked. Also verified at the build-output level by a `grep -L 'require.*better-sqlite3'` check on the Bun bundle entry
- [ ] AC-8: When `bun:sqlite` cannot be imported (forced failure in the dynamic import), `openSqlite` throws a clear, actionable error containing the words "bun:sqlite" and "not available" — not the raw `MODULE_NOT_FOUND` stack
- [ ] AC-9: The `usePushSubscription` client error path no longer leaks raw server error strings on 5xx — it surfaces a generic, accessible "Notifications are temporarily unavailable" message and only shows specific text on 4xx where the user can act

## User-Facing Behavior

```gherkin
Feature: Enable push notifications on the Bun production server

  Background:
    Given the production server is built with `vite build` and started with `bun run .output/server`
    And VAPID keys are configured
    And the user is authenticated
    And the browser supports the Push API

  Scenario: User enables notifications for the first time on Bun
    Given the user has no push subscription yet
    When the user taps "Enable Notifications" on the Settings page
    And the browser grants notification permission
    Then the client POSTs the subscription to /api/push/subscribe
    And the server responds 200
    And the subscription row exists in data/camera-events.db
    And the Settings UI reflects "notifications enabled"

  Scenario: Server boots cleanly on Bun
    When the operator runs `bun run .output/server`
    Then the process starts listening
    And no error mentioning "better-sqlite3" or "N-API" appears in the logs
    And the first request to /api/push/vapid-public-key succeeds

  Scenario: Existing data is preserved across the driver swap
    Given a `data/camera-events.db` file exists from a prior Node run
    And it contains a row in `push_subscriptions` for user "u1"
    When the server starts on Bun
    And the user signs in as "u1"
    And the Settings page calls /api/push/preferences
    Then the existing camera preferences are returned
    And no schema migration error is logged

  Scenario: Tests still run on Node
    When `pnpm test` runs in CI (Node + vitest)
    Then push-store.test.ts uses better-sqlite3
    And all assertions pass

  Scenario: bun:sqlite is unavailable at runtime (degraded environment)
    Given the server is running on a Bun build that does not expose bun:sqlite
    When openSqlite is called
    Then it throws an Error whose message contains "bun:sqlite is not available"
    And the message points the operator at the runtime mismatch as the cause

  Scenario: 5xx error UX (cross-platform)
    Given the user taps "Enable Notifications"
    And the server returns any 5xx response
    Then the client toast reads "Notifications are temporarily unavailable. Please try again later."
    And no internal error string from the server body is shown
    And the toast is announced to assistive technology as that exact text
    And this behavior is identical on iOS Safari standalone and Android Chrome
```

## Approach

Introduce `src/features/shared/server/sqlite/index.ts` exporting:

```ts
export interface SqliteStatement {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  exec(sql: string): void
  pragmaRead(name: string): unknown[]
  pragmaWrite(stmt: string): void
  close(): void
}

export async function openSqlite(path: string): Promise<SqliteDatabase>
```

Key shape decisions:

- `pragmaRead` vs `pragmaWrite`: better-sqlite3's `pragma()` and `bun:sqlite`'s prepared `PRAGMA` queries return slightly different shapes. Splitting read and write makes the intent explicit and lets each driver pick the correct underlying call. (Per the Architecture Critic.)
- `openSqlite` is **async** and returns a `Promise`. The Bun branch needs `await import('bun:sqlite')`; surfacing the async correctly is honest. `getPushStore()` is updated to be async, and its callers (`push-handlers.ts`, `push-notify.ts`, `push.ts`) await it. This is the correct ripple — better than a sync-shaped lie.
- The driver lives in `src/features/shared/server/sqlite/` because it is generic infrastructure, not push-notifications domain logic. This avoids the next-feature-needs-SQLite trap.
- Driver selection is **runtime-branched** via `process.versions?.bun`. AC-7's verification is satisfied by a Node-side test that fakes `process.versions.bun`, supplies a mock `bun:sqlite` module, and asserts that `better-sqlite3` was never imported on the hot path. A build-time entry-point split (Vite `define` or two entry files keyed off the nitro preset) was considered and is preferable in principle, but adds nitro/Vite plugin work that is out of proportion for a single-consumer abstraction. We accept that both branches ship in the bundle and verify behaviorally that only the right branch executes.

## Steps

### Step 1: Driver-contract characterization test

**Complexity**: standard
**RED**: Add `push-store.driver-contract.test.ts` that drives `PushStore` through its full public API in one place: `saveSubscription` → `getSubscriptionsByUserId`, idempotent re-subscribe, `removeSubscription` and `removeSubscriptionByEndpoint`, `getAllSubscribedUserIds`, `setPreference` → `getDisabledCameras` and `isCameraEnabledForUser`, `close`. The new file consolidates scenarios that the existing `push-store.test.ts` covers in scattered form; it exists so we can re-run a single file unchanged after the refactor and prove zero behavior drift. Note in the file's top comment: "if all assertions here are already covered elsewhere, this is the safety net for the driver swap; do not delete after Step 3."
**GREEN**: No production code changes — assertions pass against current `better-sqlite3` implementation.
**REFACTOR**: None.
**Files**: `src/features/push-notifications/server/push-store.driver-contract.test.ts` (new)
**Commit**: `test(push-store): add driver-contract characterization test`

### Step 2: Extract the driver abstraction into `shared/`

**Complexity**: standard
**RED**: Add `src/features/shared/server/sqlite/sqlite.test.ts` that calls `await openSqlite(tmpPath)` and exercises `prepare/run/get/all`, `exec`, `pragmaRead('journal_mode')`, `pragmaWrite('journal_mode = WAL')`. Asserts row shape (plain JS objects with column names) and that `pragmaRead('journal_mode')` returns `[{ journal_mode: 'wal' }]` after the write.
**GREEN**: Create `src/features/shared/server/sqlite/index.ts` exporting `SqliteDatabase`, `SqliteStatement`, `openSqlite`. Implementation handles the Node branch with `better-sqlite3`. The Bun branch is stubbed: `if (process.versions?.bun) throw new Error('Bun branch added in next step')`.
**REFACTOR**: Update `push-store.ts`:

- Replace `import Database from 'better-sqlite3'` with `import { openSqlite, type SqliteDatabase } from '#/features/shared/server/sqlite'`.
- Change `PushStore.db: Database.Database` → drop the field. Replace test access with two narrow inspection helpers on `PushStore`: `tableNames(): string[]` and `tableColumns(name: string): string[]`. Update `push-store.test.ts` and the Step 1 contract test to use these helpers instead of `store.db.prepare(...)`. (This closes the Architecture Critic's leaky-abstraction blocker.)
- Make `createPushStore` async (returns `Promise<PushStore>`); make `getPushStore` async too. Update `push-handlers.ts`, `push-notify.ts`, and any other call sites to `await getPushStore()`. The existing handlers are already async, so this is straightforward.

Run all existing tests; all pass.
**Files**: `src/features/shared/server/sqlite/index.ts` (new), `src/features/shared/server/sqlite/sqlite.test.ts` (new), `src/features/push-notifications/server/push-store.ts` (modify), `src/features/push-notifications/server/push-store.test.ts` (modify — switch from `store.db.prepare` to new helpers), `src/features/push-notifications/server/push-store.driver-contract.test.ts` (modify — same), `src/features/push-notifications/server/push-handlers.ts` (modify), `src/features/push-notifications/server/push-notify.ts` (modify)
**Commit**: `refactor(push-store): extract sqlite driver into shared/server/sqlite`

### Step 3: Add the Bun branch (with Node-side mock-driven verification)

**Complexity**: complex

**RED-A (Node-side, runs in CI)**: Add `sqlite.bun-branch.test.ts` that:

1. Stubs `process.versions.bun = '1.x'` for the duration of the test
2. Uses `vi.mock('bun:sqlite', ...)` to provide a fake `Database` with `prepare`, `exec`, `query`, `close` matching the `bun:sqlite` API surface we depend on
3. Spies on `better-sqlite3` import (e.g. by importing it as a module and spying on the constructor) — asserts the spy is **never called**
4. Calls `openSqlite('/tmp/x')` and exercises `prepare/get/all/run`, `exec`, `pragmaRead`, `pragmaWrite` against the mock; verifies the wrapper passes through correctly
5. Adds a separate test that forces `vi.mock('bun:sqlite', () => { throw new Error('not found') })` and asserts `openSqlite` rejects with an error whose message contains `bun:sqlite is not available` (covers AC-8)
6. Adds a "data round-trip" test that opens an existing `better-sqlite3`-written DB file using the **Node** branch (not the mocked Bun branch) and reads rows — covers schema compatibility per AC-4

**RED-B (Bun-only, runs locally only)**: Add `sqlite.bun-runtime.test.ts` gated by `it.skipIf(!process.versions?.bun)`. This runs against the real `bun:sqlite` when invoked under `bun test`; it is documented as a manual gate, not a CI gate. The PR description must include the output of `bun test src/features/shared/server/sqlite/sqlite.bun-runtime.test.ts` as evidence.

**GREEN**: Implement the Bun branch in `sqlite/index.ts`:

- Cache the `bun:sqlite` module in a module-scoped `let bunSqlite` so the dynamic import only happens once.
- Wrap `bun:sqlite`'s `Database`:
  - `prepare(sql)` → returns Bun's `Statement` with `run/get/all` re-exposed and parameter normalization (`undefined` → `null` to match better-sqlite3 binding semantics)
  - `exec(sql)` → Bun's `db.exec` (verify shape during implementation; use `db.run` for single-statement if needed)
  - `pragmaRead(name)` → `db.prepare("PRAGMA " + name).all()` (Bun returns `[{ name: value }]`, matches Node)
  - `pragmaWrite(stmt)` → `db.exec("PRAGMA " + stmt)` (no return)
  - `close()` → `db.close()`
- Wrap the dynamic import in a try/catch; on failure throw `new Error('bun:sqlite is not available in this runtime — expected on Bun, got ' + process.versions)`.

**REFACTOR**: Add JSDoc on `openSqlite` documenting the runtime branch, the bun#4290 link, and the lazy-init rationale. Run `pnpm build` to confirm no bundler error. Confirm the Node branch tests still pass — they should be unaffected.

**Files**: `src/features/shared/server/sqlite/index.ts` (modify), `src/features/shared/server/sqlite/sqlite.bun-branch.test.ts` (new — runs in CI, mock-driven), `src/features/shared/server/sqlite/sqlite.bun-runtime.test.ts` (new — Bun-only, manual gate)
**Commit**: `feat(sqlite): add bun:sqlite driver with mock-verified branch selection`

### Step 4: Sanitize 5xx error UX in `usePushSubscription`

**Complexity**: standard
**RED**: Update `src/features/settings/hooks/usePushSubscription.test.tsx` (create if missing) with two cases:

1. Mock `fetch('/api/push/subscribe')` to return 500 with body `{ error: 'better-sqlite3 is not yet supported in Bun' }`. Assert that `error` state is exactly `"Notifications are temporarily unavailable. Please try again later."` and **does not** contain "better-sqlite3" or any server-supplied substring.
2. Mock the same to return 401. Assert the existing session-expired copy is unchanged.
3. Mock the same to return 400 with `{ error: 'Invalid subscription endpoint URL' }`. Assert that 4xx error text is preserved (user can act on validation failure).
   **GREEN**: In `usePushSubscription.ts`, replace the current 5xx branch:

```ts
if (res.status >= 500) {
  setError('Notifications are temporarily unavailable. Please try again later.')
} else if (res.status === 401) {
  setError(
    'Your session has expired. Please sign in again, then enable notifications.',
  )
} else {
  // 4xx: surface server-supplied error if present, fall back to generic
  let detail = ''
  try {
    const body = await res.json()
    detail = typeof body.error === 'string' ? `: ${body.error}` : ''
  } catch {
    // no parseable body
  }
  setError(`Could not enable notifications${detail}. Please try again.`)
}
```

The user-visible message no longer contains the server stack/library name. Screen readers announce the same generic copy. Cross-platform identical (no platform branch).
**REFACTOR**: None.
**Files**: `src/features/settings/hooks/usePushSubscription.ts` (modify), `src/features/settings/hooks/usePushSubscription.test.tsx` (new or modify)
**Commit**: `fix(usePushSubscription): generic 5xx error copy without leaking internals`

### Step 5: Manual cross-platform smoke test on the production Bun build

**Complexity**: standard
**RED**: No automated test — Bun is the production runtime, not a CI runtime.
**GREEN**: Run `pnpm build && bun run .output/server`, then verify on each surface:

1. **Desktop Chrome**: sign in → Settings → Enable Notifications → toggle goes to enabled, no toast → Send Test → notification appears → Disable → re-enable → restart server → subscription survives.
2. **Android Chrome (real device or emulator)**: same flow.
3. **iOS Safari standalone (added to Home Screen, iOS 16.4+)**: same flow. Per `CLAUDE.md`, this is a top-priority surface; if any step fails differently from desktop/Android, do **not** ship without flagging the platform delta.
4. Force-trigger 5xx: temporarily break the server (e.g. revoke DB write permission), tap Enable, confirm the new generic copy appears, confirm no internal text leaks. Restore.
5. Capture `bun test src/features/shared/server/sqlite/sqlite.bun-runtime.test.ts` output and paste into the PR description as Step 3's manual gate evidence.

If anything reveals an API gap, patch the wrapper, add a regression test in BOTH `sqlite.bun-branch.test.ts` (mock-driven) and `sqlite.bun-runtime.test.ts` (real Bun), and document.
**REFACTOR**: As needed.
**Files**: PR description (manual evidence)
**Commit**: fold fixes (if any) into the relevant prior commit

### Step 6: Move `better-sqlite3` to devDependencies and verify the Bun bundle

**Complexity**: trivial
**RED**: Add a CI step or `pnpm` script `verify:bun-bundle` that runs `pnpm build` then greps the produced Bun entry (`.output/server/index.mjs` or equivalent) and fails if the **import** for `better-sqlite3` is reachable from the hot path. (A loose `grep` for the literal string `better-sqlite3` is acceptable as a smoke check; the real proof is the mock-driven test in Step 3.)
**GREEN**: Move `better-sqlite3` from `dependencies` → `devDependencies` in `package.json`. Update `@types/better-sqlite3` if needed. Run `pnpm install`, `pnpm test`, `pnpm build` — all should pass. The production Bun image will no longer pull a native addon it cannot load.
**REFACTOR**: None.
**Files**: `package.json` (modify), `package.json` script for the verify step
**Commit**: `chore(deps): move better-sqlite3 to devDependencies`

## Complexity Classification

| Rating     | Criteria                                                                         | Review depth                                        |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `trivial`  | Single-file rename, config change, typo fix, documentation-only                  | Skip inline review; covered by final `/code-review` |
| `standard` | New function, test, module, or behavioral change within existing patterns        | Spec-compliance + relevant quality agents           |
| `complex`  | Architectural change, security-sensitive, cross-cutting concern, new abstraction | Full agent suite including opus-tier agents         |

Step 3 is `complex` because of runtime-branched dynamic import + bundler interaction + first introduction of a Bun-only code path.

## Pre-PR Quality Gate

- [ ] `pnpm test` passes (Node, vitest) — includes Step 3's mock-driven Bun-branch test that covers the production code path
- [ ] `bun test src/features/shared/server/sqlite/sqlite.bun-runtime.test.ts` passes locally — output pasted in the PR
- [ ] `pnpm lint` passes
- [ ] `pnpm format` (or `pnpm check`) passes
- [ ] `pnpm build` succeeds
- [ ] Manual smoke test on `bun run .output/server`: desktop Chrome, Android Chrome, **iOS Safari standalone** — enable, disable, test, restart-survives, forced-5xx-shows-generic-copy
- [ ] `/code-review` passes
- [ ] No `better-sqlite3` import outside `src/features/shared/server/sqlite/`
- [ ] `better-sqlite3` is in `devDependencies`, not `dependencies`
- [ ] PR description includes Bun bundle verification (grep on `.output/server`)

## Risks & Open Questions

- **Bun's `bun:sqlite` API surface drift**: parameter binding (`undefined` vs `null`), boolean-vs-integer (the `isCameraEnabled` query), row shape from prepared `PRAGMA` reads. Mitigation: Step 3's mock-driven branch test plus the contract test plus the manual Bun-runtime test. Wrapper normalizes `undefined` → `null` and integer-as-boolean explicitly.
- **Runtime branch detection vs. build-time split**: chose runtime branch with `process.versions?.bun` for proportionality. If a future bundler change makes the dead branch a problem, the migration to a build-time entry split is the documented escape hatch (Vite `define` or two nitro entries).
- **Async ripple from `await import('bun:sqlite')`**: `getPushStore()` becomes async. Call sites updated in Step 2. No external API change — handlers were already async.
- **WAL across drivers writing the same file**: pre-existing concern; production and dev use separate working directories; out of scope but flagged as an operator note in the JSDoc on `openSqlite`.
- **Stale-tab + SW-update edge case** (UX Critic observation): not covered by this plan; filed as a follow-up issue. The current plan only sanitizes the **error** UX, not the SW-coordination UX.
- **iOS Safari standalone push**: requires iOS 16.4+ and Home Screen install. The smoke test in Step 5 must explicitly verify on this surface; if Push API is unavailable on the test device, the plan's UX path (`isSupported = false`, hide controls) is exercised instead, which is the existing behavior.
- **Open question (resolved)**: `better-sqlite3` → `devDependencies` is in scope as Step 6. Confirmed by the Acceptance-Test Critic and Strategic Critic feedback.

## Plan Review Summary

Four plan-review personas ran in parallel. Three returned `needs-revision` initially; the plan was revised to incorporate every blocker. Key changes from the v1 draft:

| Reviewer                     | Verdict (v1)   | Blocker addressed in v2                                                                                                                                                                                                                                                |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceptance-Test Critic       | needs-revision | Bun code path now has Node-CI coverage via mock-driven branch test (Step 3). AC-7 has explicit verification (mock spy + bundle grep). New AC-8 + scenario for dynamic-import failure. RED-GREEN honesty fix.                                                           |
| Design & Architecture Critic | needs-revision | Driver moved to `src/features/shared/server/sqlite/`. `db` escape hatch replaced with narrow `tableNames`/`tableColumns` helpers. `pragma()` split into `pragmaRead`/`pragmaWrite`. `openSqlite` is now honestly async. `better-sqlite3` → `devDependencies` in scope. |
| UX Critic                    | needs-revision | New AC-9 + Step 4 sanitize 5xx error copy in `usePushSubscription`. Step 5 smoke test now explicitly includes iOS Safari standalone. Stale-tab edge case noted as follow-up.                                                                                           |
| Strategic Critic             | approve        | Alternatives section added (`preset: 'node'` evaluated). Step 1 characterization test justified inline.                                                                                                                                                                |

Outstanding warnings (non-blocking) folded into "Risks & Open Questions": runtime-vs-build-time detection trade-off, stale-tab SW edge case, WAL cross-driver concern, iOS Safari constraint surface.
