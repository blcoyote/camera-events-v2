# Plan: Inline clip player with streaming + Range (Phase 2 of inline-event-clip-playback)

**Created**: 2026-05-19
**Branch**: TBD (separate branch off `main` after Phase 1 merges)
**Status**: approved
**Spec**: [docs/specs/inline-event-clip-playback.md](../docs/specs/inline-event-clip-playback.md)
**Beads epic**: ce-bli
**Phase**: 2 of 2 (higher-risk; streaming + Range + iOS verification)
**Prereq**: Phase 1 merged ([inline-event-clip-playback-1-bbox-toggle.md](./inline-event-clip-playback-1-bbox-toggle.md))

## Goal

Add an inline HTML5 `<video>` player to the event detail page, served by a clip proxy refactored from "buffer the full mp4 into ArrayBuffer + force download" to "stream + forward Range headers + serve inline by default." Ships behind a `?clip=inline` URL opt-in flag until cross-platform playback (especially iOS Safari standalone PWA) is verified on a real device, at which point the flag is removed in a follow-up commit.

## Acceptance Criteria

Subset of the full spec ACs relevant to Phase 2:

- [ ] AC1: Inline playback works on iOS Safari standalone PWA (manual, real device)
- [ ] AC2: Inline playback works on Android Chrome (manual)
- [ ] AC3: Inline playback works on desktop Chrome / Firefox / Safari (manual)
- [ ] AC4: Mid-clip seek works on iOS Safari (manual, validates Range end-to-end)
- [ ] AC5: Existing "Download clip" InfoCard link still triggers a file download
- [ ] AC8: Clip proxy returns 401 unauthenticated, 400 for invalid id, 502 on Frigate failure (automated)
- [ ] AC9: `Range: bytes=0-N` returns 206 + `Content-Range`; full responses set `Accept-Ranges: bytes` (automated)
- [ ] AC10: `?download=true` sets `Content-Disposition: attachment`; absence does not (automated)
- [ ] AC13: No SSR/hydration warnings (manual)
- [ ] AC14: TDD discipline
- [ ] AC15: No cross-feature imports introduced
- [ ] AC16: `bun run test`, `bun run lint`, `bun run build` all pass
- [ ] AC17: Video `onError` swaps in a "Couldn't load clip" fallback and the page remains usable (automated)
- [ ] AC18: 206 response body length matches `Content-Range` (proxy actually returns the slice, not the full mp4) (automated)
- [ ] AC19: `Content-Length` from upstream survives the proxy on both 200 and 206 (automated)
- [ ] AC20: Malformed `Range` header is forwarded unchanged; proxy does not synthesize 206 (automated)
- [ ] AC21: Player is hidden by default; renders only when `?clip=inline` is on the URL (automated)
- [ ] AC22: Bun-runtime smoke confirms streaming + Range survive end-to-end (manual)

## User-Facing Behavior (Phase 2 scenarios)

