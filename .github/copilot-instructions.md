# Camera Events v2 — Agent Onboarding Instructions

Trust these instructions. They are validated against the current repo. Only search the codebase if something here is incomplete or proves wrong.

## What this repository is

A self-hosted Progressive Web App (PWA) for browsing [Frigate NVR](https://frigate.video/) motion events and delivering Web Push notifications. Frigate publishes events over MQTT; the app batches them per camera and pushes notifications to subscribed iOS/Android/desktop devices.

- **Size:** ~325 tracked files, ~3.8 MB. Single-package TypeScript project (not a monorepo).
- **Stack:** TanStack Start (SSR) + TanStack Router (file-based) · React 19 · Vite 8 · Tailwind CSS v4 · better-sqlite3 / bun:sqlite · MQTT · Google OAuth (Arctic) · web-push (VAPID) · Serwist service worker.
- **Test stack:** Vitest 4 (jsdom) + Testing Library; Playwright for a small e2e suite (not in PR CI).

## CRITICAL: use Bun, not pnpm/npm

**The package manager is Bun (validated: v1.3.11). `package.json` enforces this via `preinstall: only-allow bun` — `npm`/`pnpm`/`yarn` installs will abort.** Note that `playwright.config.ts`'s `webServer.command` still says `pnpm dev`; that is stale — the e2e suite is not part of PR CI. CI, the Dockerfile, and all scripts use Bun. Node.js v22 is present but Bun is the runtime for CI and production.

## Build, test, and validate

Run these from the repo root. **Always run `bun install --frozen-lockfile` first in a fresh checkout** — no command works without `node_modules`. Validated command sequence and timings:

| Step         | Command                         | Time  | Notes                                                           |
| ------------ | ------------------------------- | ----- | --------------------------------------------------------------- |
| Install      | `bun install --frozen-lockfile` | ~100s | Required first. Do not edit `bun.lock` by hand.                 |
| Type check   | `bun x tsc --noEmit`            | ~7s   | Strict mode; `noUnusedLocals`/`noUnusedParameters` on.          |
| Lint         | `bun run lint`                  | ~10s  | Runs `eslint` (TanStack config).                                |
| Format check | `bun x prettier --check .`      | ~5s   | CI fails on unformatted files. Auto-fix with `bun run check`.   |
| Test         | `bun x vitest run`              | ~17s  | 765 tests (unit project, jsdom). No Playwright needed for this. |
| Build        | `bun run build`                 | ~4s   | See build note below.                                           |

- **`bun run check`** runs `prettier --write . && eslint --fix` — the fastest way to satisfy the format + lint gates before pushing.
- **Build note:** `bun run build` = `vite build && cp -r src/features/shared/server/frigate/assets .output/server/_ssr/`. The asset copy step is required; the build is incomplete without it. Do not run `vite build` alone.
- **Tests need no live services.** They stub `fetch`, `process.env`, and use fake timers. The `bun x playwright install --with-deps` line in CI is only for browser-mode capability; `bun x vitest run` (the unit suite) passes without it.
- **Dev server:** `bun run dev` (port 3000). Use `FRIGATE_MOCK=true` to run without a real Frigate/MQTT backend. Copy `.env.example` to `.env` for local config.

### NEVER run `npx tsr generate`

`src/routeTree.gen.ts` is committed and regenerated automatically by the `tanstackStart()` Vite plugin during `bun run dev`/`bun run build`. The `tsr` npm package is an unrelated destructive tool that **deletes** test files and `vite.config.ts`. Do not run it.

## What CI checks (must pass before merge)

`.github/workflows/pr.yml` runs on PRs to `main`. If any `.ts/.tsx/.js/.jsx` file changed, three jobs run:

1. **code_quality** — `bun install --frozen-lockfile` → `bun x tsc --noEmit` → `bun run lint` → `bun x prettier --check .`
2. **tests** — install → `bun x playwright install --with-deps` → `bun x vitest run`
3. **docker_build** — `docker build .` (always runs).

**Replicate CI locally before pushing:** `bun x tsc --noEmit && bun run lint && bun x prettier --check . && bun x vitest run`. All four are validated passing on a clean checkout.

A **husky `pre-push` hook** mirrors code_quality (`tsc --noEmit` · `lint` · `prettier --check`) and blocks the push on failure. **pre-commit** runs `lint-staged` (Prettier write on staged files). Do not use `--no-verify` to bypass.

## Project layout

```
src/
  routes/                    # File-based routes (TanStack Router). API routes under routes/api/.
    __root.tsx               # Root layout; getCurrentUserFn populates context.user
    _authenticated.tsx       # Auth-guard layout (client nav only — see auth note)
    routeTree.gen.ts         # GENERATED — never edit or run tsr on it
  features/                  # Feature-sliced architecture (see rule below)
    shared/                  # ONLY place for cross-feature code
      server/                # Server-only: session.ts, frigate/, sqlite/, favorites/, health
        frigate/validation.ts# isValidCameraName / isValidEventId (SSRF/path-traversal guards)
        session.ts           # requireSession()
        sqlite/index.ts      # openSqlite() — branches Node(better-sqlite3)/Bun(bun:sqlite)
    auth/ cameras/ camera-events/ camera-details/ favorites/ home/
    push-notifications/      # MQTT subscriber, event batcher, push dispatcher
    settings/ shell/
  server.ts                  # Server entry; starts MQTT subscriber
  sw.ts, sw-push-handlers.ts # Service worker source (built by vite-plugin-sw.ts)
  styles.css                 # Tailwind v4 @theme tokens + dark-mode
```

Config files (root): `package.json` (scripts/deps), `tsconfig.json` (paths `#/*` and `@/*` → `./src/*`), `vite.config.ts` (Vitest `unit` project config lives here), `eslint.config.js`, `prettier.config.js`, `knip.json`, `playwright.config.ts`, `Dockerfile`, `docker-compose.yml`, `.env.example`. Feature design docs are in `docs/specs/`.

## Non-negotiable project rules (enforced by review / tests)

- **Feature isolation:** a feature under `src/features/<x>/` must NEVER import from another feature. Shared logic goes in `src/features/shared/`. Prefer duplication over cross-feature coupling.
- **Imports:** use the `#/features/...` alias for cross-directory imports within `src/` (both `#/*` and `@/*` map to `./src/*`).
- **Server-function auth:** every `createServerFn` handler touching protected data MUST call `await requireSession()` (from `#/features/shared/server/session`) as its first line. Route guards do NOT protect server functions — they're callable directly via HTTP at `/_serverFn/{hash}`. Validate user input with `isValidEventId()` / `isValidCameraName()` before using it in Frigate URLs.
- **SSR safety:** never read `window`/`navigator`/`document`/`Notification`/`localStorage` during render — it breaks hydration. Defer to `useEffect` with safe defaults.
- **TDD required:** write a failing test first (Red → Green → Refactor). Test files live next to source as `<name>.test.ts(x)` — no `__tests__/` dirs. One top-level `describe` per exported symbol. Import `describe/it/expect/vi` explicitly from `vitest` (no globals, no `@jest/*`).
- **Tailwind:** prefer canonical utilities (`text-(--sea-ink)`, `min-h-11`, `rounded-4xl`) over arbitrary-value syntax when a built-in exists.
- **No AI attributions** in commit messages, PR titles/bodies, code comments, or any pushed artifact (no `Co-Authored-By`, no "Generated with" footers).

## Common pitfalls (already validated)

- Running `npm`/`pnpm install` → aborts via `only-allow bun`. Use `bun`.
- Forgetting the asset copy → run `bun run build`, never bare `vite build`.
- Editing `routeTree.gen.ts` by hand → it's regenerated; add a route file and run `bun run dev` instead.
- Unformatted code → `bun run check` fixes format + lint in one step.
- `bun install` (without `--frozen-lockfile`) may modify `bun.lock`; use the frozen form to match CI. Note: `bunfig.toml` enforces a 7-day `minimumReleaseAge` on new packages.
