---
tags: [decision, auth, security, ios, pwa]
created: 2026-07-29
---

# Session lifetime is 30 days, refreshed proactively from a client-visible expiry

> The session cookie's rolling TTL is **30 days** (was 7), the iOS standalone
> reload threshold is **1 hour** (was 6), and `SessionData` now carries an
> `expiresAt` stamp so the client can renew _before_ the cookie lapses.

## Context

The session cookie (`google-sso`) has always had a sliding TTL:
`resolveUserFromSession` re-issues it on every `getCurrentUserFn()`, which runs
in `__root.tsx`'s `beforeLoad`, so every page load pushes expiry forward.

That slide does not work on iOS standalone PWAs. `Set-Cookie` headers on
XHR/fetch (server-function) responses are not reliably persisted there, so
client-side navigations never renew the cookie — only a full page reload, whose
SSR navigation response iOS _does_ persist, has any effect. `useSessionRefresh`
was built for exactly this, forcing a reload on foreground at most once per
threshold.

Two gaps remained:

1. **The refresh was purely reactive.** It fired only after an idle gap. A user
   who opens the app briefly but often would keep resetting the "last refreshed"
   stamp without ever crossing the idle threshold, so on iOS the cookie could
   still march to its hard expiry while the app was in regular use.
2. **The client could not see expiry at all.** The cookie is `httpOnly`, so
   nothing client-side knew how much lifetime was left; there was no way to act
   on "expiring soon" as opposed to "user was away a while."

The trigger was asking whether an expiring session could auto-redirect through
Google and refresh silently (OIDC `prompt=none`).

## Decision

Attack the lifetime problem before the re-auth problem:

- `SESSION_MAX_AGE_SECONDS`: 7 days → **30 days**.
- `SESSION_REFRESH_THRESHOLD_MS`: 6h → **1h**.
- `SessionData.expiresAt?: number` (epoch ms), stamped in
  `resolveUserFromSession` — the single place the TTL slides is the single place
  the stamp is written. Always recomputed from `now`, never carried over from the
  cookie. Optional, so sessions issued before the field existed stay valid and
  acquire it on their next page load.
- `needsSessionRefresh` gained a second, proactive trigger: refresh when the
  cookie is within `SESSION_EXPIRY_REFRESH_WINDOW_MS` (24h) of lapsing,
  regardless of how recently it last refreshed — floored by
  `SESSION_REFRESH_MIN_INTERVAL_MS` (5 min) so a cookie that fails to renew
  cannot reload the app on every single foreground.
- `getHeaderAuthState` returns `sessionExpiresAt`, keeping the wiring covered by
  the existing pure-function test rather than adding a render harness.

**Silent `prompt=none` re-auth was explicitly deferred**, not rejected.

## Alternatives

- **Silent re-auth via OIDC `prompt=none`** (the original question). Works on
  desktop/Android: append `prompt=none` + `login_hint` to the Arctic
  authorization URL and Google returns a code with no UI if the Google session
  and consent are still live. Deferred because a longer rolling TTL removes most
  of the need at a fraction of the risk, and because it needs a `login_hint`
  stashed client-side, a loop guard for `login_required` /
  `interaction_required` / `consent_required`, and careful handling to avoid
  redirect loops.
- **Hidden-iframe silent renew** (the classic OIDC pattern). Not possible —
  Google refuses to be framed on its authorization endpoint. Any silent renewal
  must be a top-level redirect.
- **Automatic redirect to Google on iOS standalone.** Rejected: `useStandaloneAuth`
  exists precisely because OAuth through an external origin loses cookies under
  iOS standalone isolation, so it punts sign-in to the system browser via
  `window.open` — which is popup-blocked without a user gesture. Fully automatic
  re-auth is unreachable on iOS; the best achievable there is a one-tap
  "session expired, tap to reconnect" banner.
- **A `POST /api/auth/refresh` endpoint.** Doesn't help the platform that needs
  it: iOS's problem is fetch-response `Set-Cookie` persistence, so only a full
  reload renews. The existing reload trick already is the workaround.

## Why it matters

The 30-day TTL is a deliberate **security-posture** change: a stolen session
cookie is valid four times longer than before. Accepted for a self-hosted family
camera app behind a Google Cloud login allow-list
([[decisions/2026-07-07-login-allowlist-in-google-cloud]]), where being silently
logged out of a camera feed is the more likely real-world harm. Revisit if the
access model ever widens.

`SESSION_MAX_AGE_SECONDS` and `computeSessionExpiry` live in
`src/features/shared/utils/sessionTtl.ts`, **not** in `shared/server/session.ts`.
This is load-bearing: `resolveUserFromSession` is a plain exported function, not
a stripped `createServerFn` handler body, so importing the expiry helper from
`session.ts` pulled `@tanstack/react-start/server` into the client graph and
import protection failed the build. Session lifetime arithmetic is genuinely
isomorphic — the server stamps it, the client reasons about it — so it belongs in
an isomorphic module. Do not move it back.

## Related

- [[Home]]
- [[decisions/2026-04-17-cross-platform-pwa-first]] — iOS/Android/desktop parity
  is a hard constraint; this is why the fix is a reload, not a fetch.
- [[decisions/2026-04-14-google-oauth-via-arctic]]
- [[decisions/2026-04-14-server-client-code-segmentation]]
- Deferred follow-up: silent `prompt=none` re-auth (desktop/Android) and a
  one-tap session-expired banner with `returnTo` preservation (iOS + universal
  fallback).