```gherkin
Feature: Inline event clip playback

  Background:
    Given I am signed in
    And I open the event detail page for a Frigate event with ?clip=inline on the URL

  Scenario: Event has a clip — player renders inline
    Given the event has has_clip = true
    When the page loads
    Then I see an inline video element with native HTML5 controls
    And the element has the playsinline attribute (iOS inline rendering)
    And the element has preload="metadata" (no full download on page load)
    And the element does not autoplay
    And the video element appears above the snapshot block

  Scenario: Event has no clip — snapshot only
    Given has_clip = false and has_snapshot = true
    Then I see the still snapshot and no video player

  Scenario: Event has clip but no snapshot
    Given has_clip = true and has_snapshot = false
    Then I see the video player and no snapshot block

  Scenario: Phase 2 opt-in flag — player gated until verified on iOS
    Given the URL does NOT contain ?clip=inline
    When the page loads
    Then I do NOT see the inline video player
    Given the URL contains ?clip=inline
    When the page loads
    Then I see the inline video player

  Scenario: Clip fails to load — fallback renders, page stays usable
    Given the video element fires its onError event (network error, codec mismatch, or upstream error)
    Then the video element is replaced by a "Couldn't load clip" fallback inside the same aspect-ratio container
    And the snapshot block still renders
    And the InfoCards, favorite control, and confidence bar still render
    And the user can still download the clip via the InfoCard download link

  Scenario: Clip proxy serves inline by default
    When a client requests /api/events/{id}/clip
    Then Content-Type is video/mp4
    And Content-Disposition does NOT include "attachment"
    And Accept-Ranges: bytes is set
    And Content-Length is set from the upstream response

  Scenario: Clip proxy still supports download via query param
    When a client requests /api/events/{id}/clip?download=true
    Then Content-Disposition is attachment with filename "event-{id}.mp4"

  Scenario: Clip proxy supports HTTP Range
    When a client requests /api/events/{id}/clip with header Range: bytes=0-1023
    Then the response status is 206 Partial Content
    And Content-Range mirrors the upstream Frigate response
    And Content-Length matches the byte slice (not the full mp4)
    And the body bytes equal the requested slice from upstream

  Scenario: Malformed Range header
    When a client requests /api/events/{id}/clip with header Range: bytes=abc
    Then the proxy forwards the header unchanged to upstream Frigate
    And the response status mirrors upstream (typically 416 or a 200 fallback)
    And no synthetic 206 is fabricated by the proxy

  Scenario: Unauthenticated clip request
    Given I am not signed in
    When a client requests /api/events/{id}/clip
    Then status is 401 and no upstream call is made

  Scenario: Invalid event id rejected at the proxy
    When a client requests /api/events/<malicious>/clip with an id failing isValidEventId
    Then status is 400 and no upstream call is made

  Scenario: Frigate unavailable (server-side)
    Given Frigate cannot be reached for the clip
    When a client requests /api/events/{id}/clip
    Then the proxy returns 502
```

## Steps

### Step 1: Streaming Frigate clip client with Range support (beads: ce-mcx)

**Complexity**: complex
**Scenarios**: "Clip proxy supports HTTP Range" (foundation), "Clip proxy serves inline by default" (foundation), "Malformed Range header" (foundation)
**RED**: Add `client.test.ts` cases for a new sibling helper `getEventClipStream(eventId, { rangeHeader? })`:

- No Range header → upstream called WITHOUT a `Range` header. Result is `{ ok: true, data: { status: 200, body, headers } }` where `body` is a `ReadableStream` and `headers` exposes `Content-Type: video/mp4`, `Content-Length: <full>`, `Accept-Ranges: bytes`.
- With `Range: bytes=0-1023` → upstream called WITH that header forwarded unchanged. Result has `status: 206` and `headers` exposes `Content-Range: bytes 0-1023/<full>` and `Content-Length: 1024`.
- With malformed `Range: bytes=abc` → upstream called WITH the header unchanged. Result mirrors upstream (whether 416 or 200) without synthesis.
- Upstream non-OK (5xx) → `{ ok: false, error, status }`.
- Network failure / timeout → `{ ok: false, error }`.
- Auth header / cookies are NOT forwarded (Frigate is unauthenticated upstream).
- Mock-client (`mock-client.ts`) gets a matching implementation so `FRIGATE_MOCK=true` still produces a playable stream.
  **GREEN**: Implement a new sibling helper `frigateStream(path, { rangeHeader })` and `getEventClipStream(eventId, opts)` in `client.ts`. Do NOT retrofit `frigateFetch` — its `extract` callback signature consumes the body and is incompatible with stream pass-through. Use `fetch` with the Range header forwarded; return the underlying `ReadableStream` body and the relevant subset of upstream response headers. Bypass the JSON cache (which only memoizes `frigateGet` JSON calls anyway).
  **REFACTOR**: If after `frigateStream` lands there are 2+ callers, generalize. Otherwise leave alone.
  **Files**: `src/features/shared/server/frigate/client.ts`, `src/features/shared/server/frigate/client.test.ts`, `src/features/shared/server/frigate/mock-client.ts`, `src/features/shared/server/frigate/mock-client.test.ts`
  **Commit**: `feat(frigate): add streaming getEventClipStream with Range pass-through`

### Step 2: Bun-runtime streaming smoke test (beads: NEW — `ce-bun-smoke`)

