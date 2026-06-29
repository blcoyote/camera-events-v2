---
tags: [architecture]
created: 2026-06-29
---

# System Overview

> How Camera Events v2 fits together end to end.

## Context

Self-hosted PWA for browsing [[glossary|Frigate]] NVR events and delivering
batched Web Push notifications. Single Bun process serves SSR pages, API routes,
and the MQTT → push background pipeline.

## The pieces

- **Frontend / SSR** — TanStack Start + TanStack Router (file-based routes under
  `src/routes/`), React 19, Tailwind v4. Served by Bun (Nitro `bun` preset).
- **Feature-sliced architecture** — each feature owns its components/hooks/server
  logic under `src/features/`. **Features never import from other features**;
  shared code lives in `src/features/shared/`.
- **Auth** — Google OAuth via Arctic; encrypted `google-sso` session cookie.
  Server functions must call `requireSession()` themselves — route guards don't
  protect them.
- **Frigate client** — all calls funnel through
  `src/features/shared/server/frigate/client.ts`, with an in-process cache
  cleared on every MQTT event. `FRIGATE_MOCK=true` swaps in randomized data.
- **Push pipeline** — see [[architecture/push-pipeline]].
- **Storage** — SQLite (`data/camera-events.db`) via a runtime-portable driver
  (`better-sqlite3` under Node/Vitest, `bun:sqlite` in production).

## Why it matters

The hard architectural rules (no cross-feature imports, server-fn auth,
SSR-safe rendering) exist because violating them fails _silently_ — a leaked
server import bloats the client bundle, a missing `requireSession()` exposes
data over `/_serverFn/{hash}`, and a browser global during render breaks
hydration. These are documented in `CLAUDE.md`; the _gotchas_ are captured here.

## Related

- [[architecture/push-pipeline]]
- [[gotchas/ssr-hydration-browser-globals]]
- [[Home]]
