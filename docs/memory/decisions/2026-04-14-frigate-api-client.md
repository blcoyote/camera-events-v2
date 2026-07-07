---
tags: [decision, frigate, caching, security]
created: 2026-04-14
---

# Frigate access goes through one client, one cache, one mock, one validation gate

> All Frigate reads/writes funnel through `client.ts`; successful JSON is
> memoized in a `Map` that MQTT messages blow away; `FRIGATE_MOCK=true` swaps
> in a parallel mock client; camera names and event IDs are regex-validated
> before they touch a Frigate URL path.

## Context

The app talks to a Frigate NVR over its REST API for events, reviews, stats,
config, and per-event media (thumbnail/snapshot/clip). Frigate has no
official client SDK, no push API of its own (we get that via MQTT — see
[[architecture/push-pipeline]]), and its JSON endpoints are slow enough under
load to matter for page responsiveness. Local development also needs to work
without a physical Frigate box reachable on the network.

## Decision

- **Single entry point**: every Frigate call goes through
  `src/features/shared/server/frigate/client.ts`. It exposes typed functions
  (`getEvents`, `getEvent`, `getEventThumbnail`, `getEventSnapshot`,
  `getEventClipStream`, `getReviews`, `getStats`, `getConfig`, `getCameras`,
  `retainEvent`/`unretainEvent`, …), all returning a `FrigateResult<T>`
  discriminated union (`{ ok: true; data }` / `{ ok: false; error; status? }`)
  instead of throwing. `getFrigateUrl()` in `config.ts` reads and validates
  `FRIGATE_URL`, stripping the trailing slash; it throws a descriptive error
  if unset, and is **required in production**.
- **In-process cache**: `cache.ts` implements a generic `TtlCache<T>` backed
  by a plain `Map`, exported as the singleton `frigateCache` (10-minute TTL,
  500-entry cap, oldest-evicted-when-full). `frigateGet()` in `client.ts` uses
  the fully-built request URL as the cache key and only stores `ok: true`
  results — errors always pass through live. Binary responses
  (`frigateBinary`, used for thumbnails/snapshots/clip streaming) are never
  cached in-process; they already carry HTTP `Cache-Control` headers and
  caching them here risks OOM.
- **Cache invalidation via MQTT, not TTL alone**: the MQTT subscriber
  (`src/features/push-notifications/server/mqtt.ts`) calls `clearFrigateCache()`
  on _every_ message on `frigate/events` or `frigate/reviews` — a full clear,
  not selective invalidation. This means the practical staleness window is
  "until the next Frigate event fires," not the full 10-minute TTL; the TTL
  is a backstop for when MQTT is unavailable, not the primary invalidation
  path. `clearCacheFn` (`cache-actions.ts`) also exposes a session-gated
  manual clear.
- **Mock mode**: `FRIGATE_MOCK=true` routes every exported function in
  `client.ts` through `mock-client.ts` instead of a live Frigate, so local
  dev needs no `FRIGATE_URL` and no network access. `mock-client.ts`
  generates randomized but shaped-correct data from fixed camera/label/zone
  pools and returns placeholder JPEG/MP4 buffers for binary endpoints
  (including manual HTTP Range handling for the clip stream, mirroring the
  real proxy's iOS Safari requirements).
- **Input validation before URL construction**: `validation.ts` exports
  `isValidCameraName()` (alphanumeric/underscore/hyphen only) and
  `isValidEventId()` (Frigate's `timestamp.microseconds-suffix` shape, regex
  - length-bounded). Every server function and proxy that accepts a
    user-supplied camera name or event ID — `load-event.ts`,
    `favorites-handlers.ts`, `push-handlers.ts`, the camera/event
    snapshot/thumbnail/clip proxies — calls the relevant validator and
    short-circuits with an error result before the value ever reaches
    `buildUrl()`. This is the SSRF/path-traversal defense: nothing gates
    Frigate URL construction itself, so every caller is responsible for
    validating first.

## Deviation from the plan

- **Location moved**: the plan and specs describe `src/server/frigate/` and
  `src/server/mqtt.ts`. The codebase later adopted a feature-sliced layout
  (see `CLAUDE.md`), so the Frigate client now lives under
  `src/features/shared/server/frigate/` and the MQTT subscriber under
  `src/features/push-notifications/server/mqtt.ts`. No behavioral change,
  just the move.
- **Mock switching is per-function, not a module-level re-export**: the
  mock-frigate-client spec called for `client.ts` to check
  `FRIGATE_MOCK` once at module top and re-export every function from
  `mock-client.ts` wholesale. The actual code checks
  `process.env.FRIGATE_MOCK === 'true'` inside _each_ exported function and
  lazily `import('./mock-client')`s on demand (`loadMock()`). Net effect for
  callers is identical, but it means mock-client is only pulled into the
  module graph when actually used, and a function added to `client.ts`
  without updating its mock counterpart fails silently mock-side rather than
  at the export list.
- **Validation is not in the original spec set**: none of the four specs
  read for this ADR (frigate-api-client, event-request-cache,
  mock-frigate-client, mqtt-cache-invalidation) mention
  `isValidCameraName`/`isValidEventId`. They were added later as a security
  hardening pass and are treated here as part of the same access-layer
  decision because they gate the same `client.ts` URL construction the rest
  of this ADR describes.
- **Client does more than the original read-only scope**: the plan explicitly
  deferred write operations. The current client includes `retainEvent`/
  `unretainEvent` (used by favorites) and a streaming `getEventClipStream`
  (Range-aware, for iOS inline video) that the original spec didn't
  anticipate in that form.

## Why it matters

- **Cache correctness depends on MQTT, not just TTL.** If `MQTT_URL` is
  unset, the cache is a pure 10-minute TTL cache and the UI can show
  Frigate data that's up to 10 minutes stale after a new event — this is a
  known, accepted trade-off (see [[architecture/push-pipeline]]), not a bug.
- **The validators are the whole SSRF/path-traversal defense.** There is no
  centralized guard inside `client.ts` — `buildUrl()` will happily build a
  URL from anything it's given. Every new server function or proxy that
  accepts a camera name or event ID from a client must call
  `isValidCameraName`/`isValidEventId` itself before calling into `client.ts`;
  forgetting this is a real vulnerability, not just a style nit.
- **Mock parity is manual, not enforced.** Because mock switching happens
  per function via `loadMock()`, adding a new exported function to
  `client.ts` without adding the matching mock export means `FRIGATE_MOCK=true`
  breaks for that one function with no compiler error — check `mock-client.ts`
  whenever `client.ts` grows.
- **Single-process, single-server assumption.** The `Map`-backed cache and
  MQTT-triggered clear only work correctly with one server process. This is
  fine at current scale (see [[architecture/system-overview]]) but would need
  rethinking (Redis, pub/sub invalidation) before horizontal scaling.

## Related

- [[Home]]
- [[architecture/frigate-http-api]] — full endpoint surface, what's wrapped vs. untapped
- [[architecture/push-pipeline]] — the MQTT link that drives cache invalidation
- [[architecture/system-overview]]
