# Spec: Event Request Cache

## Intent Description

Frigate API responses for event data (event list, single event, event summary) are slow under load, degrading the perceived speed of the Camera Events pages. We will add a server-side in-memory cache with a 10-minute TTL to all JSON event requests made by the Frigate client, so that repeated requests within the TTL window are served instantly from memory instead of hitting Frigate again.

TanStack Start has no built-in server-side data cache. The available options are: (a) an in-memory TTL cache within the Node.js process, (b) Redis as an external cache, or (c) HTTP `Cache-Control` headers for browser/CDN caching. Since this is a single-server deployment with no horizontal scaling, an in-memory cache is the simplest and most appropriate choice — adding Redis would introduce infrastructure complexity for no benefit at this scale. Binary media endpoints (thumbnails, snapshots, clips) are excluded because they are large, already set `Cache-Control: public, max-age=3600` on responses, and caching them in-process risks OOM.

## User-Facing Behavior

```gherkin
Feature: Server-side event cache
  Frigate event JSON requests are cached in-memory for 10 minutes
  to reduce latency and Frigate load.

  Background:
    Given the Frigate API is reachable
    And the event cache is empty

  Scenario: First request fetches from Frigate and populates cache
    When the user navigates to the Camera Events list page
    Then the server fetches events from Frigate
    And the response is stored in the event cache with a 10-minute TTL

  Scenario: Subsequent request within TTL is served from cache
    Given the event cache contains a cached events list response
    And fewer than 10 minutes have elapsed since it was cached
    When the user navigates to the Camera Events list page again
    Then the server returns the cached response without contacting Frigate

  Scenario: Cache entry expires after TTL
    Given the event cache contains a cached events list response
    And 10 minutes have elapsed since it was cached
    When the user navigates to the Camera Events list page
    Then the server fetches events from Frigate again
    And the cache is updated with the new response

  Scenario: Cache key distinguishes different requests
    Given the event cache contains a cached events list (limit=50)
    When the user requests a single event detail page for event "abc.123"
    Then the server fetches that event from Frigate (cache miss)
    And the single event response is cached separately

  Scenario: Binary media endpoints are not cached in-memory
    When the server proxies a thumbnail, snapshot, or clip request
    Then the request always goes directly to Frigate
    And no in-memory cache entry is created

  Scenario: Frigate error is not cached
    Given the Frigate API returns an HTTP 500 error
    When the user navigates to the Camera Events list page
    Then the error result is returned to the user
    And no cache entry is stored for that request

  Scenario: Cache respects memory bounds
    Given the cache has reached its maximum entry limit
    When a new cache entry is added
    Then the oldest entry is evicted to make room

  Scenario: Frigate is unreachable but cache has data
    Given the event cache contains a valid cached events list response
    And the Frigate API becomes unreachable
    When the user navigates to the Camera Events list page within the TTL
    Then the cached response is served successfully
```

## Architecture Specification

**Components affected:**

| Component | Change |
|-----------|--------|
| `src/server/frigate/cache.ts` | New — TTL cache implementation with `get`, `set`, `has`, `clear` |
| `src/server/frigate/client.ts` | Wrap `frigateGet` calls in cache lookup/store logic |

**Cache design:**

- **Storage**: `Map<string, { data: unknown, expiresAt: number }>` — simple, zero-dependency, adequate for single-process Node.js
- **Key**: The full Frigate URL string (already computed by `buildUrl`) — naturally distinguishes different endpoints and query parameter combinations
- **TTL**: 10 minutes (600,000 ms), configurable via constant
- **Scope**: Only JSON responses via `frigateGet` — binary responses via `frigateBinary` are excluded
- **Max entries**: Bounded (e.g., 500 entries) to prevent unbounded memory growth; LRU eviction when full
- **Error handling**: Only successful (`ok: true`) results are cached; errors pass through uncached
- **No external dependencies**: No Redis, no npm cache library, no docker-compose changes

**What is NOT cached:**
- Binary endpoints (`frigateBinary`): thumbnails, snapshots, clips — already use HTTP `Cache-Control` headers
- Error responses from Frigate
- Non-event endpoints (config, stats, cameras) — these are out of scope per the request

**Constraints:**
- Cache is process-local — restarting the server clears it (acceptable for this use case)
- No cache invalidation beyond TTL (events are historical and don't change frequently)
- Thread-safety is not a concern — Node.js is single-threaded

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 1 | Cached JSON responses return within 1ms | Second call to `frigateGet` for the same URL completes without `fetch` being called |
| 2 | TTL of 10 minutes | Cache entries expire after 600,000ms; a request after expiry triggers a new Frigate fetch |
| 3 | Cache key correctness | Different URLs (different endpoints, different query params) produce different cache entries |
| 4 | Errors are not cached | `FrigateResult` with `ok: false` is never stored in the cache |
| 5 | Binary endpoints bypass cache | `frigateBinary` calls are never cached in memory |
| 6 | Memory bounded | Cache enforces a max entry count; evicts oldest when full |
| 7 | No new infrastructure | No Redis, no new docker-compose services, no new npm dependencies |
| 8 | Tests pass | Unit tests cover: cache hit, cache miss, TTL expiry, error exclusion, eviction, key isolation |
| 9 | Type safety | `tsc --noEmit` passes with no errors |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
