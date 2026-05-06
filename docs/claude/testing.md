# Testing Guide

## Test-Driven Development

All new behaviour must be written test-first. Follow the **Red → Green → Refactor** cycle strictly:

1. **RED** — Write a failing test that describes the behaviour you intend to add. Run `bun run test` and confirm it fails for the right reason (assertion failure, not a syntax error or import crash).
2. **GREEN** — Write the minimum production code to make that test pass. No extra logic, no "while I'm here" cleanup.
3. **REFACTOR** — With the tests green, improve the design: rename, extract, simplify. Re-run tests after every change to stay green.

Never write production code before a failing test exists. Never skip the refactor step.

## Running Tests

```bash
bun run test                   # Run all tests once (unit + Storybook browser)
bun run test -- --watch        # Watch mode — re-runs on file save
bun run test -- --reporter=verbose   # Verbose per-test output
bun run test -- src/features/cameras # Run a single feature's tests
bun run test -- validation     # Filter by filename substring
```

The Vitest config in `vite.config.ts` defines two projects:

- `unit` — jsdom environment, matches `src/**/*.test.ts` and `src/**/*.test.tsx`
- `storybook` — Playwright Chromium, matches `*.stories.tsx` files via `@storybook/addon-vitest`

## Test File Placement

Every test file lives **next to the source file it tests**, named `<source>.test.ts` or `<source>.test.tsx`. No separate `__tests__/` directories.

```
src/features/cameras/utils/mergeCameraOrder.ts
src/features/cameras/utils/mergeCameraOrder.test.ts   ← lives here
```

## Imports

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

Do not import from `@jest/*`. Do not use globals — always import `describe`, `it`, `expect`, etc. explicitly.

## Structure: One `describe` per exported symbol

Each top-level `describe` block covers one exported function or class. Nest `describe` blocks for logical sub-groups (e.g. error paths, edge cases). Keep each `it` focused on a single observable outcome.

```ts
describe('isValidCameraName', () => {
  it('returns true for alphanumeric names', () => { ... })
  it('returns false for path traversal with ../', () => { ... })
  it('returns false for names containing spaces', () => { ... })
})
```

## What to Test at Each Layer

**Pure functions (utils, validators, parsers)** — test exhaustively. These are the easiest to TDD: write the test, watch it fail, implement the regex/logic, go green. See `validation.test.ts`, `mergeCameraOrder.test.ts`.

**Pure component logic** — extract rendering-decision functions (e.g. `getCamerasPageState`, `getAlertMessage`) from the component and test them in isolation with plain `expect` calls. No render needed. See `CamerasPage.test.tsx`, `AlertBanner.test.ts`.

**React hooks** — test via `renderHook` from `@testing-library/react` when the hook has meaningful state transitions. For hooks that only accept option shapes or export constants, a structural type-level test is sufficient (see `usePullToRefresh.test.ts`).

**React components** — render with `@testing-library/react`, query by accessible role/label, assert on user-visible output. Use `vi.mock()` to stub child components that own their own tests. See `CamerasPage.test.tsx`.

**Server-side logic (proxies, MQTT handlers, push pipeline)** — stub `globalThis.fetch` and `process.env` directly. Restore after each test with `beforeEach`/`afterEach`. See `clip-proxy.test.ts`, `mqtt.test.ts`.

**Async behaviour with timers** — use `vi.useFakeTimers()` / `vi.advanceTimersByTime()`. Always call `vi.useRealTimers()` in `afterEach`. See `event-batcher.test.ts`.

**Storybook stories** — `*.stories.tsx` files serve as component integration tests run in a real browser via Playwright. Write a story for every significant component state. The a11y addon checks WCAG compliance automatically on each story.

## Mocking Patterns

**Module mock** — stub an entire module for the whole file:

```ts
vi.mock('#/features/cameras/hooks/useCameraOrder', () => ({
  useCameraOrder: (cameras: string[]) => ({
    visibleOrder: cameras,
    setOrder: vi.fn(),
    saveError: null,
    dismissError: vi.fn(),
  }),
}))
```

**Spy / stub** — mock a single function and assert on calls:

```ts
const flush = vi.fn()
batcher.add(makeEvent())
vi.advanceTimersByTime(30_000)
expect(flush).toHaveBeenCalledOnce()
expect(flush).toHaveBeenCalledWith('front_porch', [makeEvent()])
```

**Fetch mock** — stub `globalThis.fetch` per test, restore in `afterEach`:

```ts
const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
})
```

**Environment variables** — mutate `process.env` directly, restore in `afterEach`:

```ts
const original = process.env.FRIGATE_URL
beforeEach(() => {
  process.env.FRIGATE_URL = 'http://frigate.local:5000'
})
afterEach(() => {
  if (original === undefined) delete process.env.FRIGATE_URL
  else process.env.FRIGATE_URL = original
})
```

**Factory helpers** — use a `make*` helper to create default test fixtures, then spread overrides:

```ts
function makeEvent(
  overrides: Partial<FrigateEventInfo> = {},
): FrigateEventInfo {
  return {
    id: '1234.5678-abc',
    camera: 'front_porch',
    label: 'person',
    startTime: 1713182400,
    ...overrides,
  }
}
```

## Special Test Variants

- `*.driver-contract.test.ts` — validate that the `SqliteDatabase` abstraction behaves identically under both `better-sqlite3` (Node) and `bun:sqlite` (Bun). These tests create a real on-disk database in a temp path and must be self-contained.
- `*.bun-runtime.test.ts` — skipped when running under Node (use `it.skipIf(!process.versions.bun, ...)`). Tests the Bun production code path.
- `*.bun-branch.test.ts` — tests the Bun branch via module mocking so they can run under Node in CI.
- `*.integration.test.ts` — hits real external dependencies (e.g. a live MQTT broker). Not part of `bun run test`; run manually.

## TDD for Server Functions

When adding a `createServerFn` handler:

1. **RED** — write a test that calls the handler function directly (not via HTTP), asserts the correct return value or thrown error, and expects `requireSession()` to throw when called without a valid session.
2. **GREEN** — implement the handler with `await requireSession()` as the first line.
3. **REFACTOR** — extract any complex logic into a pure helper and test that helper independently.

## TDD for Validators / Input Guards

Security-critical validators like `isValidCameraName` and `isValidEventId` must have exhaustive test coverage before any production code reads from them. Write tests for valid inputs, path-traversal payloads, null bytes, control characters, empty strings, and maximum-length strings first.