**Complexity**: standard (no code, but high information value)
**Scenarios**: validates AC22 before Step 3 commits to the proxy refactor.
**RED**: N/A — exploratory verification.
**GREEN**: Spin up a minimal route handler that returns the result of `getEventClipStream` directly. Run dev server (`bun run dev`). Curl with `Range: bytes=0-1023`. Verify:

- Status 206 received.
- `Content-Range` and `Content-Length: 1024` are present on the response.
- Response body length is 1024 bytes (not the full mp4).
- Without Range, status 200 with `Accept-Ranges: bytes` and a `Content-Length` matching the full mp4.
  Record the curl invocations and outputs as a comment on the beads task. If any check fails, REVISIT Step 3's design (fallback option: synthetic Range slicing on a buffered response) before continuing.
  **REFACTOR**: N/A.
  **Files**: A throwaway scratch route at `src/routes/api/_smoke/clip-stream.ts` is allowed for the duration of this step. It MUST be deleted as the final action of closing the beads task — the smoke does not leave artifacts in the tree. Test that the smoke route file is absent before closing `ce-1vi`.
  **Commit**: N/A — purely informational. The route addition + deletion is reverted, not committed.

### Step 3: Clip proxy serves inline, forwards Range, supports `?download=true` (beads: ce-j2v)

**Complexity**: complex
**Scenarios**: "Clip proxy serves inline by default", "Clip proxy still supports download via query param", "Clip proxy supports HTTP Range", "Malformed Range header", "Unauthenticated clip request", "Invalid event id rejected at the proxy", "Frigate unavailable (server-side)"
**RED**: Extend `clip-proxy.test.ts`:

- Default (no params): 200, `Content-Type: video/mp4`, `Accept-Ranges: bytes`, `Content-Length` propagated from upstream, no `Content-Disposition`.
- `?download=true`: 200 with `Content-Disposition: attachment; filename="event-{id}.mp4"`.
- `Range: bytes=0-1023` forwarded: response status 206, `Content-Range` from upstream, `Content-Length: 1024` propagated, **response body length equals 1024 bytes** (assert the actual byte count, not just the header).
- Two-call integration: first call no Range (200 + `Accept-Ranges`), second call with `Range: bytes=1024-2047` against the same proxy returns 206 + correct slice.
- Malformed `Range: bytes=abc`: header forwarded unchanged; response status mirrors upstream; proxy does not synthesize 206.
- Unauth (401), invalid id (400), upstream failure (502) all preserved.
- All proxy params accessed via an options object (`handleClipRequest(eventId, isAuthenticated, options?)`) to avoid 4-positional-param bloat.
  **GREEN**: Refactor `handleClipRequest` to accept `(eventId, isAuthenticated, options?: { download?: boolean, rangeHeader?: string })`. Switch upstream call from `getEventClip` (ArrayBuffer) to `getEventClipStream` (streaming). Stream the response body through; propagate `status`, `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`. Only set `Content-Disposition: attachment` when `options.download === true`. Update `src/routes/api/events/$id/clip.ts` to parse `?download=true` from URL and read the `Range` header from the incoming request and pass both into the options object. Grep for remaining callers of `getEventClip`; if none, remove it in this same commit, else leave alongside.
  **REFACTOR**: Confirm the proxy doesn't unnecessarily buffer the response in memory (it should hand back the upstream `ReadableStream`).
  **Files**: `src/features/camera-details/server/clip-proxy.ts`, `src/features/camera-details/server/clip-proxy.test.ts`, `src/routes/api/events/$id/clip.ts`, possibly `src/features/shared/server/frigate/client.ts` (delete `getEventClip` if unused)
  **Commit**: `feat(camera-details): stream clip inline with Range support, gate download via query param`

### Step 4: `EventClipPlayer` component with onError fallback (beads: ce-xf0 — scope expanded)

**Complexity**: standard
**Scenarios**: "Event has a clip — player renders inline", "Clip fails to load — fallback renders"
**RED**: `EventClipPlayer.test.tsx`:

