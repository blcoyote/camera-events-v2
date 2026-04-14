# Plan: Google SSO Login

**Created**: 2026-04-13
**Branch**: (no git repo initialized)
**Status**: implemented

## Goal

Add Google SSO authentication to this TanStack Start application. Auth state lives entirely on the backend using TanStack Start's built-in `useSession` (HTTP-only cookie). No database — session stores Google claims (sub, firstName, email, avatarUrl) directly in the encrypted cookie. A protected `/dashboard` route demonstrates route guarding. The header reflects login state.

## Not in Scope

- ID token signature verification (JWKS) — relying on direct HTTPS token endpoint response per OpenID Connect spec
- Token refresh / silent re-authentication
- Multiple OAuth providers (GitHub, Microsoft, etc.)
- Role-based authorization
- Account linking
- PKCE (not required for server-side confidential clients)
- Database persistence — session-only by design
- Google Sign-In button branding compliance (cosmetic; can be refined later)

## Acceptance Criteria

- [ ] Session cookie has `HttpOnly`, `Secure` (in production), `SameSite=Lax` flags
- [ ] Cookie `Max-Age` is 7 days (604800 seconds)
- [ ] Google access/ID tokens never appear in response body, `Set-Cookie` headers, query strings, `localStorage`, or `sessionStorage` sent to the browser
- [ ] Session contains `sub`, `firstName`, `email`, `avatarUrl` after login; if Google omits `given_name` or `picture`, session stores empty string (app does not crash)
- [ ] Cookie is encrypted via `useSession` password-based encryption; a tampered or corrupted cookie is rejected and treated as unauthenticated (no error page, just logged-out state)
- [ ] "Sign in with Google" redirects to `accounts.google.com` with correct `client_id`, `redirect_uri`, `scope=openid profile email`, `response_type=code`, and a `state` CSRF parameter
- [ ] OAuth callback validates the `state` parameter; if missing or mismatched, rejects the request with no session created and redirects to `/?error=invalid_state`
- [ ] Callback exchanges code server-side via `arctic` library, never exposes tokens to client
- [ ] Header shows user's first name + "Sign out" button when logged in; "Sign in with Google" link when logged out
- [ ] Logout clears session cookie, redirects to `/?status=logged_out`; hitting logout when already logged out redirects to `/` without error
- [ ] `/dashboard` renders placeholder content when authenticated; redirects to `/api/auth/google` (which then redirects to Google) when unauthenticated
- [ ] After login initiated from `/dashboard`, user is returned to `/dashboard` (not `/`) via return-to URL stored in `state` parameter
- [ ] Denied consent returns user to app with `/?error=access_denied`, no session created
- [ ] OAuth callback error shows differentiated error message on home page (`access_denied` vs `login_failed`), no session created; error query param is cleaned from URL after display via `replaceState`
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET` (min 32 chars) loaded from `.env` (gitignored) or environment-level config, never hardcoded; app fails fast with clear error if any is missing
- [ ] Error banner has `role="alert"`, keyboard-accessible dismiss button, focus moves to banner on display
- [ ] "Sign in with Google" is an `<a>` element (navigates to `/api/auth/google`); "Sign out" is a `<form>` with submit button (POST to `/api/auth/logout`)

## User-Facing Behavior

```gherkin
Feature: Google SSO Login

  Background:
    Given the application is running
    And Google OAuth is configured with valid credentials

  # --- Login ---

  Scenario: User initiates Google login
    Given the user is not logged in
    When the user clicks the "Sign in with Google" link in the header
    Then the user is redirected to Google's OAuth consent screen

  Scenario: User completes Google login successfully
    Given the user has been redirected to Google's OAuth consent screen
    When the user grants consent with their Google account
    Then the user is redirected back to the application
    And a session cookie is set as HTTP-only with a 7-day lifetime
    And the header displays the user's first name
    And the "Sign in with Google" link is replaced with the user's first name and a "Sign out" button

  Scenario: User denies Google consent
    Given the user has been redirected to Google's OAuth consent screen
    When the user denies consent or cancels the flow
    Then the user is redirected back to the application
    And the user remains unauthenticated
    And no session cookie is set
    And an error banner reads "You declined the Google sign-in request."

  Scenario: User completes login after accessing protected route
    Given the user is not logged in
    And the user navigates to "/dashboard"
    When the user completes Google sign-in
    Then the user is redirected to "/dashboard" (not the home page)

  # --- Session ---

  Scenario: Authenticated user revisits the application
    Given the user has an active session cookie
    When the user navigates to any page
    Then the header displays the user's first name
    And no re-authentication is required

  Scenario: Session cookie expires
    Given the user has a session cookie with an expired Max-Age
    When the user navigates to any page
    Then the user is treated as unauthenticated
    And the header shows the "Sign in with Google" link

  Scenario: Session cookie is tampered with
    Given the user has a session cookie that has been modified
    When the user navigates to any page
    Then the user is treated as unauthenticated
    And the header shows the "Sign in with Google" link

  # --- Protected Route ---

  Scenario: Authenticated user accesses the protected dashboard
    Given the user is logged in
    When the user navigates to "/dashboard"
    Then the dashboard page is displayed with a welcome message

  Scenario: Unauthenticated user accesses the protected dashboard
    Given the user is not logged in
    When the user navigates to "/dashboard"
    Then the user is redirected to "/api/auth/google" which initiates the Google OAuth flow

  # --- Logout ---

  Scenario: User logs out
    Given the user is logged in
    When the user clicks "Sign out"
    Then the session cookie is cleared
    And the user is redirected to the home page
    And a success banner reads "You have been signed out."

  Scenario: Logout when already logged out
    Given the user is not logged in
    When the user submits a request to the logout endpoint
    Then the user is redirected to the home page without error

  # --- Error Handling ---

  Scenario: Google OAuth callback receives an error
    Given the user has been redirected to Google's OAuth consent screen
    When Google returns an error in the callback (e.g., server error)
    Then the user is redirected to the home page
    And an error banner reads "Something went wrong during sign-in. Please try again."
    And no session cookie is set

  Scenario: OAuth callback has invalid CSRF state
    Given the user has been redirected to Google's OAuth consent screen
    When the callback state parameter does not match the stored value
    Then the user is redirected to the home page with an error
    And no session cookie is set
