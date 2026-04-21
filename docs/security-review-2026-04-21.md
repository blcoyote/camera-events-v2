# Security Review: camera-events-v2

**Date**: 2026-04-21
**Target**: https://ce2.elcoyote.dk (production)
**Reviewer**: Security Engineer (automated)
**Infrastructure**: Traefik reverse proxy (TLS/ACME), Docker Compose, Node.js 22

---

## Executive Summary

The application has **strong security fundamentals** in many areas: encrypted sealed-cookie sessions, PKCE OAuth with encrypted state, parameterized SQL queries, strict input validation on all proxy routes, and open-redirect protections on both server and service worker.

However, a **critical authentication bypass** was identified and confirmed against production: all TanStack Start `createServerFn` endpoints in `_authenticated` routes are callable without authentication. The `_authenticated` layout guard only protects client-side router navigation — the underlying server functions are directly accessible via HTTP at `/_serverFn/{hash}`. This exposes camera names, all event data (including thumbnails), and cache-clearing operations to unauthenticated users.

Additional risk areas include infrastructure hardening (exposed ports, missing security headers) and defense-in-depth gaps (SSRF path, error message leakage).

---

## Findings

### CRITICAL

#### C1. Authentication Bypass on All Server Functions in \_authenticated Routes

**Severity**: CRITICAL | **Confirmed against production**: Yes

**Affected files**:

- `src/routes/_authenticated/cameras.tsx:19` — `loadCameras`
- `src/routes/_authenticated/camera-events.index.tsx:21` — `loadEvents`
- `src/routes/_authenticated/camera-events.$id.tsx:8` — `loadEvent`
- `src/features/shared/server/frigate/client.ts:256` — `clearCacheFn`

**The problem**: TanStack Start's `createServerFn()` generates HTTP endpoints at `/_serverFn/{sha256-hash}`. The `_authenticated` route layout only guards client-side router navigation via `beforeLoad`. Server functions defined inside these routes have **no server-side session check** — they are directly callable via HTTP, completely bypassing authentication.

**Proof of exploit** (tested 2026-04-21 against production):

```bash
# Camera list — no cookie, no auth:
curl -s "https://ce2.elcoyote.dk/_serverFn/115dd9798160b4a96c5deb2c0012ca95daefe1cb14afb713103242b23ab8d556" \
  -H "x-tsr-serverFn: true"
# Returns: garage, gavl_oest, gavl_vest, have, koekken, stuen, vaerksted

# All events with thumbnails — no cookie, no auth:
curl -s "https://ce2.elcoyote.dk/_serverFn/ce2eaea740ad55aec55eac98af4b5353e790d1014811e9699554c6f5ff594bfd" \
  -H "x-tsr-serverFn: true"
# Returns: 193KB of event data including base64 thumbnails, camera names, timestamps, labels
```

**Impact**: Any unauthenticated user can:

1. Enumerate all camera names on the Frigate NVR
2. Retrieve all camera events with metadata (timestamps, detection labels, scores)
3. View base64-encoded thumbnails of all detections
4. Flush the API cache (DoS degradation via `clearCacheFn`)

**Remediation**: Add session validation inside every server function handler:

```typescript
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'

const loadCameras = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await useSession<SessionData>(getSessionConfig())
  if (!session.data.sub) {
    return { ok: false, error: 'Unauthorized' } as FrigateResult<string[]>
  }
  return getCameras()
})
```

Apply this pattern to all four server functions. **Do not rely on TanStack route guards for server-side authentication.**

Note: The function hashes are derived from the source code and change on rebuild, but they are discoverable in the client-side JavaScript bundles served to all visitors.

---

### HIGH

#### H1. Missing Security Response Headers

**Live observation**: `curl -sI https://ce2.elcoyote.dk` returns zero security headers. None of the following are present:

| Header                      | Status  | Risk                                                      |
| --------------------------- | ------- | --------------------------------------------------------- |
| `Strict-Transport-Security` | Missing | Browsers won't enforce HTTPS — downgrade attacks possible |
| `Content-Security-Policy`   | Missing | No script-source restrictions — XSS impact amplified      |
| `X-Content-Type-Options`    | Missing | MIME-sniffing attacks                                     |
| `X-Frame-Options`           | Missing | Clickjacking of camera feeds                              |
| `Referrer-Policy`           | Missing | Referrer leaks on external navigation                     |
| `Permissions-Policy`        | Missing | No restriction on camera/mic/geolocation APIs             |

**Remediation**: Add Traefik security headers middleware via docker-compose labels:

```yaml
- traefik.http.middlewares.ce2-headers.headers.stsSeconds=63072000
- traefik.http.middlewares.ce2-headers.headers.stsIncludeSubdomains=true
- traefik.http.middlewares.ce2-headers.headers.stsPreload=true
- traefik.http.middlewares.ce2-headers.headers.contentTypeNosniff=true
- traefik.http.middlewares.ce2-headers.headers.frameDeny=true
- traefik.http.middlewares.ce2-headers.headers.referrerPolicy=strict-origin-when-cross-origin
- traefik.http.middlewares.ce2-headers.headers.permissionsPolicy=camera=(), microphone=(), geolocation=()
- traefik.http.middlewares.ce2-headers.headers.contentSecurityPolicy=default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self'
- traefik.http.routers.ce2.middlewares=ce2-headers
```