- Renders a `<video>` with src `/api/events/{eventId}/clip`, `controls`, `playsInline`, `preload="metadata"`, no `autoplay`.
- Renders inside an aspect-ratio wrapper matching the snapshot (assert class).
- Has descriptive `aria-label`.
- When the `<video>` fires `onError`, the component swaps in a "Couldn't load clip" fallback message inside the same wrapper (no video element remains).
- The component calls the optional `onError` prop callback if provided when the video errors.
- Initial render is SSR-safe (no `window` access during render).
  **GREEN**: Implement the component. Use `useState<'playing' | 'errored'>('playing')` to swap between the `<video>` and the fallback. Optional `onError?: () => void` prop.
  **REFACTOR**: Extract aspect-ratio classes if shared with `EventSnapshot`.
  **Files**: `src/features/camera-details/components/EventClipPlayer.tsx` (new), `src/features/camera-details/components/EventClipPlayer.test.tsx` (new)
  **Commit**: `feat(camera-details): add EventClipPlayer with onError fallback`

### Step 5: `useUrlFlag` SSR-safe URL flag hook (beads: NEW — `ce-url-flag`)

**Complexity**: standard
**Scenarios**: "Phase 2 opt-in flag" (foundation)
**RED**: `useUrlFlag.test.ts`:

- Returns `false` on the server (no `window`).
- Returns `false` on the client when the URL has no matching param.
- Returns `false` when the URL has the param but the wrong value.
- Returns `true` when the URL has `?clip=inline` (and the hook was called as `useUrlFlag('clip', 'inline')`).
- Updates reactively when the URL changes. Reactive mechanism: subscribe via TanStack Router's `useRouterState` or `useLocation` hook (not `popstate`, which doesn't fire on `pushState`). Pick one mechanism and assert it in the test.
  **GREEN**: Implement using `useEffect` + `URL` constructor on `window.location.href`. Default state `false` (SSR-safe). Subscribe to router URL changes.
  **REFACTOR**: If the hook ends up only used once, consider inlining. Probably worth keeping as a hook since it captures the SSR-safety pattern.
  **Files**: `src/features/camera-details/hooks/useUrlFlag.ts` (new), `src/features/camera-details/hooks/useUrlFlag.test.ts` (new)
  **Commit**: `feat(camera-details): add useUrlFlag SSR-safe hook for URL feature flags`

### Step 6: Wire player + opt-in flag into `CameraEventDetailPage` (beads: NEW — `ce-6pr-player`, with ce-6pr renamed to `ce-6pr-bbox` for Phase 1)

**Complexity**: standard
**Scenarios**: "Player renders inline", "Player hidden by default", "Phase 2 opt-in flag", "Clip fails to load — fallback renders", "Event has clip but no snapshot"
**RED**: Extend `CameraEventDetailPage.test.tsx`:

- `?clip=inline` + `has_clip=true` → `<video>` is present (asserted via `await waitFor(...)` because `useUrlFlag` resolves to `true` only after `useEffect` runs); appears before snapshot in DOM order (via `compareDocumentPosition`).
- No `?clip=inline` → no `<video>` regardless of `has_clip` (no `waitFor` needed; the negative is stable from first paint).
- `has_clip=true, has_snapshot=false, ?clip=inline` → video present, no snapshot block.
- `<video>` `onError` fires → fallback message visible, snapshot block visible (even if it would have been "below the player"), InfoCards and favorite still rendered.
  **GREEN**: Use `useUrlFlag('clip', 'inline')`. When true AND `event.has_clip`, render `<EventClipPlayer>` above the snapshot block. Pass an `onError` callback into the player that triggers a parent state update to ensure the snapshot is rendered (it is by default — this is defensive). Player and snapshot are both visible when both clip and snapshot exist (per layout decision).
  **REFACTOR**: If the layout state grows beyond `showBoundingBox + clipErrored`, consider a reducer.
  **Files**: `src/features/camera-details/components/CameraEventDetailPage.tsx`, `src/features/camera-details/components/CameraEventDetailPage.test.tsx`
  **Commit**: `feat(camera-details): render inline clip player behind ?clip=inline opt-in flag`

### Step 7: Cross-platform manual verification (beads: ce-4pb)