```

## Steps

### Step 0: Fix verbatimModuleSyntax and install dependencies

**Complexity**: trivial
**RED**: N/A (config change)
**GREEN**: Set `verbatimModuleSyntax: false` in `tsconfig.json` (required to prevent server code leaking into client bundles). Install `arctic` (lightweight OAuth 2.0 client). Add `.env.example` with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` placeholders. Verify the project builds cleanly.
**REFACTOR**: None needed
**Files**: `tsconfig.json`, `package.json`, `.env.example`
**Commit**: `fix verbatimModuleSyntax and add auth dependencies`

### Step 1: Session utility and Google OAuth config

**Complexity**: standard
**RED**: Write test that `useAppSession` returns a session object with the correct shape. Write test that `getGoogleOAuthConfig` returns a configured `Google` provider from arctic. Write tests for pure helpers: `buildAuthorizationUrl` produces correct URL with state and scopes; `parseIdTokenClaims` extracts `sub`, `firstName`, `email`, `avatarUrl` from a JWT payload (handling missing `given_name`/`picture` gracefully).
**GREEN**: Create `src/server/session.ts` — export `useAppSession()` wrapping TanStack Start's `useSession<SessionData>` with `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `maxAge: 604800`. Export `SessionData` type (`{ sub, firstName, email, avatarUrl }`). Env vars accessed only inside server function/handler context, never at module scope. Create `src/server/google-oauth.ts` — export `Google` provider instance from arctic, plus pure helper functions for URL building and claim parsing. Validate env vars lazily on first use inside handlers.
**REFACTOR**: None needed
**Files**: `src/server/session.ts`, `src/server/session.test.ts`, `src/server/google-oauth.ts`, `src/server/google-oauth.test.ts`, `.env.example`
**Commit**: `add session utility and Google OAuth config with arctic`

### Step 2: Server routes for OAuth flow (login, callback, logout)

