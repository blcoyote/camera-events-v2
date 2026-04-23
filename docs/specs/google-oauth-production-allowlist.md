# Google OAuth Production Mode with Email Allowlist

## Problem

The Google OAuth consent screen is currently in **testing mode**, which restricts access to a manually-added list of test users in the Google Cloud Console. Testing mode has operational drawbacks:

- 100 test-user cap
- Refresh tokens expire after 7 days (forces frequent re-login)
- Unverified-app warning screen on first sign-in
- Cannot be shared with users outside the test-user list

Publishing the OAuth app to **production mode** removes all of these limits — but production mode has **no built-in access control**. Any Google account holder could complete the OAuth flow. Because this app exposes private camera footage and event data, unrestricted access is unacceptable.

We need to move to production mode while retaining a hard access gate equivalent to (or stronger than) the current test-user list.

## Approach

Enforce access control at the **application layer** by checking the verified email from the Google ID token against an allowlist in the OAuth callback handler — the single chokepoint every sign-in passes through. If the email is not on the allowlist, the callback rejects the sign-in and redirects to the login screen with an explanatory error, **without writing a session cookie**.

This is the standard pattern for invite-only apps on Google OAuth. It layers on top of the existing checks (issuer, audience, expiry, `email_verified`) and does not replace them.

### Why this location

The callback at [src/routes/api/auth/google/callback.ts](../../src/routes/api/auth/google/callback.ts) is the only path that creates a session. Route guards (`requireSession()`) only verify that _someone_ is signed in — they cannot distinguish an authorized user from an unauthorized one. The decision has to happen before the session is written.

### Fail-closed default

If the `ALLOWED_EMAILS` env var is missing or empty, the allowlist check rejects everyone. This ensures that a misconfigured deploy locks the app down rather than opening it up. A forgotten env var should never silently disable access control.

## Alternatives Considered

1. **Google Workspace `hd` (hosted domain) restriction.** Rejected — requires everyone to be on the same Workspace domain. Does not work for mixed personal Gmail accounts, which is the current use case.
2. **Allowlist in a committed JSON/text file.** Rejected — puts user emails in git history (minor PII leak) and couples deploy cadence to allowlist changes. Env var composes with the existing env-based secrets (`APP_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`).
3. **Third-party IdP (Auth0, Clerk, WorkOS).** Out of scope for this change. Considered for a future migration if the allowlist grows beyond a handful of entries or requires invite flows.
4. **Dev-mode escape hatch (skip allowlist when `NODE_ENV !== 'production'`).** Open question — see below.

## Scope

### In scope

- New env var `ALLOWED_EMAILS` (comma-separated).
- New module `src/features/auth/server/access-control.ts` with pure allowlist functions.
- Allowlist check injected into [src/routes/api/auth/google/callback.ts](../../src/routes/api/auth/google/callback.ts) after the `email_verified` check and before the session is written.
- New error code `not_authorized` surfaced in [src/features/shared/components/AlertBanner.tsx](../../src/features/shared/components/AlertBanner.tsx).
- Unit tests for allowlist parsing and matching.
- Callback test coverage for the rejected-email path.

### Out of scope

- Migration to a third-party IdP.
- Admin UI for managing the allowlist.
- Per-user roles or permissions (the app currently has a single "authenticated" tier).
- Domain-wildcard matching (may be added later — see open questions).
- Audit log persistence beyond `console.warn` to stdout.

## Current Auth Flow (reference)

| Stage    | File                                                                                                   | Purpose                                                    |
| -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Start    | [src/routes/api/auth/google.ts](../../src/routes/api/auth/google.ts)                                   | Build authorization URL, set encrypted state cookie (PKCE) |
| Callback | [src/routes/api/auth/google/callback.ts](../../src/routes/api/auth/google/callback.ts)                 | Exchange code, validate ID token, write session            |
| Session  | [src/features/shared/server/session.ts](../../src/features/shared/server/session.ts)                   | `requireSession()` gates server functions                  |
| Error UI | [src/features/shared/components/AlertBanner.tsx](../../src/features/shared/components/AlertBanner.tsx) | Maps `?error=...` query param to user-facing message       |

Existing error codes: `login_failed`, `access_denied`, `invalid_state`. A new `not_authorized` code will be added so rejected users see a specific "not on the list" message rather than a generic failure.

## Implementation Plan

### 1. Allowlist module

Create `src/features/auth/server/access-control.ts`:

- `parseAllowlist(raw: string | undefined): Set<string>` — split on comma, trim, lowercase, drop empties.
- `isEmailAllowed(email: string, allowlist: Set<string>): boolean` — lowercase compare; returns `false` when allowlist is empty (fail-closed).
- `getAllowlist(): Set<string>` — reads `process.env.ALLOWED_EMAILS` lazily (matches the lazy-env pattern used in [google-oauth.ts](../../src/features/auth/server/google-oauth.ts)).

Pure functions, straightforward to unit-test. Dedicated module keeps `google-oauth.ts` focused on token handling and gives a clean seam for later swapping the source (DB, config service) without touching the callback.

### 2. Callback integration

In [src/routes/api/auth/google/callback.ts](../../src/routes/api/auth/google/callback.ts), after the `email_verified` check (line 91) and before `parseIdTokenClaims` (line 93):

```ts
const email = String(idTokenClaims.email ?? '')
if (!isEmailAllowed(email, getAllowlist())) {
  deleteCookie(OAUTH_STATE_COOKIE_NAME)
  return redirectTo('/?error=not_authorized')
}
```

### 3. UI message

Add to the `ERROR_MESSAGES` map in [src/features/shared/components/AlertBanner.tsx](../../src/features/shared/components/AlertBanner.tsx):

```ts
not_authorized: 'This account is not authorized to access this app. Contact the administrator if you need access.',
```

### 4. Tests

- `access-control.test.ts` — allowlist parsing (whitespace, casing, empty string, undefined input), `isEmailAllowed` matching, fail-closed behavior when allowlist is empty.
- Extend callback tests (or add a new one) to cover: unauthorized email → redirects to `/?error=not_authorized`, session is **not** written, state cookie is cleared.

### 5. Ops / docs

- Document `ALLOWED_EMAILS` alongside the other auth env vars (`SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`) in whatever env/README file the deploy consumes.
- CLAUDE.md does not need updating — the existing server-function auth rule still holds. The allowlist layers on top.

## Open Questions

1. **Allowlist source** — env var (proposed), or a small JSON/text file that can be edited without redeploy? Env var is simpler and consistent with existing secrets; file is friendlier if the list churns often.
2. **Matching** — exact email only (proposed), or also support `@yourdomain.com` wildcard entries that match any email on a domain?
3. **Fail-closed when unset** — agree with denying everyone if `ALLOWED_EMAILS` is missing? Alternative: dev-mode escape hatch (`NODE_ENV !== 'production'`) so local dev isn't blocked even when the env var isn't set.
4. **Rejection logging** — emit a `console.warn` with the rejected email on each denied login, so attempts show up in server logs for auditing?

## Deployment Steps (once implemented)

1. Set `ALLOWED_EMAILS` in the production environment (comma-separated list of authorized emails).
2. Deploy the code change.
3. Verify an allowed account can sign in; verify a non-allowlisted Google account is rejected with the `not_authorized` banner.
4. Publish the OAuth consent screen to production mode in Google Cloud Console.
5. Monitor server logs for unexpected rejections (possible typos in the allowlist).
