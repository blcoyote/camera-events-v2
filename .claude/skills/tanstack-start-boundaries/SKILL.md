---
name: tanstack-start-boundaries
description: TanStack Start server/client boundary rules for this repo. Use when writing or reviewing createServerFn handlers, route loaders, files under src/**/server/, or hooks/components that touch browser APIs (window, localStorage, Notification). Prevents server code leaking into client bundles and SSR hydration bugs.
user-invocable: false
---

# TanStack Start Server/Client Boundaries

All code is **isomorphic by default**: it lands in both bundles unless constrained. Route `loader`s run on the server during SSR _and_ on the client during navigation, so they must never touch server-only modules directly.

## This repo's convention (verified in `src/`)

There are **no** `*.server.ts` / `*.client.ts` files. Boundaries are enforced with `server/` directories, a marker import, and a fns/handlers split:

| File                               | Contains                                 | Rules                                                                                                                                            |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/*-handlers.ts`             | DB, session, Frigate, secrets            | First line `import '@tanstack/react-start/server-only'`. Static imports are fine here. Never imported from components, hooks, or loaders.        |
| `server/*-fns.ts` (or `load-*.ts`) | Thin `createServerFn` wrappers           | No top-level imports of server-only modules. Inside the handler use `await import('./x-handlers')`. May be imported from loaders and components. |
| Everything else                    | Components, hooks, loaders, shared types | Must not import server-only modules. Browser APIs only inside `useEffect` or `createClientOnlyFn`.                                               |

Reference pair: `src/features/shared/server/favorites/favorites-fns.ts` → `favorites-handlers.ts`. Another: `src/features/camera-events/server/load-events.ts` (dynamic imports inside the handler).

## Rules

1. **Server-only module?** (touches `process.env` secrets, DB, `requireSession()`, Frigate client) → put it in `server/`, add the `server-only` marker as the first line, call it only from a handler. `*-fns.ts`/`load-*.ts` wrappers are client-importable and never get the marker.
2. **Data bridge for components or loaders?** → `createServerFn` in a `*-fns.ts` file; dynamic-import the handlers, and `await requireSession()` first when it returns protected data (not for public fns like `getCurrentUserFn`, which must serve signed-out visitors). Protected = user-specific data, any write, or anything using server secrets. Examples: public read `getCurrentUserFn` (no session); authenticated read `loadEventsFn`; authenticated write `toggleFavoriteFn`.
3. **Loaders** call `createServerFn` functions only, never `requireSession()` or server modules directly.
4. **No `VITE_` prefix on secrets** — `import.meta.env.VITE_*` is bundled into the client.
5. **No barrel re-exports** that mix server-only and client-safe exports.
6. **Browser APIs** are never read during render. Use safe defaults and a `useEffect` (SSR/hydration must match).
7. `createServerOnlyFn` only throws at call time and does not stop the module being bundled; the `server-only` marker is what blocks the import. Check the current TanStack docs before using `createIsomorphicFn` / `createClientOnlyFn` — none are used in `src/` today.

## Reading an import-protection error

The trace lists the import chain; the violation is at the last importer, so fix it there, not in the imported file.

## Review checklist

- [ ] New server-only files are in `server/` and start with the `server-only` import
- [ ] `*-fns.ts` files have no static imports of server-only modules
- [ ] Every `createServerFn` handler touching protected data calls `await requireSession()` first (see `CLAUDE.md` > Server Function Authentication)
- [ ] Loaders only call server functions
- [ ] No `VITE_`-prefixed secrets; no mixed barrels
- [ ] Browser-API access is behind `useEffect`
