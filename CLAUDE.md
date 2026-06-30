# Project Instructions

## Project Overview

Camera Events v2 is a self-hosted PWA for browsing and monitoring [Frigate NVR](https://frigate.video/) events. It receives live motion events from Frigate over MQTT, batches them per camera, and delivers Web Push notifications to subscribed iOS/Android/desktop devices. Built with TanStack Start (SSR), React 19, Tailwind CSS v4, and deployed via Bun.

**Tech stack:** TanStack Start + TanStack Router (file-based, SSR) · React 19 · Vite 8 · Tailwind CSS v4 · better-sqlite3 / bun:sqlite · MQTT (RabbitMQ) · Google OAuth via Arctic · web-push (VAPID) · Serwist service worker · Vitest + Playwright

**Package manager:** Bun (enforced via `preinstall: only-allow bun`). Use `bun` for all installs and script runs.

## Model Usage & Delegation

These rules govern which model does what. They exist so that the expensive reasoning model is reserved for thinking, and the cheaper/faster model does the mechanical work — without quality loss.

- **These are defaults; the user can override them at any time.** If the user directs model usage for a task — e.g. "plan this with Sonnet", "implement this with Opus", "don't delegate", "do it all yourself" — that instruction takes precedence over the Opus-plans/Sonnet-implements split below for that work. Honor the override without re-arguing the default.
- **Opus plans. Sonnet implements.** Opus is the planning model: use it for understanding the codebase, designing the approach, decomposing work, reviewing diffs, and making architectural or security trade-off decisions. Delegate the actual implementation of each work chunk to a Sonnet subagent (via the `Agent` tool with `model: "sonnet"`, or a Workflow with `model: 'sonnet'` agents).
- **Decompose plans into Sonnet-sized chunks.** A plan is not done until it is broken into work chunks each small and self-contained enough that a Sonnet subagent can complete it adequately on its own. If a chunk still requires non-trivial design judgement, ambiguous decisions, or holding more context than fits comfortably, it is too big — split it further or resolve the open questions in the plan first.
- **What makes a chunk Sonnet-ready:**
  - Narrow, explicit scope — ideally one feature slice or one to a few named files.
  - Concrete file targets and the exact change intended, not a vague goal.
  - Acceptance criteria spelled out, normally as the tests to write/pass (follow the project's Red → Green → Refactor TDD discipline).
  - No unresolved design decisions, cross-feature trade-offs, or security judgement calls left for the implementer — Opus resolves those during planning.
  - Self-contained: the chunk's instructions carry enough context that the subagent does not need to re-derive the plan.
- **Keep chunk outputs small.** Prefer many small, independently verifiable chunks over one large change. Smaller diffs are easier for Sonnet to get right and for Opus to review.
- **Opus stays in the loop.** After Sonnet completes a chunk, Opus reviews the result (correctness, the project's architecture and security rules, test coverage) before moving on. Anything that surfaces a new design question goes back to planning, not straight into more implementation.
- **Escalate when needed.** If a chunk turns out to need real design or debugging judgement mid-implementation, stop and hand it back to Opus to re-plan rather than letting Sonnet improvise beyond the chunk's stated scope.

## Path Aliases

- `#/*` maps to `./src/*` (defined in `package.json` `imports` and `tsconfig.json` `paths`).
- Always use `#/features/...` for cross-directory imports within `src/`.

## Development Commands

```bash
bun install
bun run dev          # Dev server on :3000 (auto-regenerates routeTree)
bun run build        # Production build
bun run preview      # Serve production build locally
bun run test         # Vitest (unit)
bun run lint         # ESLint
bun run format       # Prettier check
bun run check        # Prettier write + ESLint --fix
bun run knip         # Unused-code report
```

## Tailwind CSS

- Always use Tailwind CSS canonical class names instead of arbitrary value syntax when a built-in utility exists. For example, use `text-(--sea-ink)` instead of `text-[var(--sea-ink)]`, `min-h-11` instead of `min-h-[44px]`, `rounded-4xl` instead of `rounded-[2rem]`, `shrink-0` instead of `flex-shrink-0`.
- Design tokens are defined in `src/styles.css` under `@theme` and `:root`. The palette uses CSS custom properties: `--sea-ink`, `--sea-ink-soft`, `--lagoon`, `--lagoon-deep`, `--palm`, `--sand`, `--foam`, `--surface`, `--surface-strong`, `--line`, `--bg-base`, `--header-bg`, etc. Dark mode swaps are applied via `[data-theme='dark']` and `@media (prefers-color-scheme: dark)`.
- Fonts: `Manrope` (body, sans-serif), `Fraunces` (display headings).
- The theme is stored in `localStorage` under the key `'theme'` (`'light'`, `'dark'`, or `'auto'`). A blocking inline script in `__root.tsx` sets the `data-theme` attribute and class before paint to prevent FOUC.

## Route Generation

- **NEVER run `npx tsr generate`**. The `tsr` npm package is an unrelated unused-code removal tool that will **delete** test files and `vite.config.ts`. Running it with `--write` is destructive and irreversible without git.
- Route tree generation (`src/routeTree.gen.ts`) is handled automatically by the `tanstackStart()` Vite plugin during `bun run dev` and `bun run build`. No separate CLI step is needed.
- If you add a new route file under `src/routes/`, start the dev server (`bun run dev`) to trigger route tree regeneration.

## Feature-Sliced Architecture

- The codebase uses a vertical feature-slice architecture. Each feature lives in its own folder under `src/features/` and owns all of its components, hooks, utilities, types, and server logic.
- **Features must never import from other features.** No cross-feature imports are allowed — if two features need the same logic, it belongs in `src/features/shared/`.
- `src/features/shared/` is the only place for code that is used by multiple features. Shared code should be genuinely reusable, not a dumping ground for convenience.
- When creating a new feature, give it its own folder under `src/features/` with everything it needs. Prefer duplication over coupling between features.

### Feature Map

| Feature              | Location                           | What it owns                                                                                                         |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `auth`               | `src/features/auth/`               | Google OAuth flow, session helpers, `useStandaloneAuth` hook                                                         |
| `camera-details`     | `src/features/camera-details/`     | Event detail page, snapshot lightbox, event snapshot, info card, blob download hook, clip/snapshot/thumbnail proxies |
| `camera-events`      | `src/features/camera-events/`      | Event list page, filter pills, events loading skeleton, mock data                                                    |
| `cameras`            | `src/features/cameras/`            | Camera grid page, sortable tiles, camera order persistence, snapshot proxy                                           |
| `favorites`          | `src/features/favorites/`          | Saved-events list page; server logic lives in shared/server/favorites/                                               |
| `home`               | `src/features/home/`               | Home/landing page component                                                                                          |
| `push-notifications` | `src/features/push-notifications/` | MQTT subscriber, event batcher, push dispatcher, SQLite push store                                                   |
| `settings`           | `src/features/settings/`           | Settings page, notification preferences UI, `usePushSubscription` hook                                               |
| `shared`             | `src/features/shared/`             | Frigate API client + cache + types + validation, session, SQLite driver, shared components + hooks                   |
| `shell`              | `src/features/shell/`              | App header, theme toggle, service worker registration                                                                |

## Route Structure

```
src/routes/
  __root.tsx                      # Root layout: Header, ServiceWorkerRegistration, TanStack devtools
  index.tsx                       # Landing / login page
  _authenticated.tsx              # Auth guard layout (redirects unauthenticated users)
  _authenticated/
    camera-events.index.tsx       # /camera-events — paginated event list
    camera-events.$id.tsx         # /camera-events/:id — event detail
    cameras.tsx                   # /cameras — camera grid with drag-reorder
    settings.tsx                  # /settings — push notification preferences
  api/
    auth/google.ts                # GET /api/auth/google — OAuth initiation
    auth/google/callback.ts       # GET /api/auth/google/callback — OAuth callback
    auth/logout.ts                # POST /api/auth/logout
    cameras/$name/latest.ts       # GET /api/cameras/:name/latest — proxied live snapshot
    events/$id/clip.ts            # GET /api/events/:id/clip
    events/$id/snapshot.ts        # GET /api/events/:id/snapshot
    events/$id/thumbnail.ts       # GET /api/events/:id/thumbnail
    push/subscribe.ts             # POST /api/push/subscribe
    push/unsubscribe.ts           # POST /api/push/unsubscribe
    push/preferences.ts           # GET/POST /api/push/preferences
    push/vapid-public-key.ts      # GET /api/push/vapid-public-key
    push/test.ts                  # POST /api/push/test
```

## Cross-Platform PWA

- **Cross-platform support is a top priority.** This app is a PWA that must work seamlessly on both iOS (Safari standalone) and Android (Chrome), as well as desktop browsers. Never ship a feature that only works on one platform — always test and account for both iOS and Android behavior differences.
- Every feature — including push notifications, service worker interactions, OAuth, and cookie-dependent API calls — must be implemented with cross-platform compatibility in mind.
- When you spot a platform-specific issue or limitation (e.g. an API not supported on iOS, cookie behavior differences in standalone mode, etc.), **do not silently fix it**. Flag it to me first, explain the issue and your proposed fix, and wait for confirmation before implementing.
- The service worker is built by `vite-plugin-sw.ts` (custom plugin) using Serwist. The SW source is `src/sw.ts`; push handler logic lives in `src/sw-push-handlers.ts`.

## TanStack Start Server/Client Boundaries

**Before writing or reviewing any of the following, invoke the `tanstack-start-boundaries` skill:**

- `createServerFn` handlers or server-only utilities
- Route `loader` functions
- New files under `src/features/shared/server/`
- React hooks or components that use browser APIs (`window`, `localStorage`, `Notification`, etc.)
- Anything that might mix server-only imports with client-accessible code

The skill covers the full layering model, import protection rules, and common mistake patterns for this project.

## Server Function Authentication

- **TanStack Start `createServerFn` endpoints are directly callable via HTTP** at `/_serverFn/{hash}`. Route-level layout guards (like `_authenticated.tsx`'s `beforeLoad`) only protect client-side navigation — they do NOT protect server functions from direct HTTP access.
- **Every `createServerFn` handler that accesses protected data MUST call `await requireSession()`** (from `#/features/shared/server/session`) as its first operation. Never rely on the route hierarchy for server-side authentication.
- When adding a new server function inside an `_authenticated` route, always include the auth check. The function hash is discoverable in client-side JavaScript bundles, so security-through-obscurity does not apply.
- For server functions that accept user input (e.g. via `inputValidator`), always validate the input inside the handler as well — use validators like `isValidEventId()` and `isValidCameraName()` (from `#/features/shared/server/frigate/validation`) to prevent SSRF and path traversal against the Frigate backend.

## Authentication

- **Google OAuth via Arctic.** The flow is: `GET /api/auth/google` → Google → `GET /api/auth/google/callback` → set encrypted session cookie → redirect.
- OAuth state (PKCE `codeVerifier` + `state` + optional `returnTo`) is encoded as base64 JSON in the `oauth_state` cookie (5-minute TTL, `httpOnly`, `sameSite: lax`).
- `returnTo` paths are validated by `sanitizeReturnTo()` — only same-origin relative paths are accepted; absolute URLs, protocol-relative, and backslash paths are rejected.
- Session cookie name: `google-sso`; 7-day TTL; `httpOnly`, `secure` in production, `sameSite: lax`.
- `SESSION_SECRET` env var must be ≥ 32 characters. It is validated at call time (not module scope) to avoid env-access during SSR module init.
- `requireSession()` → returns the user's Google `sub` ID or throws `'Unauthorized'`.
- `getCurrentUserFn` is a server function called in `__root.tsx`'s `beforeLoad` to populate `context.user` for all routes.

## Frigate Integration

- All Frigate API calls go through `src/features/shared/server/frigate/client.ts`.
- **Mock mode:** set `FRIGATE_MOCK=true` to use `mock-client.ts` which returns randomized data — no live Frigate needed.
- **Caching:** successful JSON responses are memoized in-process by `cache.ts` (a `Map`). The cache is cleared whenever an MQTT event arrives (`frigate/events` or `frigate/reviews` topics).
- **Input validation:** `isValidCameraName()` and `isValidEventId()` must be called before using user-supplied values in Frigate URL paths.
- `FRIGATE_URL` must be set in production (e.g. `http://frigate:5000`).

## MQTT & Push Notification Pipeline

1. `src/server.ts` calls `startMqttSubscriber()` at server startup.
2. MQTT subscriber connects to `MQTT_URL` and subscribes to `frigate/events` and `frigate/reviews`.
3. Every incoming message clears the Frigate cache.
4. New `frigate/events` messages are parsed by `parseFrigateEvent()` and fed into `EventBatcher`.
5. `EventBatcher` accumulates events per camera and flushes after `EVENT_BATCH_WINDOW_MS` (default 30s).
6. On flush, `notifyUsersForCamera()` loads all push subscriptions from SQLite, checks per-user camera preferences, and dispatches Web Push via `web-push`.
7. Push subscriptions and per-camera opt-out preferences are stored in `data/camera-events.db` (SQLite, WAL mode).
8. Push is silently disabled if `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, or `VAPID_SUBJECT` are missing.

## SQLite (Runtime-Portable Driver)

- `src/features/shared/server/sqlite/index.ts` exposes a single `openSqlite(path)` function that branches at runtime: **Node → `better-sqlite3`** (used by Vitest), **Bun → `bun:sqlite`** (production).
- Both branches expose the same `SqliteDatabase` interface (`prepare`, `exec`, `pragmaRead`, `pragmaWrite`, `close`).
- `better-sqlite3` is a devDependency (not bundled into the production Bun image).
- Do not run a Node dev process and a Bun production server concurrently against the same DB file — WAL/SHM file ownership differs between drivers.
- Default DB path: `data/camera-events.db` (relative to the working directory).

## SSR & Hydration

- This project uses TanStack Start with server-side rendering. All pages and components must produce identical HTML on server and client during the initial render.
- Never read browser-only globals (`window`, `navigator`, `document`, `Notification`, `PushManager`, `localStorage`, etc.) during render. These don't exist on the server and will cause hydration mismatches.
- Defer browser-only checks to `useEffect`. Use safe defaults (e.g. `false`, `'default'`, `null`) as initial state so the server and client agree on the first paint.
- When a component must branch on client-only state, render a neutral placeholder until a `useEffect` confirms the client has mounted, rather than conditionally rendering different content that the server can't predict.
- Use `useIsomorphicLayoutEffect` (alias `useLayoutEffect` on client, `useEffect` on server) for DOM-measurement effects — see `useCameraOrder.ts` for the pattern.

## Test-Driven Development

Before writing or modifying implementation code, use the `test-driven-development` skill and follow the Red → Green → Refactor cycle for every new code addition or bug fix.

All new behaviour must be written test-first. Follow the **Red → Green → Refactor** cycle strictly:

1. **RED** — Write a failing test that describes the behaviour you intend to add. Run `bun run test` and confirm it fails for the right reason (assertion failure, not a syntax error or import crash).
2. **GREEN** — Write the minimum production code to make that test pass. No extra logic, no "while I'm here" cleanup.
3. **REFACTOR** — With the tests green, improve the design: rename, extract, simplify. Re-run tests after every change to stay green.

Never write production code before a failing test exists. Never skip the refactor step.

### Running Tests

```bash
bun run test                   # Run all tests once (unit)
bun run test -- --watch        # Watch mode — re-runs on file save
bun run test -- --reporter=verbose   # Verbose per-test output
bun run test -- src/features/cameras # Run a single feature's tests
bun run test -- validation     # Filter by filename substring
```

The Vitest config in `vite.config.ts` defines two projects:

- `unit` — jsdom environment, matches `src/**/*.test.ts` and `src/**/*.test.tsx`

### Test File Placement

Every test file lives **next to the source file it tests**, named `<source>.test.ts` or `<source>.test.tsx`. No separate `__tests__/` directories.

```
src/features/cameras/utils/mergeCameraOrder.ts
src/features/cameras/utils/mergeCameraOrder.test.ts   ← lives here
```

### Imports

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

Do not import from `@jest/*`. Do not use globals — always import `describe`, `it`, `expect`, etc. explicitly.

### Structure: One `describe` per exported symbol

Each top-level `describe` block covers one exported function or class. Nest `describe` blocks for logical sub-groups (e.g. error paths, edge cases). Keep each `it` focused on a single observable outcome.

```ts
describe('isValidCameraName', () => {
  it('returns true for alphanumeric names', () => { ... })
  it('returns false for path traversal with ../', () => { ... })
  it('returns false for names containing spaces', () => { ... })
})
```

### What to Test at Each Layer

**Pure functions (utils, validators, parsers)** — test exhaustively. These are the easiest to TDD: write the test, watch it fail, implement the regex/logic, go green. See `validation.test.ts`, `mergeCameraOrder.test.ts`.

**Pure component logic** — extract rendering-decision functions (e.g. `getCamerasPageState`, `getAlertMessage`) from the component and test them in isolation with plain `expect` calls. No render needed. See `CamerasPage.test.tsx`, `AlertBanner.test.ts`.

**React hooks** — test via `renderHook` from `@testing-library/react` when the hook has meaningful state transitions. For hooks that only accept option shapes or export constants, a structural type-level test is sufficient (see `usePullToRefresh.test.ts`).

**React components** — render with `@testing-library/react`, query by accessible role/label, assert on user-visible output. Use `vi.mock()` to stub child components that own their own tests. See `CamerasPage.test.tsx`.

**Server-side logic (proxies, MQTT handlers, push pipeline)** — stub `globalThis.fetch` and `process.env` directly. Restore after each test with `beforeEach`/`afterEach`. See `clip-proxy.test.ts`, `mqtt.test.ts`.

**Async behaviour with timers** — use `vi.useFakeTimers()` / `vi.advanceTimersByTime()`. Always call `vi.useRealTimers()` in `afterEach`. See `event-batcher.test.ts`.

### Mocking Patterns

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

### Special Test Variants

- `*.driver-contract.test.ts` — validate that the `SqliteDatabase` abstraction behaves identically under both `better-sqlite3` (Node) and `bun:sqlite` (Bun). These tests create a real on-disk database in a temp path and must be self-contained.
- `*.bun-runtime.test.ts` — skipped when running under Node (use `it.skipIf(!process.versions.bun, ...)`). Tests the Bun production code path.
- `*.bun-branch.test.ts` — tests the Bun branch via module mocking so they can run under Node in CI.
- `*.integration.test.ts` — hits real external dependencies (e.g. a live MQTT broker). Not part of `bun run test`; run manually.

### TDD for Server Functions

When adding a `createServerFn` handler:

1. **RED** — write a test that calls the handler function directly (not via HTTP), asserts the correct return value or thrown error, and expects `requireSession()` to throw when called without a valid session.
2. **GREEN** — implement the handler with `await requireSession()` as the first line.
3. **REFACTOR** — extract any complex logic into a pure helper and test that helper independently.

### TDD for Validators / Input Guards

Security-critical validators like `isValidCameraName` and `isValidEventId` must have exhaustive test coverage before any production code reads from them. Write tests for valid inputs, path-traversal payloads, null bytes, control characters, empty strings, and maximum-length strings first.

## Deployment

- **Runtime:** Bun (Nitro preset `bun`). Production entry: `bun run .output/server`.
- **Docker:** multi-stage `Dockerfile`. `docker-compose.yml` wires the app, RabbitMQ (MQTT + management plugins), and Traefik for TLS.
- **Persistent volumes:** `ce-v2-data` (SQLite DB), `rabbitmq-data` (broker state).
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP) are applied via Traefik middleware labels.

## Environment Variables

| Variable                | Required          | Purpose                                                                                  |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `SESSION_SECRET`        | Yes               | Cookie encryption key (≥32 chars)                                                        |
| `GOOGLE_CLIENT_ID`      | Yes               | Google OAuth client ID                                                                   |
| `GOOGLE_CLIENT_SECRET`  | Yes               | Google OAuth client secret                                                               |
| `FRIGATE_URL`           | Yes (unless mock) | Base URL of Frigate instance (e.g. `http://frigate:5000`)                                |
| `FRIGATE_MOCK`          | No                | Set to `true` to use mock Frigate client                                                 |
| `MQTT_URL`              | No                | MQTT broker URL (e.g. `mqtt://rabbitmq:1883`); push/cache-invalidation disabled if unset |
| `VAPID_PUBLIC_KEY`      | No                | Web Push VAPID public key; push disabled if any VAPID var missing                        |
| `VAPID_PRIVATE_KEY`     | No                | Web Push VAPID private key                                                               |
| `VAPID_SUBJECT`         | No                | Push contact (`mailto:...`); push disabled if any VAPID var missing                      |
| `APP_URL`               | No                | Public app URL for OAuth redirect; falls back to request origin in dev                   |
| `EVENT_BATCH_WINDOW_MS` | No                | Push notification batching window (default 30000ms)                                      |

Generate VAPID keys with: `npx web-push generate-vapid-keys`

## Design Docs

Feature design documents live in `docs/specs/`. Each significant feature has a spec documenting problem statement, approach, alternatives, and trade-offs. Review the relevant spec before modifying a feature. Current specs include: `cameras-page`, `cross-platform-pwa-fixes`, `event-clip-snapshot-download`, `event-count-setting`, `event-request-cache`, `feature-sliced-architecture`, `focus-refetch`, `frigate-api-client`, `google-sso-login`, `mqtt-cache-invalidation`, `mqtt-push-notifications`, `pull-to-refresh`, `rearrange-cameras-on-feed`, `web-push-notifications`, and more.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd` for issues/tasks ONLY. Do NOT use `bd remember` for persistent knowledge — all durable memory goes to the Obsidian vault at `docs/memory/` (see "Long-Term Memory Vault" below). Do NOT use MEMORY.md files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Long-Term Memory Vault

This project keeps an **Obsidian vault** at `docs/memory/` for durable, explanatory
knowledge — architectural rationale, the _why_ behind non-obvious code, platform
gotchas, decision records, and the project glossary.

- **`bd` vs the vault:** use `bd` for issues (actionable, short-lived task tracking)
  and the vault for durable knowledge (explanatory, long-lived). A bd issue says
  _"fix the iOS push race"_; a vault note explains _why iOS standalone PWAs drop the
  session cookie and how we work around it_. This does not contradict the bd rule
  above — the vault is not a `MEMORY.md` and is not for task tracking.
- **When you learn something durable** about this project that isn't already in the
  code, git history, or this file, add an atomic note to the vault rather than
  letting it evaporate at session end. Start from `docs/memory/Home.md` (the map of
  content) to find or create the right place; follow the conventions in
  `docs/memory/README.md` (one idea per note, link with `[[wikilinks]]`, frontmatter
  via `docs/memory/templates/memory-note.md`).
- **Git:** notes are committed (shared); the per-user `docs/memory/.obsidian/` config
  is gitignored.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- **No AI attestations or co-authoring anywhere.** Do not include `Co-Authored-By:` trailers, `Generated with Claude` footers, `Claude-Session:` links, or any other AI attribution in commit messages, PR titles, PR bodies, code comments, or any other artifact pushed to the repository. This applies to all AI tools and models — Claude, Copilot, GPT, etc.
<!-- END BEADS INTEGRATION -->
