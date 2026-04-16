# Plan: Frigate API Client (Read Operations)

**Created**: 2026-04-14
**Branch**: main
**Status**: implemented

## Goal

Add a server-side Frigate NVR API client module (`src/server/frigate/`) that provides typed HTTP client functions for all read endpoints, a `FrigateResult<T>` discriminated union for error handling, and `FRIGATE_URL` environment variable configuration. This is a foundation layer — no frontend changes. Types for future write operations are defined but client functions are deferred.

## Acceptance Criteria

- [ ] `FrigateEvent` type matches Frigate's EventResponse schema (id, label, sub_label, camera, start_time, end_time, false_positive, zones, has_clip, has_snapshot, retain_indefinitely, data)
- [ ] `FrigateReview` type matches review schema (id, camera, start_time, end_time, has_been_reviewed, severity, thumb_path, data)
- [ ] `FrigateReviewSummary` type includes last24Hours and daily breakdowns
- [ ] Types for write operation request bodies are defined (SubLabelBody, DescriptionBody) even though client functions are deferred
- [ ] Read client functions exist: getEvents, getEventSummary, getEventThumbnail, getEventSnapshot, getReviews, getReviewByEvent, getReviewSummary, getTimeline, getStats, getConfig
- [ ] All JSON-returning functions return `FrigateResult<T>`
- [ ] Binary-returning functions return `FrigateResult<ArrayBuffer>`
- [ ] Missing `FRIGATE_URL` produces a descriptive error, not a crash at import time
- [ ] Network errors, non-200 HTTP, JSON parse failures all produce `{ ok: false }`
- [ ] Query params are correctly serialized (comma-separated lists, numeric values, boolean flags)
- [ ] Default 10s timeout, configurable per-call
- [ ] `.env.example` updated with `FRIGATE_URL`
- [ ] Module is server-only — no client-side imports

## User-Facing Behavior

```gherkin
Feature: Frigate API Client (Read Operations)

  Background:
    Given the environment variable FRIGATE_URL is set to "http://frigate.local:5000"

  # --- Configuration ---

  Scenario: Missing FRIGATE_URL environment variable
    Given the environment variable FRIGATE_URL is not set
    When any Frigate client function is called
    Then it throws an error with message containing "FRIGATE_URL"

  Scenario: Retrieve Frigate configuration
    Given the Frigate server returns a valid config response
    When getConfig is called
    Then it returns the parsed FrigateConfig object

  # --- Events ---

  Scenario: List events with no filters
    Given the Frigate server has events
    When getEvents is called with no parameters
    Then it returns an array of FrigateEvent objects

  Scenario: List events with filters
    When getEvents is called with cameras "front_door", labels "person", and limit 10
    Then the request URL includes query params "cameras=front_door&labels=person&limit=10"
    And it returns an array of FrigateEvent objects

  Scenario: List events filtered by time range
    When getEvents is called with after "1678886400" and before "1678972800"
    Then the request URL includes query params "after=1678886400&before=1678972800"

  Scenario: Get event summary
    When getEventSummary is called
    Then it returns a FrigateEventSummary object

  Scenario: Get event thumbnail
    When getEventThumbnail is called with event ID "abc123"
    Then it makes a GET request to "/api/events/abc123/thumbnail.jpg"
    And it returns the response as an ArrayBuffer

  Scenario: Get event snapshot
    When getEventSnapshot is called with event ID "abc123"
    Then it makes a GET request to "/api/events/abc123/snapshot.jpg"
    And it returns the response as an ArrayBuffer

  # --- Reviews ---

  Scenario: List reviews with filters
    When getReviews is called with severity "alert" and reviewed 0
    Then the request URL includes query params "severity=alert&reviewed=0"
    And it returns an array of FrigateReview objects

  Scenario: Get review for a specific event
    When getReviewByEvent is called with event ID "abc123"
    Then it makes a GET request to "/api/review/event/abc123"
    And it returns a FrigateReview object

  Scenario: Get review summary
    When getReviewSummary is called with timezone "Europe/Oslo"
    Then it returns a FrigateReviewSummary object

  # --- Timeline ---

  Scenario: Get timeline data
    When getTimeline is called with camera "front_door" and limit 50
    Then the request URL includes query params "camera=front_door&limit=50"

  # --- Stats ---

  Scenario: Get system stats
    When getStats is called
    Then it returns a FrigateStats object

  # --- Error handling ---

  Scenario: Frigate server returns 404
    Given the Frigate server returns HTTP 404
    When any GET client function is called
    Then it returns an error result with status 404

  Scenario: Frigate server is unreachable
    Given the Frigate server is not reachable
    When any client function is called
    Then it returns an error result indicating a network failure

  Scenario: Frigate server returns invalid JSON
    Given the Frigate server returns malformed JSON
    When a JSON-returning client function is called
    Then it returns an error result indicating a parse failure

  Scenario: Request times out
    Given the Frigate server does not respond within the timeout period
    When any client function is called
    Then it returns an error result indicating a timeout
```