**Complexity**: complex
**RED**: Write test that GET `/api/auth/google` returns a redirect to Google with correct query params (`client_id`, `redirect_uri`, `scope`, `response_type=code`, `state`) and sets an `oauth_state` cookie. Write test that GET `/api/auth/google/callback` with valid code and matching state sets session cookie and redirects to `/`. Write test that callback redirects to stored `returnTo` URL when present in state. Write test that callback redirects to `/?error=access_denied` when `error` query param is present. Write test that callback redirects to `/?error=login_failed` when token exchange fails. Write test that callback redirects to `/?error=invalid_state` when state param is missing or mismatched. Write test that POST `/api/auth/logout` clears session and redirects to `/?status=logged_out`. Write test that POST `/api/auth/logout` when no session exists redirects to `/` without error. Write test that response body/headers from callback never contain `access_token` or `id_token`.
**GREEN**: Create `src/routes/api/auth/google.ts` using `createFileRoute` with `server: { handlers: { GET } }` — builds Google authorization URL via arctic, generates random `state`, encodes `returnTo` URL in state, sets `oauth_state` cookie (HttpOnly, SameSite=Lax, maxAge=300s), returns `Response` with 302 redirect. Create `src/routes/api/auth/google/callback.ts` — validates state against `oauth_state` cookie, exchanges code for tokens via arctic, calls `parseIdTokenClaims`, writes session via `useAppSession`, clears `oauth_state` cookie, redirects to `returnTo` or `/`. Create `src/routes/api/auth/logout.ts` using POST handler — clears session, redirects to `/?status=logged_out`.
**REFACTOR**: Extract state cookie helpers if handlers are too long
**Files**: `src/routes/api/auth/google.ts`, `src/routes/api/auth/google/callback.ts`, `src/routes/api/auth/logout.ts`, `src/server/auth.test.ts`
**Commit**: `add server routes for Google OAuth login, callback, and logout`

### Step 3: getCurrentUser server function and typed root route context

**Complexity**: standard
**RED**: Write test that `getCurrentUserFn` returns session data when session exists. Write test that `getCurrentUserFn` returns `null` when no session. Write test that `getCurrentUserFn` returns `null` (not throws) when session cookie is corrupted.
**GREEN**: Create `getCurrentUserFn` in `src/server/auth.ts` as a `createServerFn` — reads session via `useAppSession`, returns `SessionData | null`, wraps session read in try-catch (corrupted cookie → return null and clear cookie). Switch `src/routes/__root.tsx` from `createRootRoute` to `createRootRouteWithContext<{ user: SessionData | null }>()`. Add `beforeLoad` that calls `getCurrentUserFn` and returns `{ user }`. Update `src/router.tsx` to pass initial context.
**REFACTOR**: None needed
**Files**: `src/server/auth.ts`, `src/server/auth.test.ts`, `src/routes/__root.tsx`, `src/router.tsx`
**Commit**: `add getCurrentUser server function and typed root route context`

### Step 4: Auth-aware header

**Complexity**: standard
**RED**: Write test that Header renders "Sign in with Google" as an `<a>` linking to `/api/auth/google` when no user in context. Write test that Header renders the user's first name and a "Sign out" `<form>` button when user is in context. Write test that Dashboard nav link is always visible.
**GREEN**: Modify `src/components/Header.tsx` to read `user` from root route context. When logged out: render `<a href="/api/auth/google">Sign in with Google</a>`. When logged in: render first name + `<form method="post" action="/api/auth/logout"><button type="submit">Sign out</button></form>`. Always show Dashboard nav link (redirects to login if unauthenticated, handled by route guard).
**REFACTOR**: None needed
**Files**: `src/components/Header.tsx`, `src/components/Header.test.tsx`
**Commit**: `wire auth state into header with sign-in link and sign-out form`

### Step 5: Protected dashboard route

**Complexity**: standard
**RED**: Write test that `/dashboard` renders welcome message with user's first name when authenticated. Write test that `/dashboard` redirects to `/api/auth/google` when unauthenticated.
**GREEN**: Create `src/routes/dashboard.tsx` with `beforeLoad` that checks `context.user` — if absent, `throw redirect({ to: '/api/auth/google' })`. Component renders a simple placeholder: "Welcome back, {firstName}. This is your dashboard." with a heading distinguishing it from the home page.
**REFACTOR**: None needed
**Files**: `src/routes/dashboard.tsx`, `src/routes/dashboard.test.ts`
**Commit**: `add protected /dashboard route with auth guard`

### Step 6: Error and status banners on home page

