---
tags: [decision, auth, security, dependencies]
created: 2026-10-13
---

# App-owned session cookie, byte-compatible with the old h3 sessions

> TanStack Start 1.169 removed its built-in `useSession`. The app now seals the
> `google-sso` cookie itself with `iron-webcrypto`, in exactly the format h3
> used, so the upgrade logs nobody out.

## Context

Bumping `@tanstack/react-start` from 1.168 to 1.169 ("Start is stable") broke
`bun run build`: `useSession` / `clearSession` were removed from
`@tanstack/react-start/server`. The release notes say apps must pick a session
library and use `getCookie` / `setCookie` themselves, and that existing session
cookies need "a deliberate migration or signing in again with a new cookie
name".

The old implementation was h3 v2's session: the `google-sso` cookie held an iron
`Fe26.2` seal of `{ id, createdAt, data }`, sealed with iron defaults and
`ttl = maxAge`. It was rejected once `now - createdAt > maxAge`.

## Decision

- `src/features/shared/server/session-seal.ts` is a pure module (no TanStack
  imports) that seals and unseals that same `{ id, createdAt, data }` record via
  `iron-webcrypto@1`. A test unseals a real h3-sealed fixture to keep the format
  pinned.
- `src/features/shared/server/session.ts` exposes `getAppSession()`,
  `startNewAppSession()` and `clearAppSession()` on top of TanStack's
  `getCookie` / `setCookie` / `deleteCookie`. `requireSession()` and
  `resolveIsAuthenticated()` sit on top of it.
- **Expiry stays absolute**, as it was under h3: `createdAt` is kept on every
  update, and the cookie dies `maxAge` after sign-in. `resolveUserFromSession`'s
  `expiresAt` stamp still implies a sliding TTL; see bd `ce-018`.

The migration also brought three intentional behaviour changes:

- **No cookie for anonymous visitors.** h3 issued an empty session cookie on
  first read; reading a session now never sets a cookie.
- **Session rotation at sign-in.** The OAuth callback (and the dev-only
  `test-auth` route) call `startNewAppSession`, which always issues a new `id` and
  `createdAt` instead of merging into whatever cookie was already present.
- **Header sessions dropped.** h3 also accepted the sealed session from an
  `x-google-sso-session` request header. That path is gone: cookie only.

## Alternatives

- **iron-session with a new cookie name.** Less code, but everyone signs in
  again, which is painful for iOS home-screen PWAs: each installed app has to
  go through Google OAuth again.
- **Pin TanStack Start to 1.168.x.** Defers the work, but leaves the app on a
  pre-stable line that stops getting fixes.

## Why it matters

Session handling is now app code, not framework code: the cookie format,
expiry and flags (`httpOnly`, `secure` in production, `sameSite=lax`, `path=/`)
live in `session.ts` and are covered by tests there. Changing the sealed shape,
the iron options or the cookie name will invalidate every existing login, so
the h3 fixture test in `session-seal.test.ts` must keep passing unless a forced
re-login is a deliberate choice.
