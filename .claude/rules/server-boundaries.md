---
paths:
  - 'src/features/*/server/**'
  - 'src/routes/**'
---

# Server/client boundaries

- Server-only implementation files in `server/` (`*-handlers.ts`, helpers touching DB, session, Frigate or secrets) start with `import '@tanstack/react-start/server-only'`.
- `createServerFn` wrappers (`*-fns.ts`, `load-*.ts`) are client-importable: no `server-only` marker, no top-level imports of server-only modules; use `await import('./x-handlers')` inside the handler. Handlers returning protected data call `await requireSession()` first (public ones like `getCurrentUserFn` don't).
- DB, session and secrets are accessed only in `*-handlers.ts` and server helpers, reached via dynamic import from wrappers; never import them elsewhere.
- Route loaders call server functions only — never `requireSession()` or server modules directly.
- Never put secrets behind a `VITE_` prefix.
- Full playbook: the `tanstack-start-boundaries` skill.
