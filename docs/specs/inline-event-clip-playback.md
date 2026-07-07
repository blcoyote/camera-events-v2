# Spec: Inline event clip playback with bounding-box overlay

**Status:** Approved
**Beads epic:** ce-bli
**Created:** 2026-05-19

## Intent Description

Frigate captures a short clip and a still snapshot for every event. The PWA currently surfaces only the still and forces a download to view the clip — every motion review means leaving the app for Frigate's UI or a download dialog. This change brings clip review inline: an HTML5 `<video>` player on the event detail page plays the clip with native controls, and a toggle on the still snapshot overlays Frigate's detection bounding box (`snapshot.jpg?bbox=true`) so the user can confirm what matched without leaving the app.

The feature must work on iOS Safari standalone PWA, Android Chrome, and desktop browsers. The existing snapshot-proxy auth/validation model (`requireSession` + `isValidEventId`) carries forward to clip streaming. Inline iOS playback requires HTTP Range request support, so the clip proxy is refactored from "buffer the full mp4 into an `ArrayBuffer`" to "stream and forward Range headers upstream."

## Phased rollout

The work ships in two PRs:

- **Phase 1 — Bounding-box toggle.** Low-risk, platform-neutral. Touches `isNonZeroBox`, snapshot proxy `?bbox=true` param, `showBoundingBox` prop on `EventSnapshot` and `SnapshotLightbox`, and a toggle in `CameraEventDetailPage`. No new server boundaries.
- **Phase 2 — Inline clip player.** Higher-risk: streaming Frigate client, Range pass-through proxy, new `EventClipPlayer` with error fallback, URL opt-in flag. Gated behind `?clip=inline` until verified on iOS Safari PWA.

The opt-in flag (`?clip=inline`) is removed and the player becomes default once AC1 and AC4 are observed on a real iOS device. **Status as of 2026-05-19**: flag removed (ce-gsv). Inline player is the default for any event with `has_clip = true`.

## User-Facing Behavior

