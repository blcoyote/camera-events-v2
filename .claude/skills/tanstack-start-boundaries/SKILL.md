---
name: tanstack-start-boundaries
description: TanStack Start server/client code segmentation. Use whenever writing or reviewing route loaders, server functions, components, or any module that might contain server-only code (DB access, secrets, session helpers). Prevents server code from leaking into client bundles.
role: worker
user-invocable: false
---

# TanStack Start Server/Client Boundaries

## The Core Problem

All code in TanStack Start is **isomorphic by default** — it runs in both server and client bundles unless explicitly constrained. This means a module that imports from `better-sqlite3`, reads `process.env.SESSION_SECRET`, or calls `requireSession()` will be included in the client bundle unless you actively prevent it.

The bug pattern: a `createServerFn` handler imports a server-only helper, that helper is in a shared module, the module gets tree-shaken into the client bundle, and the app either crashes or silently exposes secrets.

---

## The Two Execution Environments

| Environment | When it runs                            | What's available                                       |
| ----------- | --------------------------------------- | ------------------------------------------------------ |
| **Server**  | SSR, API requests, build time           | Node.js APIs, `process.env`, DB drivers, file system   |
| **Client**  | Post-hydration, navigation, user events | Browser APIs, `window`, `localStorage`, `Notification` |

Route loaders (`loader`) run on **both** — on the server during SSR and on the client during client-side navigation. They are isomorphic.

---

## The Four Primitives

### `createServerFn` — RPC boundary (use for data fetching)

The handler runs **only on the server**, but the function reference is safe to call from the client. The compiler rewrites it to an HTTP call when invoked from the client. The handler code is **stripped from the client bundle**.

```ts
import { createServerFn } from '@tanstack/react-start'

export const getEvents = createServerFn().handler(async () => {
  // Safe: this code never ships to the client
  const session = await requireSession()
  return db.events.findAll({ userId: session.userId })
})
```

**Critical rule**: even though the handler is stripped, any module imported at the top level of the file containing `createServerFn` may still leak. Keep server-fn files focused — do not mix server-only imports with shared utility exports in the same file.

### `createServerOnlyFn` — hard crash on client (use for utilities called within server context)

The function throws if called from the client. Use for helpers that are called _within_ server code, not called from component trees.

```ts
import { createServerOnlyFn } from '@tanstack/react-start'

export const getDbSecret = createServerOnlyFn(() => process.env.DB_PASSWORD)
```

This does **not** prevent the module from being imported into the client bundle — it only crashes at call time. Use import protection (below) if you want to block the import itself.

### `createClientOnlyFn` — hard crash on server (use for browser-only utilities)

```ts
import { createClientOnlyFn } from '@tanstack/react-start'

export const saveToStorage = createClientOnlyFn((data: unknown) => {
  localStorage.setItem('cache', JSON.stringify(data))
})
```

### `createIsomorphicFn` — different implementations per environment

Use when a function must exist in both environments but behaves differently.

```ts
import { createIsomorphicFn } from '@tanstack/react-start'

export const logger = createIsomorphicFn()
  .server((msg: string) => console.log(`[SERVER]: ${msg}`))
  .client((msg: string) => console.log(`[CLIENT]: ${msg}`))
```

---

## Import Protection

TanStack Start's import protection runs during dev and build. It analyzes imports and blocks or warns when code crosses environment boundaries.

### File Naming Conventions

The bundler uses file name patterns to enforce environment constraints:

| Pattern                        | Allowed in        | Blocked in                  |
| ------------------------------ | ----------------- | --------------------------- |
| `*.server.ts` / `*.server.tsx` | Server            | Client (causes build error) |
| `*.client.ts` / `*.client.tsx` | Client            | Server (causes build error) |
| No suffix                      | Both (isomorphic) | —                           |

**This project's convention**: server-only files already use `.server.ts` for route files (e.g. `src/features/shared/server/`). New server-only utilities must follow this pattern.

### The `server-only` Marker Import

For files that don't follow the naming convention but must never reach the client, add this import as the first line:

```ts
import '@tanstack/react-start/server-only'
```

This causes a build error if the file is ever imported into a client bundle. Use it as a safety net on any file that handles secrets, DB connections, or session tokens.

```ts
// src/features/shared/server/session.ts
import '@tanstack/react-start/server-only'

export async function requireSession() { ... }
```

### Reading the Import Protection Error

When a boundary violation occurs, the error shows the full import chain:

```
[import-protection] Import denied in server environment

  Denied by file pattern: **/*.client.*
  Importer: src/components/dashboard.tsx:3:30
  Import: "./browser-widget.client"

  Trace:
    1. src/routes/dashboard.tsx:1:32 (import "../components/dashboard")
    2. src/components/dashboard.tsx:3:30 (import "./browser-widget.client")
```

Start at the bottom of the trace — that's the actual violation. The fix is at the importer, not the imported file.

---

## This Project's Layering Rules

These rules align with the feature-slice architecture in `CLAUDE.md`:

### Layer 1 — Server-only modules (`*.server.ts`, marked with `server-only`)