## Steps

### Step 1: Config module — `getFrigateUrl()` and `FrigateResult` type

**Complexity**: standard
**RED**: Write tests for `getFrigateUrl()`: throws descriptive error when `FRIGATE_URL` is unset; returns trimmed URL when set; strips trailing slash. Write type assertion for `FrigateResult<T>` discriminated union (ok/error branches).
**GREEN**: Create `src/server/frigate/config.ts` with `getFrigateUrl()` that reads and validates `process.env.FRIGATE_URL`. Export `FrigateResult<T>` type and `DEFAULT_TIMEOUT_MS` constant (10000).
**REFACTOR**: None needed
**Files**: `src/server/frigate/config.ts`, `src/server/frigate/config.test.ts`
**Commit**: `add Frigate config module with getFrigateUrl and FrigateResult type`
**Traces to**: Scenarios "Missing FRIGATE_URL environment variable", acceptance criteria #8, #11

### Step 2: Type definitions for all Frigate API schemas

**Complexity**: trivial
**RED**: TypeScript compiler (`tsc --noEmit`) is the test — types must compile under strict mode. No runtime tests since these are pure type definitions.
**GREEN**: Create `src/server/frigate/types.ts` with: `FrigateEvent`, `FrigateReview`, `FrigateReviewSummary`, `FrigateReviewSummaryDay`, `FrigateEventSummary`, `FrigateTimelineEntry`, `FrigateStats`, `FrigateConfig`, query param types (`GetEventsParams`, `GetReviewsParams`, `GetTimelineParams`, `GetReviewSummaryParams`, `GetEventSummaryParams`, `GetEventMediaParams`), and write body types (`SubLabelBody`, `DescriptionBody`).
**REFACTOR**: None needed
**Files**: `src/server/frigate/types.ts`
**Commit**: `add Frigate API type definitions for all endpoints`
**Traces to**: Acceptance criteria #1–#4

### Step 3: Core JSON fetch helper + `getEvents`

**Complexity**: standard
**RED**: Write tests for `getEvents`: returns events array on success (no filters); serializes query params correctly (cameras, labels, limit, after, before); returns `{ ok: false }` on HTTP 404 with status; returns `{ ok: false }` on network failure; returns `{ ok: false }` on malformed JSON; returns `{ ok: false }` on timeout. All tests mock `global.fetch`.
**GREEN**: Create `src/server/frigate/client.ts` with internal `frigateGet<T>()` helper (builds URL from `getFrigateUrl()` + path + query params, calls fetch with `AbortSignal.timeout()`, handles errors, returns `FrigateResult<T>`). Export `getEvents()` using the helper.
**REFACTOR**: Extract query param serialization into a small helper if needed.
**Files**: `src/server/frigate/client.ts`, `src/server/frigate/client.test.ts`
**Commit**: `add Frigate JSON fetch helper and getEvents endpoint`
**Traces to**: Scenarios "List events with no filters", "List events with filters", "List events filtered by time range", all error scenarios. Acceptance criteria #5–#6, #9–#10, #11

### Step 4: Binary fetch helper + `getEventThumbnail`, `getEventSnapshot`

**Complexity**: standard
**RED**: Write tests for `getEventThumbnail` and `getEventSnapshot`: correct URL path construction; returns `ArrayBuffer` on success; returns `{ ok: false }` on HTTP error. Mock fetch to return `arrayBuffer()`.
**GREEN**: Add internal `frigateBinary()` helper (like `frigateGet` but calls `response.arrayBuffer()` instead of `.json()`). Export `getEventThumbnail()` and `getEventSnapshot()`.
**REFACTOR**: Extract shared fetch setup (URL building, timeout, error catching) between `frigateGet` and `frigateBinary` if duplication is excessive.
**Files**: `src/server/frigate/client.ts`, `src/server/frigate/client.test.ts`
**Commit**: `add Frigate binary fetch helper with thumbnail and snapshot endpoints`
**Traces to**: Scenarios "Get event thumbnail", "Get event snapshot". Acceptance criteria #7

