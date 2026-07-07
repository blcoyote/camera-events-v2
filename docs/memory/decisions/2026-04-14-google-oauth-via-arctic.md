---
tags: [decision, auth, security]
created: 2026-04-14
---

# Google login uses Arctic for OAuth, TanStack Start sessions for cookies

> Google Sign-In runs through the `arctic` OAuth client library; identity is
> carried in an encrypted `useSession` cookie, never in a client-visible token.

## Context

The app needed login without standing up a user database. Session identity
(Google `sub`, first name, email, avatar) had to live server-side only, with
the browser holding nothing but an opaque cookie.

## Decision

- **Library:** `arctic` (`^3.7.0`) drives the OAuth 2.0 / OIDC exchange with
  Google — building the authorization URL and exchanging the code for tokens.
  No hand-rolled OAuth.
- **Flow:** `GET /api/auth/google` (`src/routes/api/auth/google.ts`) builds the
  Google authorization URL and redirects → Google → `GET
/api/auth/google/callback` (`src/routes/api/auth/google/callback.ts`)
  exchanges the code, validates the ID token, writes the session cookie,
  redirects → `POST /api/auth/logout` clears the session.
- **Two cookies, two purposes:**
  - `oauth_state` — holds `state` + PKCE `codeVerifier` + optional `returnTo`,
    JSON-then-base64 encoded (`buildOAuthState`/`parseOAuthState` in
    `src/features/auth/server/auth.ts`), then AES-256-GCM encrypted
    (`encryptOAuthState`/`decryptOAuthState` in
    `src/features/auth/server/auth-crypto.ts`) before being set. 5-minute TTL,
    `httpOnly`, `sameSite: lax`. The GCM key is derived from `SESSION_SECRET`
    via HKDF, so no separate secret to manage.
  - `google-sso` — the actual session, written via TanStack Start's
    `useSession` (`src/features/shared/server/session.ts`). 7-day TTL,
    `httpOnly`, `secure` in production, `sameSite: lax`. Every read that
    resolves a user (`resolveUserFromSession` in `auth.ts`) also calls
    `session.update()`, sliding the 7-day TTL forward on activity rather than
    expiring 7 days after the original login.
- **Open-redirect defense:** `returnTo` is validated by `sanitizeReturnTo()`
  (`auth.ts`) — must start with `/`, not `//`, no backslashes, and must parse
  as same-origin against a fixed dummy base. Applied once when accepting the
  query param and again (defense-in-depth) when reading it back out of the
  decrypted state cookie before redirecting.
- **`SESSION_SECRET` validated at call time:** `getSessionConfig()`
  (`session.ts`) reads and length-checks (`>= 32` chars) `SESSION_SECRET`
  inside the function body, not at module scope, so the check runs per-request
  instead of during SSR module init (which would run before env is guaranteed
  loaded).
- **`requireSession()`** (`session.ts`) returns the session's `sub` or throws
  `Unauthorized`. Every `createServerFn` that touches protected data calls it
  first — route-level guards only stop client navigation, not direct calls to
  the server function endpoint.
- ID token gets defense-in-depth checks (`validateIdTokenClaims` in
  `google-oauth.ts`: issuer, audience, expiry) and an `email_verified` check in
  the callback, even though JWKS signature verification is skipped (token
  comes straight from Google's token endpoint over TLS, per OIDC §3.1.3.7).

## Alternatives considered

- Hand-rolled OAuth 2.0 client — rejected in plan review in favor of `arctic`.
- `iron-session` / raw `jose` JWT cookies — superseded by using TanStack
  Start's built-in `useSession`, which already does encrypted, signed cookies.

## Deviation from the plan

- **PKCE was explicitly out of scope** in the original google-sso-login plan
  (removed; see git history) ("not
  required for server-side confidential clients"). The shipped code uses PKCE
  anyway (`generateCodeVerifier`, `codeVerifier` threaded through
  `createAuthorizationURL` and `validateAuthorizationCode`) because arctic
  3.x's Google provider requires a `codeVerifier` argument — the library left
  no non-PKCE path. The plan's scoping call didn't survive contact with the
  dependency's API.
- **The `oauth_state` cookie is encrypted**, not just base64-encoded as the
  plan assumed (it only specified `HttpOnly`/`SameSite=Lax`/5-minute TTL, no
  encryption). The implementation added AES-256-GCM on top, keyed off
  `SESSION_SECRET`.
- **Server-only auth code moved out of the plan's proposed `src/server/`
  location** into `src/features/auth/server/` (OAuth/crypto) and
  `src/features/shared/server/session.ts` (session config, `requireSession`).
  The plan flagged `src/server/` as a deliberate one-off convention; the
  feature-sliced architecture adopted afterward superseded it.
- **`requireSession()` for direct server-function auth** isn't in the
  original plan at all — the plan only specified `getCurrentUserFn` for
  populating root-route context. `requireSession()` was added later to close
  the direct-HTTP-call gap on `createServerFn` endpoints (see the
  server-function auth rule in `CLAUDE.md`).

## Why it matters

- PKCE plus the `state`/`oauth_state` cookie together stop CSRF on the
  callback: an attacker can't complete a login on a victim's session without
  both the correct `state` and the encrypted `codeVerifier` the victim's
  browser holds.
- Call-time (not module-scope) validation of `SESSION_SECRET` matters
  specifically because of SSR: module-scope env reads can execute during
  server bundle init, before the runtime has guaranteed env vars are loaded —
  failing there would break the whole server, not just the auth path.
- `sanitizeReturnTo()` is the only thing stopping the login flow from being
  turned into an open redirect via a crafted `returnTo` query param.
- This ADR covers _how_ login is implemented, not _who_ is allowed to log in
  — that's a separate control, see below.

## Related

- [[Home]]
- [[decisions/2026-07-07-login-allowlist-in-google-cloud]] (the allow-list
  lives in Google Cloud, not app code)
