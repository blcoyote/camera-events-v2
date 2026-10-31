# Spec: Frigate API Client (Read Operations)

## Intent Description

The camera event viewer currently uses hardcoded placeholder data (`PLACEHOLDER_EVENTS` in `src/data/camera-events.ts`). To display real camera events, the app needs a server-side API client that communicates with a Frigate NVR instance over its REST API.

This change adds a foundation layer — TypeScript type definitions matching Frigate's response schemas, a server-side HTTP client module with functions for each read endpoint, and an environment variable (`FRIGATE_URL`) for configuring the NVR address. No frontend changes are included; route loaders will consume the client module in a later phase.

**Scope**: Read-only (GET) endpoints only. Write operations (POST/DELETE) are documented in the types and architecture notes for future implementation but are not built in this slice.

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

## Architecture Specification

**New module**: `src/server/frigate/`

| File        | Purpose                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`  | TypeScript types for all Frigate API request params and response schemas (read AND write — types documented now for future use) |
| `client.ts` | HTTP client functions for read (GET) endpoints only. Server-only                                                                |
| `config.ts` | `getFrigateUrl()` function that reads and validates `FRIGATE_URL` from env                                                      |

**Module boundary**: Server-only. Must NOT be imported by client-side code. Same constraint as `src/server/auth-crypto.ts`.

**Dependencies**: Native `fetch` only. No new npm packages. `AbortSignal.timeout()` for request timeouts.

**Error handling**: Discriminated union return type:

```typescript
type FrigateResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }
```

**Configuration**: `FRIGATE_URL` env var (e.g., `http://192.168.1.100:5000`). Validated at call time. Trailing slash stripped.

**Constraints**:

- No auth to Frigate (handled at network level if needed)
- Binary responses (thumbnails, snapshots) return `ArrayBuffer`
- Default timeout: 10 seconds, configurable per-call
- No response caching — responsibility of consuming code

### Frigate API Reference — Read Endpoints (implemented)

| Method | Path                            | Query Params                                                                                        | Response Type            |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| `GET`  | `/api/events`                   | cameras, labels, zones, after, before, limit, has_clip, has_snapshot, include_thumbnails, favorites | `FrigateEvent[]`         |
| `GET`  | `/api/events/summary`           | timezone, has_clip, has_snapshot                                                                    | `FrigateEventSummary`    |
| `GET`  | `/api/events/:id/thumbnail.jpg` | download, timestamp, bbox, crop, height, quality                                                    | `ArrayBuffer` (JPEG)     |
| `GET`  | `/api/events/:id/snapshot.jpg`  | download, timestamp, bbox, crop, height, quality                                                    | `ArrayBuffer` (JPEG)     |
| `GET`  | `/api/review`                   | cameras, labels, zones, reviewed, limit, severity, before, after                                    | `FrigateReview[]`        |
| `GET`  | `/api/review/event/:event_id`   | —                                                                                                   | `FrigateReview`          |
| `GET`  | `/api/review/summary`           | cameras, labels, zones, timezone                                                                    | `FrigateReviewSummary`   |
| `GET`  | `/api/timeline`                 | camera, limit, source_id                                                                            | `FrigateTimelineEntry[]` |
| `GET`  | `/api/stats`                    | —                                                                                                   | `FrigateStats`           |
| `GET`  | `/api/config`                   | —                                                                                                   | `FrigateConfig`          |

### Frigate API Reference — Write Endpoints (types only, not implemented)

| Method   | Path                          | Request Body                                                  | Purpose                |
| -------- | ----------------------------- | ------------------------------------------------------------- | ---------------------- |
| `DELETE` | `/api/events/:id`             | —                                                             | Delete an event        |
| `POST`   | `/api/events/:id/retain`      | —                                                             | Toggle event retention |
| `POST`   | `/api/events/:id/sub_label`   | `{ subLabel: string, subLabelScore: number, camera: string }` | Set event sub-label    |
| `POST`   | `/api/events/:id/description` | `{ description: string }`                                     | Set event description  |
| `POST`   | `/api/review/:id/viewed`      | —                                                             | Mark review as viewed  |

### Key Type Schemas (from Frigate API docs)

**FrigateEvent** (EventResponse):

```
id: string                    — unique event identifier (e.g., "1678886400.123456-abcdefghij")
label: string                 — primary detection label ("person", "car", "dog", etc.)
sub_label: string             — secondary label ("package", "amazon", etc.)
camera: string                — camera name ("front_door", "backyard", etc.)
start_time: number            — Unix timestamp (seconds)
end_time: number              — Unix timestamp (seconds)
false_positive: boolean       — whether flagged as false positive
zones: string[]               — zone names where detection occurred
thumbnail: string             — thumbnail path or base64 string
has_clip: boolean             — video clip available
has_snapshot: boolean         — snapshot image available
retain_indefinitely: boolean  — permanent retention flag
plus_id: string               — Frigate+ identifier
model_hash: string            — detection model hash
detector_type: string         — "cpu", "cuda", "edgetpu", etc.
model_type: string            — "yolov8n", "efficientdet", etc.
data: object                  — additional metadata (varies)
```

**FrigateReview** (ReviewResponse):

```
id: string                    — unique review identifier
camera: string                — camera name
start_time: string            — ISO 8601 timestamp
end_time: string              — ISO 8601 timestamp
has_been_reviewed: boolean    — review status
severity: "alert" | "detection"
thumb_path: string            — file path to thumbnail
data: object                  — additional metadata
```

**FrigateReviewSummary**:

```
last24Hours: {
  reviewed_alert: number
  reviewed_detection: number
  total_alert: number
  total_detection: number
}
[day: string]: {              — keyed by date
  day: string (ISO datetime)
  reviewed_alert: number
  reviewed_detection: number
  total_alert: number
  total_detection: number
}
```

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

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
