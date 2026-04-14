# Spec: Google SSO Login

## Intent Description

Allow users of this TanStack Start application to log in using their Google account via OAuth 2.0 / OpenID Connect (Google SSO). Authentication state is managed entirely on the backend — the client never holds tokens directly. Session identity is conveyed to the browser via an HTTP-only cookie with a 7-day lifetime. No database or persistent user record is created; session data (Google `sub` ID, first name, email, avatar URL) lives in the server-side session only. The UI displays the user's first name in the header when logged in, along with a logout action. A new protected route (`/dashboard`) serves the same content as the current home page as a placeholder. Unauthenticated users accessing `/dashboard` are redirected to the login flow. All other pages remain public.

## User-Facing Behavior

```gherkin
Feature: Google SSO Login

  Background:
    Given the application is running
    And Google OAuth is configured with valid credentials

  # --- Login ---

  Scenario: User initiates Google login
    Given the user is not logged in
    When the user clicks the "Sign in with Google" button in the header
    Then the user is redirected to Google's OAuth consent screen

  Scenario: User completes Google login successfully
    Given the user has been redirected to Google's OAuth consent screen
    When the user grants consent with their Google account
    Then the user is redirected back to the application
    And a session cookie is set as HTTP-only with a 7-day lifetime
    And the header displays the user's first name
    And the "Sign in with Google" button is replaced with the user's first name and a "Sign out" option

  Scenario: User denies Google consent
    Given the user has been redirected to Google's OAuth consent screen
    When the user denies consent or cancels the flow
    Then the user is redirected back to the application
    And the user remains unauthenticated
    And no session cookie is set

  # --- Session ---

  Scenario: Authenticated user revisits the application
    Given the user has an active session cookie
    When the user navigates to any page
    Then the header displays the user's first name
    And no re-authentication is required

  Scenario: Session cookie expires
    Given the user's session cookie is older than 7 days
    When the user navigates to any page
    Then the user is treated as unauthenticated
    And the header shows the "Sign in with Google" button

  # --- Protected Route ---

  Scenario: Authenticated user accesses the protected dashboard
    Given the user is logged in
    When the user navigates to "/dashboard"
    Then the dashboard page is displayed with the same content as the home page

  Scenario: Unauthenticated user accesses the protected dashboard
    Given the user is not logged in
    When the user navigates to "/dashboard"
    Then the user is redirected to the Google OAuth consent screen

  # --- Logout ---

  Scenario: User logs out
    Given the user is logged in
    When the user clicks "Sign out"
    Then the session cookie is cleared
    And the user is redirected to the home page
    And the header shows the "Sign in with Google" button

  # --- Error Handling ---

  Scenario: Google OAuth callback receives an error
    Given the user has been redirected to Google's OAuth consent screen
    When Google returns an error in the callback (e.g., server error)
    Then the user is redirected to the home page
    And an error message is displayed indicating login failed
    And no session cookie is set
```

## Architecture Specification

### Components

| Component | Change | New/Modified |
|-----------|--------|--------------|
| **Server middleware** | Session middleware that reads/writes an HTTP-only cookie, deserializes session data (name, email, avatar, Google sub ID) | New |
| **OAuth server functions** | Two server endpoints: (1) `/api/auth/google` — initiates OAuth redirect to Google, (2) `/api/auth/google/callback` — handles the callback, exchanges code for tokens, extracts claims, creates session, sets cookie | New |
| **Logout server function** | `/api/auth/logout` — clears session cookie, redirects to `/` | New |
| **Header component** | Conditionally renders "Sign in with Google" button or user's first name + "Sign out" link based on auth state | Modified |
| **`/dashboard` route** | New protected route; reuses home page content; route guard checks session via middleware and redirects if unauthenticated | New |
| **Root route (`__root.tsx`)** | Passes session state (from middleware/server context) down to layout so Header can access it | Modified |

### Interfaces

- **Session shape:** `{ sub: string; firstName: string; email: string; avatarUrl: string; expiresAt: number }`
- **Cookie:** Single HTTP-only, Secure, SameSite=Lax cookie containing a signed/encrypted session token
- **Google OAuth:** Standard Authorization Code flow via Google's OAuth 2.0 endpoints; scopes: `openid profile email`

### Dependencies

- A session/cookie library compatible with TanStack Start's server functions (e.g., `iron-session`, `jose` for JWT, or a lightweight cookie-signing utility)
- Google OAuth client credentials (Client ID + Client Secret via environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- A callback URL env var or derived from the request origin

### Constraints

- No database — session data lives entirely in the signed cookie or server-side encrypted cookie value
- No client-side token storage — tokens from Google are consumed server-side and discarded after extracting claims
- Cookie must be HTTP-only, Secure (in production), SameSite=Lax
- TanStack Start server functions / `createMiddleware` used for all server-side logic — no external server framework

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|---------------|
| 1 | **Cookie security** | Session cookie has `HttpOnly`, `Secure` (in production), `SameSite=Lax` flags set |
| 2 | **Cookie lifetime** | Cookie `Max-Age` or `Expires` is 7 days from creation |
| 3 | **No client-side tokens** | Google access/ID tokens are never sent to the browser; no tokens in `localStorage`, `sessionStorage`, or non-HTTP-only cookies |
| 4 | **Session data completeness** | Session contains `sub`, `firstName`, `email`, `avatarUrl` after successful login |
| 5 | **Cookie is signed or encrypted** | Cookie value cannot be tampered with; modified cookies are rejected and treated as unauthenticated |
| 6 | **Login redirects to Google** | Clicking "Sign in with Google" sends the user to `accounts.google.com` with correct `client_id`, `redirect_uri`, `scope=openid profile email`, and `response_type=code` |
| 7 | **Callback exchanges code** | OAuth callback endpoint exchanges the authorization code for tokens server-side and does not expose the code or tokens to the client |
| 8 | **Header reflects auth state** | Logged-in: user's first name + sign out visible. Logged-out: "Sign in with Google" button visible |
| 9 | **Logout clears session** | After clicking "Sign out", session cookie is deleted and header reverts to unauthenticated state |
| 10 | **Dashboard protected** | `/dashboard` renders home page content when authenticated; redirects to Google OAuth when unauthenticated |
| 11 | **Consent denial handled** | Denying Google consent returns the user to the app with no session created |
| 12 | **OAuth error handled** | An error from Google's callback displays an error message on the home page with no session created |
| 13 | **Environment variables externalized** | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are loaded from a `.env` file (gitignored) or environment-level configuration, never hardcoded or committed to the repository. App fails fast with a clear error if either is missing at startup. |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