**Complexity**: standard (manual verification)
**Scenarios**: All "must work on iOS / Android / desktop" claims; AC1–AC4, AC13
**RED**: N/A.
**GREEN**: Open the event detail page with `?clip=inline` and run the manual checklist:

- iOS Safari standalone PWA: play inline (not fullscreen takeover) → scrub to ~50% → playback resumes correctly.
- Android Chrome: same.
- Desktop Chrome, Firefox, Safari: same.
- Force a clip error (e.g. temporarily break Frigate URL): fallback message + snapshot + InfoCards still render.
- DevTools console has no hydration warnings.
- "Download clip" link in InfoCard still works.
- Pull-to-refresh doesn't conflict with video gestures.
- SPA navigation away from event with playing video — note behavior (auto-pause vs continue).
  Record results (pass/fail, browser version, screenshots, video) as a comment on `ce-4pb`. If all pass, file a follow-up beads task to flip `useUrlFlag('clip', 'inline')` to default-on and remove the gate.
  **REFACTOR**: N/A.
  **Files**: None.
  **Commit**: N/A.

### Step 8: (Follow-up, post-verification) Remove opt-in flag

**Complexity**: trivial
**RED**: N/A — flip of a default.
**GREEN**: Replace `const showPlayer = useUrlFlag('clip', 'inline')` with `const showPlayer = true`. Inline-remove the hook if no other caller exists.
**Files**: `src/features/camera-details/components/CameraEventDetailPage.tsx`, possibly `src/features/camera-details/hooks/useUrlFlag.ts` (delete if unused)
**Commit**: `feat(camera-details): remove ?clip=inline opt-in; inline clip player on by default`

> Step 8 is intentionally not gated by this plan's pre-PR gate — it lands as a separate small PR. **Gate**: the Step 8 PR may only be opened when `ce-4pb` is closed with status `pass`, screenshots/video attached, and explicit AC1+AC4 confirmation in the beads comment. Otherwise the flag stays in place.

## Complexity Classification

| Step | Rating   | Justification                                                                                                     |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | complex  | New server boundary (streaming + Range pass-through); first time bypassing the ArrayBuffer pattern                |
| 2    | standard | No code change, but the verification gates the rest of Phase 2                                                    |
| 3    | complex  | Range proxy correctness, body-slice assertion, status-code propagation, breaking change to clip endpoint behavior |
| 4    | standard | New component with onError fallback                                                                               |
| 5    | standard | New SSR-safe hook                                                                                                 |
| 6    | standard | Integration; depends on most prior steps                                                                          |
| 7    | standard | Manual but high-value verification                                                                                |
| 8    | trivial  | Single-line default flip after evidence is in                                                                     |

## Pre-PR Quality Gate

- [ ] All Phase 2 tests pass (`bun run test`)
- [ ] Type check passes
- [ ] Linter passes (`bun run lint`)
- [ ] Production build succeeds (`bun run build`)
- [ ] `/code-review` passes (security-review and performance-review especially relevant for the new streaming proxy)
- [ ] Spec compliance: every Phase 2 Gherkin scenario has at least one corresponding test
- [ ] `bun run knip` reports no new unused exports
- [ ] AC22 evidence (curl output) attached to `ce-bun-smoke`
- [ ] Phase 1 (bbox toggle) already merged to main
- [ ] Manual verification (Step 7) recorded — AC1–AC4 pass on at least one iOS device, one Android, one desktop browser

## Risks & Open Questions

