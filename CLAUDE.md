# Project Instructions

## Project Overview

Camera Events v2 is a self-hosted PWA for browsing and monitoring [Frigate NVR](https://frigate.video/) events. It receives live motion events from Frigate over MQTT, batches them per camera, and delivers Web Push notifications to subscribed iOS/Android/desktop devices. Built with TanStack Start (SSR), React 19, Tailwind CSS v4, and deployed via Bun.

**Tech stack:** TanStack Start + TanStack Router (file-based, SSR) · React 19 · Vite 8 · Tailwind CSS v4 · better-sqlite3 / bun:sqlite · MQTT (RabbitMQ) · Google OAuth via Arctic · web-push (VAPID) · Serwist service worker · Vitest + Playwright + Storybook

**Package manager:** Bun (enforced via `preinstall: only-allow bun`). Use `bun` for all installs and script runs.

## Path Aliases

- `#/*` maps to `./src/*` (defined in `package.json` `imports` and `tsconfig.json` `paths`).
- Always use `#/features/...` for cross-directory imports within `src/`.

## Development Commands

```bash
bun install
bun run dev          # Dev server on :3000 (auto-regenerates routeTree)
bun run build        # Production build
bun run preview      # Serve production build locally
bun run test         # Vitest (unit + Storybook browser tests)
bun run lint         # ESLint
bun run format       # Prettier check
bun run check        # Prettier write + ESLint --fix
bun run storybook    # Component explorer on :6006
bun run knip         # Unused-code report
```

## Route Generation

- **NEVER run `npx tsr generate`**. The `tsr` npm package is an unrelated unused-code removal tool that will **delete** test files, story files, Storybook config, and `vite.config.ts`. Running it with `--write` is destructive and irreversible without git.
- Route tree generation (`src/routeTree.gen.ts`) is handled automatically by the `tanstackStart()` Vite plugin during `bun run dev` and `bun run build`. No separate CLI step is needed.
- If you add a new route file under `src/routes/`, start the dev server (`bun run dev`) to trigger route tree regeneration.

## Feature-Sliced Architecture

- The codebase uses a vertical feature-slice architecture. Each feature lives in its own folder under `src/features/` and owns all of its components, hooks, utilities, types, and server logic.
- **Features must never import from other features.** No cross-feature imports are allowed — if two features need the same logic, it belongs in `src/features/shared/`.
- `src/features/shared/` is the only place for code that is used by multiple features. Shared code should be genuinely reusable, not a dumping ground for convenience.
- When creating a new feature, give it its own folder under `src/features/` with everything it needs. Prefer duplication over coupling between features.

### Feature Map

| Feature              | Location                           | What it owns                                                                                       |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `auth`               | `src/features/auth/`               | Google OAuth flow, session helpers, `useStandaloneAuth` hook                                       |
| `camera-events`      | `src/features/camera-events/`      | Event list/detail pages, snapshot lightbox, clip/snapshot/thumbnail proxies, mock data             |
| `cameras`            | `src/features/cameras/`            | Camera grid page, sortable tiles, camera order persistence, snapshot proxy                         |
| `home`               | `src/features/home/`               | Home/landing page component                                                                        |
| `push-notifications` | `src/features/push-notifications/` | MQTT subscriber, event batcher, push dispatcher, SQLite push store                                 |
| `settings`           | `src/features/settings/`           | Settings page, notification preferences UI, `usePushSubscription` hook                             |
| `shared`             | `src/features/shared/`             | Frigate API client + cache + types + validation, session, SQLite driver, shared components + hooks |
| `shell`              | `src/features/shell/`              | App header, theme toggle, service worker registration                                              |

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

## Reference Docs

Detailed guidance lives in topic-specific files — read the relevant one before working in that area:

- @docs/claude/testing.md — TDD cycle, Vitest setup, mocking patterns, test variants
- @docs/claude/pwa-ssr.md — Cross-platform PWA rules, SSR/hydration constraints, Tailwind CSS
- @docs/claude/auth-security.md — Server function auth, Google OAuth flow
- @docs/claude/backend.md — Frigate client, MQTT pipeline, SQLite driver
- @docs/claude/deployment.md — Docker, Bun runtime, environment variables

Feature design documents (problem statements, trade-offs) live in `docs/specs/`. Review the relevant spec before modifying a feature.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

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
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
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
<!-- END BEADS INTEGRATION -->