### Step 5: `getEventSummary` + review endpoints

**Complexity**: standard
**RED**: Write tests for `getEventSummary`, `getReviews` (with severity/reviewed params), `getReviewByEvent` (correct path), `getReviewSummary` (timezone param). Verify URL construction and return types.
**GREEN**: Export all four functions, each delegating to `frigateGet<T>()`.
**REFACTOR**: None needed — these are thin wrappers.
**Files**: `src/server/frigate/client.ts`, `src/server/frigate/client.test.ts`
**Commit**: `add event summary and review endpoint functions`
**Traces to**: Scenarios "Get event summary", "List reviews with filters", "Get review for a specific event", "Get review summary"

### Step 6: `getTimeline`, `getStats`, `getConfig`

**Complexity**: standard
**RED**: Write tests for `getTimeline` (camera + limit params), `getStats` (no params), `getConfig` (no params). Verify URL construction.
**GREEN**: Export all three functions.
**REFACTOR**: None needed.
**Files**: `src/server/frigate/client.ts`, `src/server/frigate/client.test.ts`
**Commit**: `add timeline, stats, and config endpoint functions`
**Traces to**: Scenarios "Get timeline data", "Get system stats", "Retrieve Frigate configuration". Acceptance criteria #5

### Step 7: Update `.env.example` with `FRIGATE_URL`

**Complexity**: trivial
**RED**: N/A (documentation change)
**GREEN**: Add `FRIGATE_URL` entry to `.env.example` with comment explaining the format.
**REFACTOR**: None needed.
**Files**: `.env.example`
**Commit**: `add FRIGATE_URL to .env.example`
**Traces to**: Acceptance criteria #12

## Complexity Classification

| Rating     | Criteria                                                                         | Review depth                                        |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `trivial`  | Single-file rename, config change, typo fix, documentation-only                  | Skip inline review; covered by final `/code-review` |
| `standard` | New function, test, module, or behavioral change within existing patterns        | Spec-compliance + relevant quality agents           |
| `complex`  | Architectural change, security-sensitive, cross-cutting concern, new abstraction | Full agent suite including opus-tier agents         |

## Pre-PR Quality Gate

- [ ] All tests pass
- [ ] Type check passes (`tsc --noEmit`)
- [ ] Linter passes (`eslint`)
- [ ] `/code-review` passes
- [ ] `.env.example` updated

## Risks & Open Questions

- **Frigate API docs are incomplete**: The Context7 docs didn't fully document `GET /api/events` query params, `GET /api/config` response schema, or `GET /api/stats` response schema. Types for these (`FrigateConfig`, `FrigateStats`, `FrigateEventSummary`) will use partial/flexible typing (`Record<string, unknown>` with known fields). Can be tightened later when connected to a real Frigate instance.
- **`AbortSignal.timeout()` availability**: Requires Node 18+. The project targets ES2022 and uses Vite 8, so this should be available. If not, fall back to manual `AbortController` + `setTimeout`.
- **No integration tests against real Frigate**: All tests use mocked `fetch`. Integration testing against a real Frigate instance is out of scope for this slice — it would require a running NVR. The types may need adjustment once connected to real data.
- **Server-only enforcement**: TypeScript and the bundler don't enforce that `src/server/frigate/` is server-only. The constraint is architectural (documented), not compiler-enforced. A future Vite plugin or lint rule could enforce this.

## Plan Review Summary

Four review perspectives evaluated. All approved.

| Reviewer                     | Verdict | Notes                                                                                                                                                            |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceptance Test Critic       | approve | All 20 BDD scenarios traced to TDD steps. Step 2 (types) relies on tsc, not runtime tests — acceptable for pure type definitions.                                |
| Design & Architecture Critic | approve | Clean separation (config/types/client). Internal helpers prevent duplication. No new deps. FrigateConfig/FrigateStats loosely typed — acceptable for foundation. |
| UX Critic                    | approve | N/A — server-side infrastructure, no UI. FrigateResult pattern gives future UI explicit error control.                                                           |
| Strategic Critic             | approve | Right-sized scope. Type drift risk acknowledged. Discriminated union prevents crashes on unexpected shapes.                                                      |

**Warnings (non-blocking)**:

- Types may need tightening once connected to a real Frigate instance
- No integration tests in this slice — all mocked fetch
- Server-only boundary is architectural, not compiler-enforced
