# Authentication & Security

## Server Function Authentication

- **TanStack Start `createServerFn` endpoints are directly callable via HTTP** at `/_serverFn/{hash}`. Route-level layout guards (like `_authenticated.tsx`'s `beforeLoad`) only protect client-side navigation — they do NOT protect server functions from direct HTTP access.
- **Every `createServerFn` handler that accesses protected data MUST call `await requireSession()`** (from `#/features/shared/server/session`) as its first operation. Never rely on the route hierarchy for server-side authentication.
- When adding a new server function inside an `_authenticated` route, always include the auth check. The function hash is discoverable in client-side JavaScript bundles, so security-through-obscurity does not apply.
- For server functions that accept user input (e.g. via `inputValidator`), always validate the input inside the handler as well — use validators like `isValidEventId()` and `isValidCameraName()` (from `#/features/shared/server/frigate/validation`) to prevent SSRF and path traversal against the Frigate backend.

## Authentication

- **Google OAuth via Arctic.** The flow is: `GET /api/auth/google` → Google → `GET /api/auth/google/callback` → set encrypted session cookie → redirect.
- OAuth state (PKCE `codeVerifier` + `state` + optional `returnTo`) is encoded as base64 JSON in the `oauth_state` cookie (5-minute TTL, `httpOnly`, `sameSite: lax`).
- `returnTo` paths are validated by `sanitizeReturnTo()` — only same-origin relative paths are accepted; absolute URLs, protocol-relative, and backslash paths are rejected.
- Session cookie name: `google-sso`; 7-day TTL; `httpOnly`, `secure` in production, `sameSite: lax`.
- `SESSION_SECRET` env var must be ≥ 32 characters. It is validated at call time (not module scope) to avoid env-access during SSR module init.
- `requireSession()` → returns the user's Google `sub` ID or throws `'Unauthorized'`.
- `getCurrentUserFn` is a server function called in `__root.tsx`'s `beforeLoad` to populate `context.user` for all routes.