- DB queries, session helpers, Frigate client, push store
- Must never be imported from route files, components, or client hooks
- Examples: `session.ts`, `sqlite/index.ts`, `frigate/client.ts`

### Layer 2 — Server function files (contain `createServerFn`)

- Bridge between Layer 1 and the client
- Import from Layer 1 inside the handler only
- The file itself may be imported from route loaders and components
- Keep these files thin — one concern per file
- Examples: `*-actions.ts`, `*-queries.ts` files in feature directories

### Layer 3 — Isomorphic code (route loaders, shared utilities, types)

- Must not import from Layer 1 or Layer 2
- May use `createIsomorphicFn` for environment-specific behavior
- Examples: route `loader` functions, shared types, validators

### Layer 4 — Client-only code (`*.client.ts`, browser hooks, components)

- May use browser APIs
- Must not import from Layer 1
- Use `createClientOnlyFn` for browser utilities called from isomorphic code

---

## Common Mistakes and Fixes

### Mistake 1: Importing server helpers at module scope in a server-fn file

```ts
// ❌ WRONG — the import pulls the module into the client bundle analysis
import { requireSession } from '#/features/shared/server/session'

export const getEvents = createServerFn().handler(async () => {
  const session = await requireSession()
  return []
})
```

The handler body is stripped, but the top-level import may still cause bundler analysis to pull `session.ts` into scope. Fix: rely on the `.server.ts` file naming convention and the `server-only` marker in `session.ts` to block this at the bundler level. For belt-and-suspenders safety, keep server-fn files in a `.server.ts` file themselves.

```ts
// ✅ CORRECT — put the server fn in its own .server.ts file
// src/features/camera-events/server/list-events.server.ts
import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '#/features/shared/server/session'

export const getEvents = createServerFn().handler(async () => {
  const session = await requireSession()
  return []
})
```

### Mistake 2: Using `VITE_` prefix for secrets

```ts
// ❌ WRONG — VITE_ vars are bundled into the client
const key = import.meta.env.VITE_SECRET_API_KEY
```

```ts
// ✅ CORRECT — access secrets only inside server functions
export const callApi = createServerFn().handler(async () => {
  const key = process.env.SECRET_API_KEY
  return fetch(url, { headers: { Authorization: `Bearer ${key}` } })
})
```

### Mistake 3: Calling `requireSession()` from a route loader without a server boundary

Route loaders run isomorphically — on the server during SSR and the client during navigation. `requireSession()` uses server-only modules. Wrap session checks in `createServerFn`:

```ts
// ❌ WRONG — loader runs on client too
export const Route = createFileRoute('/events')({
  loader: async () => {
    const session = await requireSession() // crashes on client
  },
})

// ✅ CORRECT — session check is inside a server function
const loadEvents = createServerFn().handler(async () => {
  const session = await requireSession()
  return fetchEvents(session.userId)
})

export const Route = createFileRoute('/events')({
  loader: () => loadEvents(),
})
```

### Mistake 4: Shared utility file that mixes server and client exports

```ts
// ❌ WRONG — one import pulls all of this into the client bundle
// src/features/shared/utils.ts
export { formatDate } from './format' // safe
export { requireSession } from './session' // server-only!
export { saveToStorage } from './storage' // client-only!
```

Fix: never re-export from a barrel if the exports have different environment requirements. Keep server, client, and isomorphic exports in separate files.

---

## Pre-Implementation Checklist

Before writing any new module, answer:

1. **What environments does this code run in?** Server only / client only / both?
2. **Does it read `process.env` secrets, access DB, or call `requireSession()`?** → It is server-only. Name it `*.server.ts` and add the `server-only` marker.
3. **Does it use `window`, `localStorage`, `Notification`, or other browser APIs?** → It is client-only. Name it `*.client.ts` or wrap with `createClientOnlyFn`.
4. **Is it a data-fetching bridge (calls server code, invoked from components)?** → Use `createServerFn`. Put the file in `*.server.ts` so the import protection catches any violations.
5. **Does it need different behavior per environment?** → Use `createIsomorphicFn`.

## Pre-Review Checklist

When reviewing code that touches server/client boundaries:

- [ ] Server-only files (`session.ts`, `sqlite/`, `frigate/client.ts`) have the `server-only` marker or `.server.ts` suffix
- [ ] `createServerFn` handlers do not rely on top-level imports of server-only modules in files without `.server.ts` naming
- [ ] Route `loader` functions do not call server-only code directly — they call `createServerFn` functions
- [ ] No `VITE_` prefix on secret environment variables
- [ ] Components that use browser APIs have `useEffect` guards or are in `*.client.tsx` files
- [ ] Barrel files (`index.ts`) do not mix server-only and client-safe exports
- [ ] Any new file accessing DB, session, or secrets has `import '@tanstack/react-start/server-only'` as its first line

---

## When to Load This Skill

Load this skill whenever the task involves:

- Writing or modifying `createServerFn` handlers
- Adding new server-side utilities (DB queries, session checks, API proxies)
- Adding new React hooks or components that use browser APIs
- Debugging a hydration mismatch or "X is not defined" SSR error
- Reviewing code for server/client boundary violations
- Adding new files to `src/features/shared/server/`