**Complexity**: standard
**RED**: Write test that home page displays "Something went wrong during sign-in." banner when `?error=login_failed`. Write test that home page displays "You declined the Google sign-in request." when `?error=access_denied`. Write test that home page displays "You have been signed out." success banner when `?status=logged_out`. Write test that no banner is shown when no query params. Write test that banner has `role="alert"` and a dismiss button. Write test that dismissing cleans query param from URL.
**GREEN**: Modify `src/routes/index.tsx` to read `error` and `status` search params via `validateSearch`. Render a banner component with `role="alert"`, differentiated messages, a dismiss button (`aria-label="Dismiss message"`), and a `useEffect` that calls `replaceState` to clean the URL after rendering. Auto-focus the banner on mount.
**REFACTOR**: Extract banner into `src/components/AlertBanner.tsx` if reuse is warranted
**Files**: `src/routes/index.tsx`, `src/routes/index.test.ts`
**Commit**: `display accessible error and status banners on home page`

## Complexity Classification

| Rating | Criteria | Review depth |
|--------|----------|--------------|
| `trivial` | Single-file rename, config change, typo fix, documentation-only | Skip inline review; covered by final `/code-review` |
| `standard` | New function, test, module, or behavioral change within existing patterns | Spec-compliance + relevant quality agents |
| `complex` | Architectural change, security-sensitive, cross-cutting concern, new abstraction | Full agent suite including opus-tier agents |

## Pre-PR Quality Gate

- [ ] All tests pass
- [ ] Type check passes (`tsc --noEmit`)
- [ ] Linter passes
- [ ] `/code-review` passes
- [ ] `.env.example` documents all required variables
- [ ] Manual test: full login → dashboard → logout flow in browser

## Risks & Open Questions

- **`useSession` max-age**: TanStack Start's `useSession` uses `h3` sessions under the hood. Confirm that `cookie.maxAge: 604800` maps to `Max-Age=604800` on the Set-Cookie header.
- **CSRF state storage**: Resolved — use a separate `oauth_state` cookie (HttpOnly, SameSite=Lax, maxAge=300s). Concurrent OAuth flows in multiple tabs will overwrite each other's state cookie; this is an accepted limitation for this scope.
- **ID token verification**: Relying on token coming directly from Google's token endpoint over HTTPS (safe per OpenID Connect spec). JWKS verification is explicitly out of scope.
- **`src/server/` directory convention**: This project establishes `src/server/` for server-only utilities. This deviates from TanStack Start's suggested `.functions.ts`/`.server.ts` suffixes but is a clearer convention for this project.
- **TanStack Start API route naming**: Server routes use `createFileRoute` with `server: { handlers: { GET } }`. Directory nesting for path segments: `src/routes/api/auth/google/callback.ts` → `/api/auth/google/callback`.

## Plan Review Summary

Four reviewers assessed this plan. All blockers from the initial draft have been addressed in this revision:

**Acceptance Test Critic** (5 blockers resolved): Added tampered cookie criterion + scenario, added `SESSION_SECRET` to AC #13, clarified dashboard redirect chain, added CSRF state validation scenario, resolved API route file naming convention.

**Design & Architecture Critic** (3 blockers resolved): Added Step 0 to disable `verbatimModuleSyntax`, moved env validation inside handlers (not module scope), specified `createFileRoute` + `server.handlers` pattern for API routes. Eliminated redundant server function + API route dual layer for OAuth redirects. Added `createRootRouteWithContext` for typed context. Dropped premature `HomeContent.tsx` extraction.

**UX Critic** (3 blockers resolved): Added `role="alert"`, focus management, and keyboard dismiss for error banners. Specified semantic HTML for auth controls (`<a>` for sign-in, `<form>` for sign-out). Added loading awareness note (callback route is server-side, no blank page). Added return-to-URL pattern, differentiated error messages, URL cleanup via `replaceState`, logout success banner, always-visible Dashboard nav link.

**Strategic Critic** (0 blockers, warnings addressed): Adopted `arctic` library instead of hand-rolled OAuth. Added "Not in Scope" section. Consolidated redundant acceptance criteria. Resolved CSRF state storage and API route naming upfront.

**Remaining warnings accepted as-is**: Concurrent OAuth tab behavior (accepted limitation), no multi-provider abstraction (YAGNI), `src/server/` convention deviation (documented), `beforeLoad` on root calling server function on every navigation (fast because cookie-only session read).
