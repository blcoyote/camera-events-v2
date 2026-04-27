# Security Policy

## Supported Versions

This project is self-hosted and developed on a rolling basis. Security fixes are applied to the latest commit on `main` only. No backport releases are maintained.

| Version       | Supported |
| ------------- | --------- |
| `main`        | Yes       |
| Older commits | No        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/blcoyote/camera-events-v2/security/advisories/new). Include:

- A clear description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept where possible)
- The affected component (auth, server functions, push notifications, etc.)
- Any suggested mitigations

You can expect an acknowledgement within 48 hours and a resolution or status update within 7 days.

## Security Model

Camera Events v2 is a **self-hosted, single-owner application**. The threat model assumes:

- The server runs on a private network or behind a reverse proxy with TLS termination
- The app owner controls the Frigate NVR and MQTT broker
- Login is restricted to the Google account(s) the owner configures
- All environment secrets (`SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, VAPID keys) are provisioned by the owner

**In scope for vulnerability reports:**

- Authentication bypass or session forgery
- Server-side request forgery (SSRF) against the Frigate backend
- Path traversal in proxy endpoints (event IDs, camera names)
- OAuth flow vulnerabilities (state/PKCE tampering, open redirect)
- Cross-site scripting (XSS) or injection
- Sensitive data exposure in responses, logs, or client bundles
- Insecure defaults that would harm a typical self-hoster

**Out of scope:**

- Attacks requiring physical access to the host machine
- Vulnerabilities in Frigate NVR, RabbitMQ/MQTT, or Google OAuth itself
- Denial-of-service against a single self-hosted instance
- Issues that require the attacker to already have valid session credentials

## Security Design

### Authentication

- Login is via Google OAuth 2.0 with PKCE. No passwords are stored.
- OAuth state is encrypted (AES-256-GCM with HKDF-derived key) in an `HttpOnly`, `SameSite=Lax` cookie with a 5-minute TTL.
- Sessions use signed, encrypted `HttpOnly` cookies (`SESSION_SECRET` ≥ 32 characters enforced at startup).
- Session lifetime is 7 days. Sessions are cleared on sign-out.

### Server Function Authorization

TanStack Start `createServerFn` endpoints are directly callable via HTTP at `/_serverFn/{hash}` — route-level layout guards only protect client-side navigation. Every server function that accesses protected data calls `requireSession()` as its first operation. Route hierarchy is **not** relied upon for server-side authentication.

### Input Validation

User-supplied identifiers that are forwarded to the Frigate backend are validated before use:

- **Camera names** — `^[a-zA-Z0-9_-]+$` (prevents path traversal and injection)
- **Event IDs** — `^[a-zA-Z0-9._-]+$`, maximum 200 characters

### Open Redirect Prevention

OAuth `returnTo` parameters are validated to ensure they are relative paths on the same origin. Absolute URLs, protocol-relative paths (`//`), and backslash variants are rejected.

### Push Notifications

VAPID keys are server-side only. Push subscription endpoints from clients are stored in SQLite and used only for sending notifications — they are never exposed to other users.

### Content Security

The app does not accept or render user-generated HTML content. Frigate event metadata (labels, camera names) is displayed as text. No `dangerouslySetInnerHTML` usage.

## Deployment Hardening Checklist

If you are self-hosting this app, review the following:

- [ ] `SESSION_SECRET` is at least 32 characters of random data (e.g. `openssl rand -base64 32`)
- [ ] `GOOGLE_CLIENT_SECRET` and VAPID keys are kept out of source control
- [ ] TLS is terminated at the reverse proxy; the app is not exposed directly on HTTP
- [ ] `APP_URL` is set to your exact public origin (used for OAuth redirect URI validation)
- [ ] The authorized redirect URI in your Google Cloud Console matches `APP_URL` exactly
- [ ] The Frigate instance (`FRIGATE_URL`) is not publicly reachable — only the Node.js server needs access
- [ ] The MQTT broker is not publicly reachable
- [ ] The SQLite database file is not in a web-accessible directory
- [ ] `NODE_ENV=production` is set so cookies are flagged `Secure`
