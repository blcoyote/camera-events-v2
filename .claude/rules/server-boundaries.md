---
paths:
  - 'src/features/*/server/**'
  - 'src/routes/**'
---

# Server/client boundaries

- Files in `server/` that touch DB, session, Frigate or secrets start with `import '@tanstack/react-start/server-only'`.
- `createServerFn` wrappers (`*-fns.ts`, `load-*.ts`) have no top-level imports of server-only modules; use `await import('./x-handlers')` inside the handler, and call `await requireSession()` first.
- Route loaders call server functions only — never `requireSession()` or server modules directly.
- Never put secrets behind a `VITE_` prefix.
- Full playbook: the `tanstack-start-boundaries` skill.