- **R1 — Range support in TanStack Start's runtime**: TanStack Start uses Nitro; Bun in prod, Node in dev. Step 2's smoke test exists explicitly to validate this end-to-end before Step 3 ships. **Fallback if R1 materializes**: synthetic Range slicing on a buffered response — keep `getEventClip`, slice the ArrayBuffer server-side in the proxy based on the Range header. Loses memory efficiency but keeps the iOS UX correct.
- **R2 — `Content-Length` stripping**: Bun/Node may recompute or strip `Content-Length` when forwarding a `ReadableStream` body. iOS Safari uses `Content-Length` + `Accept-Ranges` to decide whether to issue Range requests. Step 1 and Step 3 RED assert `Content-Length` propagation; Step 2 verifies end-to-end.
- **R3 — Existing `getEventClip` call sites**: Step 3 RED includes a grep for remaining callers. The current InfoCard download link uses `/api/events/{id}/clip` (the route, not the client function directly), so it doesn't import `getEventClip` and is safe.
- **R4 — Bounding box on multi-object events**: outside Phase 2 scope; addressed (or not) in Phase 1.
- **R5 — Clip mp4 codec compatibility on iOS**: Frigate clips are typically H.264 + AAC. Step 7 verifies on a real device. If the user's Frigate config produces H.265, the fallback path (AC17) catches it gracefully.
- **R6 — iOS device availability**: mitigated by the `?clip=inline` opt-in flag. Phase 2 is mergeable without an iOS device because the change is hidden from regular page loads. Step 8 (default flip) is the only step gated on device evidence.
- **R7 — Auto-pause on SPA navigation**: undefined behavior across browsers. Step 7 records actual behavior; addressed in a follow-up only if annoying.
- **OQ1 — `Content-Length` on Bun streams**: confirmed only after Step 2 runs. If Bun strips it, plan adjusts to either preserve it manually or fall back to the buffered approach in R1.

## What this plan does NOT do

- Bounding-box toggle (Phase 1)
- Timeline scrubbing strip / sub-event keyframes (future epic)
- Multi-event clip stitching
- 24/7 recording playback
- Captions / a11y video tracks (Frigate doesn't provide them — explicitly out of scope)

## Plan Review Summary

Four reviewers (Acceptance Test, Design & Architecture, UX, Strategic) all approve with no blockers. Aggregated warnings and observations below.

### Warnings

- **W1 (Acceptance)** — Step 3 RED for the 200-response path should pin upstream's full-mp4 `Content-Length` explicitly (not just "propagated") so AC19 has a hard upper bound, not just a "non-zero" check.
- **W2 (UX, Strategic)** — `?clip=inline` is invisible to normal users (which is the point during gating) but the flag must not leak — Step 8 PR is gated on `ce-4pb` closed-pass with attached evidence. Treat the flag as time-bound; if iOS access stays unavailable for weeks, file a beads task to revisit (or invert) Phase 2's priority.
- **W3 (Strategic)** — Step 2's smoke test runs against a throwaway scratch route. The smoke proves Bun streaming works in isolation; Step 3 RED is the real proof that the proxy code path works. Treat Step 2 as a _no-go signal_, not a _go signal_.
- **W4 (UX)** — Cellular data cost: `preload="metadata"` fires once per event detail visit. For a user opening 20 events in a row on cellular, that's 20 metadata fetches. Verify on a throttled connection in Step 7.
- **W5 (Acceptance, Design)** — `useUrlFlag` reactive update mechanism narrowed to TanStack Router hooks; reaffirm in the implementation that `popstate` is NOT used.
- **W6 (UX)** — On clip error, the snapshot below the player won't shift up to fill the dead rectangle. Acceptable, but visual check in Step 7.
- **W7 (Design)** — `useUrlFlag` REFACTOR step should explicitly note: if a second feature needs this hook later, promote to `features/shared/hooks/` rather than copy-paste. Until then, it lives in `features/camera-details/hooks/`.

### Observations

- Phase 2 is mergeable without an iOS device — `?clip=inline` opt-in keeps the feature dormant until verified. Reversibility is preserved up to Step 8.
- `EventClipPlayer` onError → `useState<'playing' | 'errored'>` with optional parent callback is a clean separation; AC17 covered by both component-level and page-level tests.
- AC18 (body bytes match `Content-Range`) plus the two-call integration test in Step 3 gives an automated equivalent of AC4 (manual mid-clip seek).
- `getEventClip` removal is gated on grep evidence at Step 3 GREEN; the existing InfoCard download link uses the route, not the function directly, so it survives.
- R1 fallback (synthetic Range slicing on a buffered response) is named — defensible recovery if Bun strips `Content-Length` or breaks stream pass-through.
- Pull-to-refresh × video gesture conflict is in the Step 7 manual checklist — good.
- Phase split is clean: 22 ACs total are disjoint across phases; pre-PR gates are concrete.
