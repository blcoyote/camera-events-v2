---
tags: [glossary]
created: 2026-06-29
---

# Glossary

Tooling and project terms. Domain terms live in [CONTEXT.md](../../CONTEXT.md).

- **VAPID** — the key pair authenticating Web Push. Push is silently off if any
  VAPID env var is missing.
- **Standalone (iOS)** — a PWA launched from the iOS home screen. Has distinct
  cookie / service-worker behavior that cross-platform features must account for.
- **Feature slice** — a self-contained folder under `src/features/` owning all of
  its code. Slices never import from each other; shared code lives in
  `src/features/shared/`.
- **Server function** — a `createServerFn` handler. Directly callable over HTTP at
  `/_serverFn/{hash}`, so each must call `requireSession()` itself.

## Related

- [[Home]]
- [[architecture/system-overview]]