#### H2. App Port 3000 Exposed — Traefik Bypass

**File**: `docker-compose.yml:7`

The `ports: ['3000:3000']` mapping exposes the app directly on the host. Anyone who can reach port 3000 bypasses Traefik entirely: no TLS, no security headers, no rate limiting. The session cookie has `secure: true` in production, but direct HTTP access allows session-fixation probing and information leakage.

**Remediation**: Remove the port mapping or bind to localhost only:

```yaml
# Option A: remove entirely (Traefik routes via Docker network)
# Option B: localhost only for debugging
ports:
  - '127.0.0.1:3000:3000'
```

#### H3. RabbitMQ Management UI Exposed to All Interfaces

**File**: `docker-compose.yml:36`

Port `15672` (RabbitMQ management web UI) is bound to `0.0.0.0`. Anyone who can reach the Docker host on this port gets a login page protected only by `RABBITMQ_USER`/`RABBITMQ_PASS`. The management UI allows queue manipulation, message inspection, user creation, and configuration changes.

**Remediation**: Bind to localhost:

```yaml
ports:
  - '127.0.0.1:1883:1883'
  - '127.0.0.1:15672:15672'
```

---

### MEDIUM

#### M1. SSRF via Unvalidated Event ID in loadEvent Server Function

**File**: `src/routes/_authenticated/camera-events.$id.tsx:9`

```typescript
const loadEvent = createServerFn({ method: 'GET' })
  .inputValidator((data: string) => data) // ← no validation
  .handler(async ({ data: eventId }) => {
    return getEvent(eventId) // → /api/events/${eventId}
  })
```

The event ID from the URL parameter is passed directly to `getEvent()`, which interpolates it into `${FRIGATE_URL}/api/events/${eventId}`. While the proxy routes (`/api/events/$id/thumbnail`, etc.) all validate via `isValidEventId()` (regex `^[a-zA-Z0-9._-]+$`, max 200 chars), this server function path does not.

Combined with **C1** (no auth on this server function), an **unauthenticated** attacker could craft an `eventId` like `../../config` to reach `FRIGATE_URL/api/config` (Frigate configuration including camera credentials, RTSP URLs, etc.). The `new URL(path, base)` construction in `buildUrl()` normalizes path traversal sequences.

**Remediation**: Add both auth and input validation:

```typescript
import { isValidEventId } from '#/features/shared/server/validation'

const loadEvent = createServerFn({ method: 'GET' })
  .inputValidator((data: string) => data)
  .handler(async ({ data: eventId }) => {
    if (!isValidEventId(eventId)) {
      return {
        ok: false,
        error: 'Invalid event ID',
      } as FrigateResult<FrigateEvent>
    }
    return getEvent(eventId)
  })
```

#### M2. clearCacheFn Server Function Has No Authentication

**File**: `src/features/shared/server/frigate/client.ts:256`

The `clearCacheFn` is a `createServerFn({ method: 'POST' })` with no session validation. TanStack server functions are exposed as RPC endpoints. An unauthenticated caller who discovers the endpoint can repeatedly flush the Frigate API cache, forcing all requests to hit the Frigate backend and degrading performance.

**Remediation**: Add session validation before clearing cache.

#### M3. MQTT Credentials Logged in Plaintext

**File**: `src/features/push-notifications/server/mqtt.ts:96`

```typescript
console.log(`[mqtt] Connected to ${url}`)
```

The `url` variable contains the full MQTT connection string including username and password (e.g., `mqtt://frigate:password@rabbitmq:1883`). Container logs, log aggregation systems, and crash reports will contain these credentials.

**Remediation**: Redact credentials before logging:

```typescript
const safeUrl = new URL(url)
safeUrl.username = '***'
safeUrl.password = '***'
console.log(`[mqtt] Connected to ${safeUrl}`)
```

#### M4. Internal Error Messages Leaked to API Clients

**Files**: `subscribe.ts:41`, `unsubscribe.ts:41`, `preferences.ts:31,70`, `test.ts:28`

All five push API endpoints return `err.message` in 500 responses. SQLite errors, file system errors, or web-push library errors could expose internal paths, database schema details, or stack fragments.

**Remediation**: Return `'Internal server error'` to clients; keep `err.message` in `console.error` only.

#### M5. MQTT Port 1883 Exposed Without TLS

**File**: `docker-compose.yml:35`

The MQTT broker port is bound to all interfaces and transmits credentials and event data in plaintext. If Frigate connects from the LAN, credentials travel unencrypted. If only the Docker app container connects, there's no reason to expose this port externally.

**Remediation**: Same as H3 — bind to localhost or remove. If external Frigate integration is needed, configure RabbitMQ TLS and use `mqtts://` on port 8883.

#### M6. `allowedHosts: true` Disables Host Header Validation