```gherkin
Feature: Inline event clip playback and bounding-box overlay

  Background:
    Given I am signed in
    And I open the event detail page for a Frigate event

  Scenario: Event has a clip — collapsed "Watch clip" accordion below the snapshot
    Given the event has has_clip = true
    When the page loads
    Then I see a "Watch clip" accordion summary below the snapshot block
    And the accordion is collapsed by default
    And no <video> element is in the DOM (no metadata fetch on page load)
    When I open the accordion
    Then a <video> element mounts inside the accordion
    And the element has the playsinline attribute (iOS inline rendering)
    And the element has preload="metadata"
    And the element does not autoplay
    When I close the accordion after opening it
    Then the <video> element remains in the DOM (latched on first open) so re-opening is instant

  Scenario: Event has no clip — snapshot only
    Given has_clip = false and has_snapshot = true
    When the page loads
    Then I see the still snapshot
    And I do not see a video player
    And I do not see a "clip unavailable" error message

  Scenario: Event has clip but no snapshot
    Given has_clip = true and has_snapshot = false
    When the page loads
    Then I see the video player
    And I do not see a snapshot block
    And I do not see a bounding-box toggle

  Scenario: Bounding-box overlay toggle
    Given has_snapshot = true and a non-zero detection box exists
    When I activate the "Show detection box" toggle
    Then the snapshot src becomes /api/events/{id}/snapshot?bbox=true
    And the toggle's aria-pressed state is "true"
    When I activate the toggle again
    Then the snapshot src returns to /api/events/{id}/snapshot
    And aria-pressed is "false"

  Scenario: Toggle hidden when no detection box exists
    Given the event has no non-zero detection box
    Then the "Show detection box" toggle is not rendered

  Scenario: Lightbox zoom respects current overlay state
    Given the bounding-box overlay is on
    When I tap the snapshot to open the lightbox
    Then the lightbox displays the boxed snapshot
    Given the overlay is off
    When I tap the snapshot
    Then the lightbox displays the plain snapshot

  Scenario: Clip proxy serves inline by default
    When a client requests /api/events/{id}/clip
    Then Content-Type is video/mp4
    And Content-Disposition does NOT include "attachment"

  Scenario: Clip proxy still supports download via query param
    When a client requests /api/events/{id}/clip?download=true
    Then Content-Disposition is attachment with filename "event-{id}.mp4"

  Scenario: Clip proxy supports HTTP Range
    When a client requests /api/events/{id}/clip with header Range: bytes=0-1023
    Then the response status is 206 Partial Content
    And Content-Range is set
    And Accept-Ranges: bytes is set on full responses
    And only the requested byte range is returned

  Scenario: Snapshot proxy honors bbox param
    When a client requests /api/events/{id}/snapshot?bbox=true
    Then the upstream Frigate URL receives bbox=true
    And Content-Type is image/jpeg

  Scenario: Unauthenticated clip request
    Given I am not signed in
    When a client requests /api/events/{id}/clip
    Then status is 401 and no upstream call is made

  Scenario: Invalid event id rejected at the proxy
    When a client requests /api/events/<malicious>/clip with an id failing isValidEventId
    Then status is 400 and no upstream call is made

  Scenario: Clip fails to load — fallback renders, page stays usable
    Given the event has has_clip = true
    And the clip fails to load in the browser (network error, codec mismatch, or upstream error)
    When the video element fires its onError event
    Then the video element is replaced by a "Couldn't load clip" fallback message inside the same aspect-ratio container
    And the snapshot block still renders (even if it was hidden behind the player)
    And the InfoCards, favorite control, and confidence bar still render
    And the user can still download the clip via the InfoCard download link

  Scenario: Frigate unavailable (server-side)
    Given Frigate cannot be reached for the clip
    When a client requests /api/events/{id}/clip
    Then the proxy returns 502
    And the video element in the browser fires onError
    And the "Couldn't load clip" fallback path above is followed

  Scenario: Malformed Range header
    When a client requests /api/events/{id}/clip with header Range: bytes=abc (syntactically invalid)
    Then the proxy forwards the header unchanged to upstream Frigate
    And the response status mirrors upstream (typically 416 Range Not Satisfiable or a 200 fallback)
    And no synthetic 206 is fabricated by the proxy

  Scenario: Phase 2 opt-in flag — player gated until verified on iOS
    Given the event has has_clip = true
    And the URL does NOT contain ?clip=inline
    When the page loads
    Then I do NOT see the inline video player
    And the InfoCard "Download clip" link is unchanged
    Given the URL contains ?clip=inline
    When the page loads
    Then I see the inline video player
    (The opt-in flag is removed once AC1 and AC4 are verified on a real iOS device.)

  Scenario: SSR safety
    When the page is rendered on the server
    Then markup uses no browser-only API (window, document, Notification)
    And client hydration produces no mismatch warning
```

## Architecture Specification

### Component diff

