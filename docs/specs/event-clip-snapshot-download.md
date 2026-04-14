# Spec: Event Clip & Snapshot Download

## Intent Description

The camera event detail page (`/camera-events/$id`) currently displays Clip and Snapshot availability as static text ("Available" / "None") inside `InfoCard` components. When the underlying media exists, users have no way to retrieve it.

This change makes the Clip and Snapshot cards actionable: when the event has a clip or snapshot available (`has_clip: true` / `has_snapshot: true`), the card becomes a download link that fetches the file from Frigate through our authenticated proxy and triggers a browser download. When unavailable, the card remains inert with its current "None" display.

**Why**: Users reviewing surveillance events need to save evidence locally — for incident reports, sharing with law enforcement, or archiving. The data is already in Frigate; we just need to expose it.

## User-Facing Behavior

```gherkin
Feature: Download clip and snapshot from camera event detail page

  Background:
    Given I am authenticated
    And I am viewing the detail page for an event

  Scenario: Download snapshot when available
    Given the event has a snapshot available
    When I click the Snapshot card
    Then a JPEG file downloads to my device
    And the filename contains the event ID

  Scenario: Download clip when available
    Given the event has a clip available
    When I click the Clip card
    Then an MP4 file downloads to my device
    And the filename contains the event ID

  Scenario: Snapshot card is inert when unavailable
    Given the event does not have a snapshot available
    Then the Snapshot card displays "None"
    And the Snapshot card is not clickable

  Scenario: Clip card is inert when unavailable
    Given the event does not have a clip available
    Then the Clip card displays "None"
    And the Clip card is not clickable

  Scenario: Download fails due to Frigate error
    Given the event has a snapshot available
    But the Frigate server is unreachable
    When I click the Snapshot card
    Then the browser receives an error response
    And no file download starts

  Scenario: Unauthenticated user cannot download
    Given I am not authenticated
    When I request an event clip or snapshot URL directly
    Then I receive a 401 response
```

## Architecture Specification

**Components affected**:

| Component | Change |
|-----------|--------|
| `src/pages/camera-events/CameraEventDetailPage.tsx` | Make Clip/Snapshot `InfoCard` render as download links when available |
| `src/routes/api/events/$id/clip.ts` | New API proxy route for clip downloads |
| `src/routes/api/events/-clip-proxy.ts` | Extracted handler logic (testable) |
| `src/server/frigate/client.ts` | Add `getEventClip(eventId)` function |
| `src/routeTree.gen.ts` | Register the new clip route |

**Data flow**:
1. User clicks Clip/Snapshot card → browser navigates to `/api/events/{id}/clip` or `/api/events/{id}/snapshot?download=true`
2. Proxy route authenticates via session, validates event ID, forwards to Frigate
3. Proxy adds `Content-Disposition: attachment; filename="..."` header
4. Browser handles the download natively

**Constraints**:
- Proxy routes follow the existing pattern (`-snapshot-proxy.ts` / `$id/snapshot.ts`)
- The existing snapshot proxy needs a `download` query param to set `Content-Disposition`
- Clip endpoint in Frigate: `GET /api/events/{id}/clip.mp4` returns `video/mp4`
- Downloads use `<a href="..." download>` — no JavaScript fetch/blob needed
- No new client-side state or hooks required

**Not in scope**:
- Inline video playback
- Batch downloads
- Progress indicators

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 1 | Snapshot card is an `<a>` tag with `download` attribute when `has_snapshot` is true | Inspectable in DOM |
| 2 | Clip card is an `<a>` tag with `download` attribute when `has_clip` is true | Inspectable in DOM |
| 3 | Cards remain non-interactive `<div>` when media is unavailable | No `<a>` tag rendered |
| 4 | Snapshot proxy responds with `Content-Disposition: attachment` when `?download=true` | Response header check |
| 5 | Clip proxy responds with `Content-Type: video/mp4` and `Content-Disposition: attachment` | Response header check |
| 6 | Clip proxy returns 401 for unauthenticated requests | HTTP status check |
| 7 | Clip proxy returns 400 for invalid event IDs | HTTP status check |
| 8 | Clip proxy returns 502 when Frigate is unreachable | HTTP status check |
| 9 | Download links have accessible names (aria-label or visible text) | Accessibility audit |
| 10 | Minimum 44px touch target on download cards | Visual inspection |
| 11 | Unit tests cover clip proxy handler (auth, validation, success, failure) | `vitest run` passes |
| 12 | `getEventClip` added to Frigate client with tests | `vitest run` passes |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
