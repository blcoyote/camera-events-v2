---
tags: [decision, security, auth]
created: 2026-04-14
---

# Every protected server function checks its own session

> Route guards like `_authenticated.tsx` only stop client-side navigation.
> Each `createServerFn` handler must call `requireSession()` itself.

## Context

TanStack Start compiles every `createServerFn` into an HTTP endpoint at
`/_serverFn/{hash}`. That hash isn't secret — it ships in the client JS bundle,
so anyone can find it and `curl` the endpoint directly, bypassing the React
router entirely. A `beforeLoad` guard on `_authenticated.tsx` never runs for
that request; it only fires when TanStack Router mounts the route client-side.
So a handler that "lives under" an authenticated route is not actually gated
by that route.

## Decision

Every `createServerFn` handler that touches protected data calls
`await requireSession()` (`src/features/shared/server/session.ts`) as its
first operation, before any other work. `requireSession()` reads the
`google-sso` session cookie and throws `'Unauthorized'` if there's no `sub`.
No handler relies on the route hierarchy for this.

Handlers that also take user input validate it themselves too, using
`isValidCameraName()` / `isValidEventId()`
(`src/features/shared/server/frigate/validation.ts`) — since the handler is
reachable directly over HTTP, its own `inputValidator` is the only real
trust boundary before that input reaches a Frigate URL path.

Real examples:

- `loadEventFn` (`src/features/camera-details/server/load-event.ts`) calls
  `requireSession()` then `isValidEventId(eventId)` before calling
  `getEvent()`.
- `loadCamerasFn` (`src/features/cameras/server/load-cameras.ts`) calls
  `requireSession()` before `getCameras()` (no user input to validate).

## Why it matters

Security-through-obscurity doesn't apply here — the hash isn't hidden, it's
in the bundle. Treating route placement as an access control is the mistake
this rule exists to prevent: it's easy to assume "this server fn is only
imported by an authenticated route" is the same as "this server fn is
protected," and it isn't. Checking the session inside the handler is the only
check that actually runs on every code path that reaches it. Per-handler input
validation is the same defense-in-depth logic applied to SSRF/path-traversal
instead of auth: the handler is the last line of defense, not the route.

## Related

- [[Home]]
- [[decisions/2026-07-07-login-allowlist-in-google-cloud]]