**File**: `vite.config.ts:20`

```typescript
preview: {
  allowedHosts: true,
}
```

Combined with H2 (exposed port 3000), this allows requests with arbitrary `Host` headers. While `APP_URL` mitigates OAuth redirect manipulation, other host-header-dependent behavior could be affected.

**Remediation**: Restrict to the production domain:

```typescript
preview: {
  allowedHosts: ['ce2.elcoyote.dk'],
}
```

---

### LOW

#### L1. Push Subscription Endpoints Logged on Failure

**File**: `src/features/push-notifications/server/push-notify.ts:95`

Push endpoints are bearer-capability URLs. Logging the full URL in error messages means anyone with log access could send unsolicited notifications to users' devices.

**Remediation**: Truncate: `endpoint.slice(0, 40) + '...'`

#### L2. Dockerfile Uses `pnpm@latest` (Supply Chain)

**File**: `Dockerfile:2`

`corepack prepare pnpm@latest` means builds are not reproducible and a compromised pnpm release affects all future builds.

**Remediation**: Pin: `corepack prepare pnpm@10.33.0 --activate`

#### L3. Runtime Image Includes Full node_modules and src/

**File**: `Dockerfile:19,25`

DevDependencies and all source files (including tests) are copied to the production image, increasing attack surface.

**Remediation**: Use a separate `prod-deps` stage with `pnpm install --frozen-lockfile --prod`. Audit which `src/` files are actually needed at runtime.

#### L4. No Rate Limiting on Push API Endpoints

An authenticated user could flood `/api/push/test` to trigger excessive outbound push notifications to all their devices, or spam `/api/push/subscribe` to create many subscription records.

**Remediation**: Add rate limiting via Traefik middleware or per-user throttling in the application.

#### L5. `handleUnsubscribe` Does Not Validate Endpoint as HTTPS URL

**File**: `src/features/push-notifications/server/push-handlers.ts:72`

Unlike `handleSubscribe` which validates the endpoint is an HTTPS URL, `handleUnsubscribe` only checks for non-empty string. Low risk since it's a deletion key, but inconsistent.

#### L6. `handleSetPreference` Does Not Validate Camera Name

**File**: `src/features/push-notifications/server/push-handlers.ts:148`

The `camera` field is not validated against `isValidCameraName()`, unlike the proxy routes. Low risk since it's only a store key.

---

### INFO (Positive Findings)

These are things the application does **well**:

| Area                         | Assessment                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session cookies**          | iron-sealed (AES-256), httpOnly, secure, sameSite=lax, 7-day TTL                                                                              |
| **OAuth**                    | PKCE with encrypted state cookie (AES-256-GCM), 5-minute expiry, email verification required                                                  |
| **Open redirect protection** | `sanitizeReturnTo()` blocks absolute, protocol-relative, and backslash URLs. Service worker's `getNotificationClickUrl()` has matching guards |
| **SQL injection**            | All queries use better-sqlite3 prepared statements with parameter binding                                                                     |
| **XSS**                      | Only one `dangerouslySetInnerHTML` usage — a static constant string (theme init). All dynamic data flows through React's automatic escaping   |
| **Path traversal**           | `isValidEventId()` and `isValidCameraName()` validators on all proxy routes                                                                   |
| **Input validation**         | Push subscription endpoint validated as HTTPS URL; event IDs and camera names regex-validated on proxy routes                                 |
| **CSRF**                     | `sameSite: lax` on session cookie blocks cross-origin POST                                                                                    |
| **Secrets**                  | All secrets loaded from environment variables, `.env` properly gitignored and dockerignored                                                   |
| **Container**                | Non-root user (UID 1234), multi-stage build, proper file ownership                                                                            |
| **CORS**                     | Preflight tested with `Origin: https://evil.com` — no `Access-Control-Allow-Origin` returned (good)                                           |

---

## Priority Remediation Order

| Priority | Finding                                               | Effort  | Impact                                               |
| -------- | ----------------------------------------------------- | ------- | ---------------------------------------------------- |
| **1**    | **C1 — Add server-side auth to all server functions** | **Low** | **Critical — closes unauthenticated data exposure**  |
| 2        | M1 — Validate event ID in loadEvent                   | Trivial | High — closes SSRF to Frigate API (compounded by C1) |
| 3        | H1 — Security headers via Traefik                     | Low     | High — immediately hardens all responses             |
| 4        | H2 — Remove port 3000 exposure                        | Trivial | High — closes Traefik bypass                         |
| 5        | H3 — Bind RabbitMQ ports to localhost                 | Trivial | High — closes management UI exposure                 |
| 6        | M3 — Redact MQTT credentials from logs                | Trivial | Medium — prevents credential leakage                 |
| 7        | M4 — Generic error responses                          | Low     | Medium — prevents info disclosure                    |
| 8        | M2 — Auth on clearCacheFn                             | Trivial | Medium — covered by C1 fix                           |
| 9        | M6 — Restrict allowedHosts                            | Trivial | Low (if H2 is fixed first)                           |