| File                                                                   | Change                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/camera-details/components/EventClipPlayer.tsx` **(new)** | `<video controls playsInline preload="metadata">` inside an aspect-ratio container. Source is `/api/events/{id}/clip`. On the video's `onError`, the component swaps the `<video>` for a "Couldn't load clip" fallback message inside the same container. Exposes an optional `onError` callback so the parent can re-render the snapshot if it was hidden. |
| `src/features/camera-details/components/EventSnapshot.tsx`             | Accept `showBoundingBox: boolean` prop. When true, image src is `/api/events/{id}/snapshot?bbox=true`.                                                                                                                                                                                                                                                      |
| `src/features/camera-details/components/SnapshotLightbox.tsx`          | Accept `showBoundingBox: boolean` prop and append `?bbox=true` to the src when true.                                                                                                                                                                                                                                                                        |
| `src/features/camera-details/components/CameraEventDetailPage.tsx`     | Render `EventClipPlayer` above the snapshot block when `has_clip`. Add an inline "Show detection box" pill button above `EventSnapshot` when a non-zero detection box exists. Pass `showBoundingBox` state down to `EventSnapshot` and `SnapshotLightbox`.                                                                                                  |
| `src/features/camera-details/server/clip-proxy.ts`                     | Add `download?: boolean` and `rangeHeader?: string` params. Default download = false (no `Content-Disposition: attachment`). Forward `Range` upstream; return `206` with `Content-Range` + `Content-Type: video/mp4` when partial; set `Accept-Ranges: bytes` on full responses.                                                                            |
| `src/features/camera-details/server/snapshot-proxy.ts`                 | Add `bbox?: boolean` param; pass to `getEventSnapshot(eventId, { bbox })`.                                                                                                                                                                                                                                                                                  |
| `src/routes/api/events/$id/clip.ts`                                    | Parse `?download=true` from URL and `Range` header from request; pass through to `handleClipRequest`.                                                                                                                                                                                                                                                       |
| `src/routes/api/events/$id/snapshot.ts`                                | Parse `?bbox=true` from URL; pass through.                                                                                                                                                                                                                                                                                                                  |
| `src/features/shared/server/frigate/client.ts`                         | New `getEventClipStream(eventId, options?)` returning `FrigateResult<Response>` (streams body, preserves status code 200/206 and response headers `Content-Length`, `Content-Range`, `Accept-Ranges`). Existing `getEventClip` (returns `ArrayBuffer`) is removed if no remaining caller, else left in place.                                               |

### Helper

`isNonZeroBox(box: BoundingBox | null): boolean` — true when at least one coordinate is non-zero. Used by `CameraEventDetailPage` to gate toggle rendering. Lives in `src/features/camera-details/utils/boundingBox.ts` (new file).

### Constraints

- `playsInline` is mandatory on iOS Safari standalone PWA — without it, mobile Safari force-fullscreens video.
- `preload="metadata"` (never `auto`) — avoids downloading the full mp4 just by visiting the event detail page.
- No autoplay; controls only. Browser policy will block autoplay anyway without `muted`, but explicit is better.
- The existing in-process Frigate response cache (`cache.ts`) only memoizes JSON; the streaming clip path does not interact with it.
- The bbox toggle is `useState(false)` → server and client agree on the first paint (SSR-safe).
- No cross-feature imports. Everything stays inside `features/camera-details/`.
- Range support: forward the `Range` header upstream to Frigate; pass through Frigate's `206` + `Content-Range` to the client. If no `Range` header is present, return `200` with `Accept-Ranges: bytes` so the browser knows it may issue Range requests.
- Auth model is unchanged: every request to the clip / snapshot proxy still checks `useSession` and rejects unauthenticated calls with `401`.
- Streaming abstraction: introduce a sibling `frigateStream(path, { rangeHeader })` helper in `client.ts`. Do not retrofit `frigateFetch` — its `extract: (res) => Promise<T>` signature consumes the body and is incompatible with stream pass-through.
- Header propagation: `Content-Length`, `Content-Range`, `Content-Type`, and `Accept-Ranges` from the upstream response must be propagated back to the client unchanged. iOS Safari uses `Content-Length` + `Accept-Ranges` to decide whether to issue Range requests; losing either silently breaks AC4.
- Malformed `Range` headers are forwarded unchanged — the proxy does not parse or rewrite Range. Whatever upstream returns (typically 416 or 200 fallback) is what the client receives.
- Phase 2 opt-in: the `EventClipPlayer` only renders when `new URL(window.location.href).searchParams.has('clip') && ... === 'inline'`. Implemented in `CameraEventDetailPage` via a small `useUrlFlag('clip', 'inline')` hook (SSR-safe — defaults to `false` until `useEffect` runs). After AC1/AC4 verification, the flag check is removed and the player becomes default.

### Out of scope

- Timeline scrubbing strip with sub-event keyframes (future epic; would use `getTimeline`).
- Multi-event clip stitching / continuous playback across events.
- 24/7 recording playback (Frigate's `/api/recordings/...` is not touched).
- Custom video player UI (we rely on native HTML5 controls).
- Sharing or exporting frames from the clip.

## Acceptance Criteria

| #    | Criterion                                                                                                              | Verification                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| AC1  | Inline playback works on iOS Safari standalone PWA                                                                     | Manual: install PWA on iOS, open event with clip, press play, video plays inline (not fullscreen-takeover)               |
| AC2  | Inline playback works on Android Chrome                                                                                | Manual: open event with clip on Android Chrome, press play, video plays inline                                           |
| AC3  | Inline playback works on desktop Chrome, Firefox, Safari                                                               | Manual: each browser, open event, press play                                                                             |
| AC4  | Mid-clip seek works on iOS Safari                                                                                      | Manual: scrub the timeline to ~50% of clip duration; playback resumes from new position without re-buffering from byte 0 |
| AC5  | Existing "Download clip" InfoCard link still triggers a file download                                                  | Manual + automated proxy test for `?download=true`                                                                       |
| AC6  | Bounding-box toggle swaps snapshot src and updates `aria-pressed`                                                      | Automated `@testing-library/react` test                                                                                  |
| AC7  | Toggle is absent in DOM when no detection box exists                                                                   | Automated render test                                                                                                    |
| AC8  | Clip proxy returns 401 unauthenticated, 400 for invalid id, 502 on Frigate failure                                     | Automated proxy unit tests                                                                                               |
| AC9  | `Range: bytes=0-N` request returns `206` with `Content-Range`; `Accept-Ranges: bytes` set on full responses            | Automated proxy unit test (stubbed upstream)                                                                             |
| AC10 | `?download=true` sets `Content-Disposition: attachment`; absence does not                                              | Automated proxy unit test                                                                                                |
| AC11 | Snapshot proxy with `?bbox=true` calls `getEventSnapshot` with `{ bbox: true }`                                        | Automated proxy unit test                                                                                                |
| AC12 | Lightbox respects current overlay state                                                                                | Automated render test on `SnapshotLightbox` + `CameraEventDetailPage`                                                    |
| AC13 | No SSR/hydration warnings in browser console on event detail page                                                      | Manual: open dev tools console                                                                                           |
| AC14 | TDD discipline followed: every proxy/component change has a failing test landed before implementation                  | Code review (commit history shows red → green)                                                                           |
| AC15 | No cross-feature imports introduced                                                                                    | `bun run knip` + grep check on new files                                                                                 |
| AC16 | `bun run test`, `bun run lint`, `bun run build` all pass                                                               | CI / pre-PR gate                                                                                                         |
| AC17 | Video `onError` swaps in a "Couldn't load clip" fallback and the page remains usable (snapshot + InfoCards + favorite) | Automated render test on `EventClipPlayer` + `CameraEventDetailPage`                                                     |
| AC18 | Range proxy returns the requested byte slice (body), not the full mp4, on a 206 response                               | Automated proxy test asserting body length matches `Content-Range`                                                       |
| AC19 | `Content-Length` from upstream survives the proxy on both 200 and 206 responses                                        | Automated proxy test                                                                                                     |
| AC20 | Malformed `Range` header is forwarded unchanged; proxy does not synthesize 206                                         | Automated proxy test                                                                                                     |
| AC21 | Phase 2 player is hidden by default and only renders when `?clip=inline` is on the URL                                 | Automated render test                                                                                                    |
| AC22 | Bun-runtime smoke test confirms streaming + Range survive the dev server end-to-end before Phase 2 ships               | Manual: dev server + curl, recorded in beads                                                                             |

## Consistency Gate

- [x] Intent is unambiguous — every concrete behavior is specified or explicitly out of scope
- [x] Every behavior has a corresponding BDD scenario (15 scenarios cover all intent claims and acceptance criteria)
- [x] Architecture constrains without over-engineering — Range support is the only non-trivial addition, and it is required for AC1/AC4
- [x] Terminology consistent across artifacts: "clip", "snapshot", "bounding-box overlay" / "detection box", "Show detection box" toggle
- [x] No contradictions between artifacts

**Verdict: PASS** — proceed to planning.
