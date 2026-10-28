---
paths:
  - 'src/**/*.test.ts'
  - 'src/**/*.test.tsx'
---

# Testing conventions

Run: `bun run test` (all), `bun run test -- <path-or-filename-substring>`, `-- --watch`, `-- --reporter=verbose`. Vitest `unit` project: jsdom, matches `src/**/*.test.{ts,tsx}`.

- Tests live next to the source: `foo.ts` → `foo.test.ts`. No `__tests__/` dirs.
- Always import explicitly: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`. No globals, no `@jest/*`.
- One top-level `describe` per exported symbol; nest `describe` for sub-groups; one observable outcome per `it`.
- Use `make*` factory helpers with `Partial<T>` overrides for fixtures (e.g. `makeEvent({ camera: 'x' })`).

## By layer

- **Pure functions (utils, validators, parsers):** test exhaustively. Validators like `isValidCameraName` / `isValidEventId` need valid inputs, path traversal, null bytes, control chars, empty and max-length strings _before_ production code uses them.
- **Component logic:** extract rendering decisions (`getCamerasPageState`, `getAlertMessage`) and test with plain `expect`; no render needed.
- **Hooks:** `renderHook` when there are real state transitions; a structural type test is enough for option-shape/constant hooks.
- **Components:** `@testing-library/react`, query by role/label, assert user-visible output; `vi.mock()` child components that own tests. Radix needs `@testing-library/user-event`; jsdom polyfills are in `src/test-setup.ts`.
- **Server logic (proxies, MQTT, push):** stub `globalThis.fetch` and `process.env`; restore in `afterEach` (save the original, then restore or `delete`).
- **Timers:** `vi.useFakeTimers()` / `vi.advanceTimersByTime()`; always `vi.useRealTimers()` in `afterEach`.
- **Server functions:** call the handler directly (not via HTTP); assert the return value and that it throws without a valid session (`requireSession()` first line).

## Special test files

- `*.driver-contract.test.ts` — `SqliteDatabase` behaves identically under better-sqlite3 and bun:sqlite; real on-disk DB in a temp path, self-contained.
- `*.bun-runtime.test.ts` — skipped under Node (`it.skipIf(!process.versions.bun, ...)`).
- `*.bun-branch.test.ts` — Bun branch via module mocking so it runs under Node.
- `*.integration.test.ts` — hits real external deps (live MQTT); not part of `bun run test`, run manually.
