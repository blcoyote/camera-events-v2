# Spec: Mock Frigate Client for Development

## Intent Description

When developing locally without access to a physical Frigate NVR, all API calls fail, making frontend development impractical. This feature adds a mock Frigate client that returns randomized but realistic data for all client functions (`getEvents`, `getEvent`, `getEventThumbnail`, etc.). It is toggled via a `FRIGATE_MOCK=true` environment variable and only activates in dev mode. When enabled, the real `frigateFetch` is bypassed entirely — no `FRIGATE_URL` is needed, no network calls are made.

The mock client generates data using the existing `FrigateEvent` types and the randomization patterns already established in `src/data/camera-events.ts`. Binary endpoints (thumbnails, snapshots, clips) return placeholder image/video buffers.

## User-Facing Behavior

```gherkin
Feature: Mock Frigate client for development
  A mock client returns randomized data when FRIGATE_MOCK=true,
  enabling frontend development without a Frigate server.

  Scenario: Mock mode enabled — events list returns generated data
    Given FRIGATE_MOCK is set to "true"
    When the user navigates to the Camera Events list page
    Then the page displays a list of randomly generated events
    And no network request is made to Frigate

  Scenario: Mock mode enabled — single event returns generated data
    Given FRIGATE_MOCK is set to "true"
    When the user navigates to a camera event detail page
    Then the page displays a generated event with realistic fields
    And the event ID in the URL matches the returned event

  Scenario: Mock mode enabled — thumbnail returns placeholder image
    Given FRIGATE_MOCK is set to "true"
    When the browser requests an event thumbnail
    Then a placeholder JPEG image is returned with correct headers

  Scenario: Mock mode enabled — snapshot returns placeholder image
    Given FRIGATE_MOCK is set to "true"
    When the browser requests an event snapshot
    Then a placeholder JPEG image is returned with correct headers

  Scenario: Mock mode enabled — clip returns placeholder video
    Given FRIGATE_MOCK is set to "true"
    When the user downloads an event clip
    Then a placeholder MP4 buffer is returned with correct headers

  Scenario: Mock mode enabled — cameras list returns generated cameras
    Given FRIGATE_MOCK is set to "true"
    When the user navigates to the Cameras page
    Then a list of camera names is returned

  Scenario: Mock mode disabled — real client used
    Given FRIGATE_MOCK is not set
    And FRIGATE_URL is set
    When the user navigates to the Camera Events list page
    Then the server fetches events from the real Frigate instance

  Scenario: Mock data varies between calls
    Given FRIGATE_MOCK is set to "true"
    When events are generated
    Then timestamps, scores, and labels vary realistically
    And camera names are drawn from a fixed pool of mock cameras

  Scenario: FRIGATE_URL not required in mock mode
    Given FRIGATE_MOCK is set to "true"
    And FRIGATE_URL is not set
    When the user navigates to any page
    Then the app functions normally with mock data
    And no error about missing FRIGATE_URL is thrown
```

## Architecture Specification

**Components:**

| Component | Change |
|-----------|--------|
| `src/server/frigate/mock-client.ts` | **New** — Mock implementations of all exported client functions |
| `src/server/frigate/client.ts` | **Modify** — Conditional export: when `FRIGATE_MOCK=true`, re-export mock functions instead of real ones |

**Design:**

- **`src/server/frigate/mock-client.ts`** — contains mock versions of every exported function from `client.ts`:
  - `getEvents` — returns 10–20 randomly generated `FrigateEvent` objects
  - `getEvent` — returns a single generated event using the provided ID
  - `getEventThumbnail` / `getEventSnapshot` — returns a small placeholder JPEG buffer
  - `getEventClip` — returns a minimal valid MP4 buffer
  - `getEventSummary`, `getReviews`, `getReviewByEvent`, `getReviewSummary`, `getTimeline`, `getStats`, `getConfig`, `getCameras`, `getLatestSnapshot` — returns realistic mock data matching their respective types
  - All return `FrigateResult<T>` with `ok: true`
  - Uses a fixed pool of camera names (`front_porch`, `driveway`, `backyard`, `garage`, `side_gate`, `front_door`)
  - Uses a fixed pool of labels (`person`, `car`, `dog`, `cat`, `truck`, `package`)
  - Randomizes timestamps, scores, zones, durations

- **Switching mechanism** in `client.ts`: At the top of the module, check `process.env.FRIGATE_MOCK === 'true'`. If true, import and re-export all functions from `mock-client.ts`. Consumers import from `client.ts` as before — zero changes needed.

- **`FRIGATE_URL` bypass**: When mock mode is active, `getFrigateUrl()` is never called.

**What is NOT in scope:**
- Realistic image generation (placeholder pixels are fine)
- Persisting mock state across requests (each call generates fresh data)
- UI indicators showing mock mode is active
- Mock data for the MQTT subscriber

**Constraints:**
- Zero new npm dependencies
- Mock functions must have identical type signatures to real ones
- Existing consumers of `client.ts` require zero changes

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 1 | Toggle via env | `FRIGATE_MOCK=true` activates mock client; unset or `false` uses real client |
| 2 | No FRIGATE_URL required | App starts and serves pages with only `FRIGATE_MOCK=true` set |
| 3 | All client functions mocked | Every exported function from `client.ts` has a mock equivalent |
| 4 | Type-safe returns | Mock functions return `FrigateResult<T>` matching real function signatures |
| 5 | Realistic data | Generated events have varied labels, cameras, timestamps, scores, zones |
| 6 | Binary endpoints return valid buffers | Thumbnail/snapshot return JPEG-like buffers; clip returns MP4-like buffer |
| 7 | No consumer changes | Files importing from `client.ts` need zero modifications |
| 8 | .env.example updated | `FRIGATE_MOCK` documented |
| 9 | Tests pass | `tsc --noEmit` clean, all unit tests pass |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
