# Plan: Bounding-box overlay toggle (Phase 1 of inline-event-clip-playback)

**Created**: 2026-05-19
**Branch**: view-event-clip
**Status**: approved
**Spec**: [docs/specs/inline-event-clip-playback.md](../docs/specs/inline-event-clip-playback.md)
**Beads epic**: ce-bli
**Phase**: 1 of 2 (low-risk UI; ships independently of the clip-player work)

## Goal

Add a "Show detection box" toggle on the event detail page that overlays Frigate's bounding box on the still snapshot. Pure UI + one small server-side parameter change. Platform-neutral — verifies in any browser. No new server boundaries. This ships first because it has none of Phase 2's iOS-device dependencies or streaming complexity, and the user gets immediate value (confirming what was matched).

## Acceptance Criteria

Subset of the full spec ACs relevant to Phase 1:

- [ ] AC6: Bounding-box toggle swaps snapshot src and updates `aria-pressed` (automated)
- [ ] AC7: Toggle is absent from DOM when no detection box exists (automated)
- [ ] AC11: Snapshot proxy with `?bbox=true` calls `getEventSnapshot` with `{ bbox: true }` (automated)
- [ ] AC12: Lightbox respects current overlay state (automated)
- [ ] AC13: No SSR/hydration warnings in browser console (manual smoke)
- [ ] AC14: TDD discipline (red commits visible in history)
- [ ] AC15: No cross-feature imports introduced
- [ ] AC16: `bun run test`, `bun run lint`, `bun run build` all pass

## User-Facing Behavior (Phase 1 scenarios)

```gherkin
Feature: Bounding-box overlay toggle

  Background:
    Given I am signed in
    And I open the event detail page for a Frigate event

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

  Scenario: Snapshot proxy honors bbox param
    When a client requests /api/events/{id}/snapshot?bbox=true
    Then the upstream Frigate URL receives bbox=true
    And Content-Type is image/jpeg

  Scenario: Unauthenticated bbox request
    Given I am not signed in
    When a client requests /api/events/{id}/snapshot?bbox=true
    Then status is 401 and no upstream call is made
```

## Steps

### Step 1: `isNonZeroBox` helper (beads: ce-s8a)

**Complexity**: trivial
**Scenarios**: "Toggle hidden when no detection box exists"
**RED**: Write `boundingBox.test.ts` covering: `null` input → false; `[0,0,0,0]` → false; `[0,0.5,0,0]` → true; `[0.1,0.2,0.3,0.4]` → true.
**GREEN**: Implement `isNonZeroBox(box: BoundingBox | null): boolean`.
**REFACTOR**: None needed.
**Files**: `src/features/camera-details/utils/boundingBox.ts` (new), `src/features/camera-details/utils/boundingBox.test.ts` (new)
**Commit**: `feat(camera-details): add isNonZeroBox helper for detection box presence`

### Step 2: Snapshot proxy accepts `?bbox=true` (beads: ce-8w6)

**Complexity**: standard
**Scenarios**: "Snapshot proxy honors bbox param", "Unauthenticated bbox request"
**RED**: Extend `snapshot-proxy.test.ts` with:

- `?bbox=true` → `getEventSnapshot` is called with `{ bbox: true }`.
- No bbox param → `getEventSnapshot` is called without bbox option (or with `{ bbox: false }`).
- Unauth → 401 returned, `getEventSnapshot` is never called (even with `?bbox=true`).
- Invalid event id → 400 returned, `getEventSnapshot` is never called.
  **GREEN**: Add optional `bbox?: boolean` parameter to `handleSnapshotRequest`; forward to `getEventSnapshot(eventId, { bbox })`. Update `src/routes/api/events/$id/snapshot.ts` to parse `?bbox=true` from the URL and pass through.
  **REFACTOR**: None expected — same shape as existing `download` flag.
  **Files**: `src/features/camera-details/server/snapshot-proxy.ts`, `src/features/camera-details/server/snapshot-proxy.test.ts`, `src/routes/api/events/$id/snapshot.ts`
  **Commit**: `feat(camera-details): forward bbox query param through snapshot proxy`

### Step 3: `showBoundingBox` prop on `EventSnapshot` + `SnapshotLightbox` (beads: ce-36m)

**Complexity**: standard
**Scenarios**: "Bounding-box overlay toggle" (asserts on src), "Lightbox zoom respects current overlay state"
**RED**: Extend `EventSnapshot.test.tsx` (create if missing) and `SnapshotLightbox.test.tsx`:

- `showBoundingBox={false}` or omitted → img src is `/api/events/{id}/snapshot`.
- `showBoundingBox={true}` → img src is `/api/events/{id}/snapshot?bbox=true`.
- Existing zoom-button / close-button behavior is preserved (regression guard).
  **GREEN**: Add the optional prop to both components; compute src conditionally.
  **REFACTOR**: If `snapshotSrc(eventId, { bbox })` is used in 2+ places, extract a small helper into `utils/snapshotSrc.ts`.
  **Files**: `src/features/camera-details/components/EventSnapshot.tsx`, `src/features/camera-details/components/EventSnapshot.test.tsx` (new if missing), `src/features/camera-details/components/SnapshotLightbox.tsx`, `src/features/camera-details/components/SnapshotLightbox.test.tsx`
  **Commit**: `feat(camera-details): thread showBoundingBox prop through snapshot and lightbox`

### Step 4: Wire toggle into `CameraEventDetailPage` (beads: ce-6pr renamed to "bbox toggle")

**Complexity**: standard
**Scenarios**: "Bounding-box overlay toggle", "Toggle hidden when no detection box exists", "Lightbox zoom respects current overlay state"
**RED**: Extend `CameraEventDetailPage.test.tsx`:

- Event with non-zero `event.box` (or `event.data.box`) → "Show detection box" toggle is in the DOM with `aria-pressed="false"` initially.
- Event with null `event.box` AND zero `event.data.box` → toggle is absent.
- Clicking the toggle flips `aria-pressed` to "true" and changes `EventSnapshot`'s `src` to include `?bbox=true`.
- Clicking again flips back.
- Opening the lightbox while toggle is on → lightbox src includes `?bbox=true`.
- Toggle button has `min-h-11` (touch-target) and visible label.
- Renders correctly on SSR (no `window` access during initial render — `useState(false)` initial).
  **GREEN**: Add `useState<boolean>(false)` for `showBoundingBox`. Render an inline pill `<button>` above the snapshot block when `isNonZeroBox(event.box) || isNonZeroBox(event.data.box)`. Button toggles state, has `aria-pressed`, and labels "Show detection box". Pass `showBoundingBox` to `EventSnapshot` and `SnapshotLightbox`.
  **REFACTOR**: If the JSX block becomes busy (>30 lines), extract a `SnapshotWithToggle` sub-component.
  **Files**: `src/features/camera-details/components/CameraEventDetailPage.tsx`, `src/features/camera-details/components/CameraEventDetailPage.test.tsx`
  **Commit**: `feat(camera-details): render bounding-box toggle on event detail page`

## Complexity Classification

| Step | Rating   | Justification                                                           |
| ---- | -------- | ----------------------------------------------------------------------- |
| 1    | trivial  | 3-line pure function with exhaustive unit tests                         |
| 2    | standard | Param threading through proxy + route; auth/validation already in place |
| 3    | standard | Prop addition with src derivation                                       |
| 4    | standard | Integration glue with state management; needs SSR-safe initial state    |

## Pre-PR Quality Gate

- [ ] All Phase 1 tests pass (`bun run test`)
- [ ] Type check passes
- [ ] Linter passes (`bun run lint`)
- [ ] Production build succeeds (`bun run build`)
- [ ] `/code-review` passes
- [ ] Manual smoke: open an event with a known detection box in dev, toggle the overlay on/off, open lightbox in both states, confirm bbox appears/disappears
- [ ] No SSR/hydration warnings in browser console
- [ ] `bun run knip` reports no new unused exports

## Risks & Open Questions

- **R1 — Box presence heuristic**: `isNonZeroBox` checks `event.box || event.data.box`. If a real event surfaces a non-zero `event.data.box` but the rendered `?bbox=true` produces a visually misleading box (e.g. wrong frame), the toggle is technically working but UX-confusing. Mitigation: visual inspection during the pre-PR manual smoke.
- **R2 — Touch-target spacing**: the new toggle sits near the existing zoom button (corner of snapshot). Step 4 asserts `min-h-11` but the visual gap between buttons is not codified. Mitigation: visual check in manual smoke.

## What this plan does NOT do (deferred to Phase 2)

- Inline video player (`EventClipPlayer`)
- Streaming Frigate client / Range support
- Clip proxy refactor
- URL opt-in flag (`?clip=inline`)
- iOS Safari PWA / Android Chrome / desktop browser playback verification

Phase 2 plan: [inline-event-clip-playback-2-clip-player.md](./inline-event-clip-playback-2-clip-player.md).

## Plan Review Summary

Four reviewers (Acceptance Test, Design & Architecture, UX, Strategic) all approve Phase 1 with no blockers. Warnings and observations specific to Phase 1 below; Phase-2-specific findings are in the Phase 2 plan.

### Warnings

- **W1 (UX)** — Touch-target spacing between the new bbox toggle and the existing snapshot zoom icon. Step 4 asserts `min-h-11` but the visual gap is not codified. Verify in the manual smoke at the end of Phase 1.
- **W2 (Acceptance)** — Step 3 `EventSnapshot.test.tsx` is created "if missing" — the act of creating the file plus a failing assertion is the RED, not the file creation alone. Confirm the new assertions fail before GREEN.

### Observations

- Phase split delivers genuine user value standalone: AC6/AC7/AC11/AC12 (bbox toggle is a usable feature, not scaffolding for Phase 2).
- Phase 1 has no iOS/device dependencies — verifies in any browser.
- Spec scenarios "Bounding-box overlay toggle", "Toggle hidden when no detection box exists", "Lightbox zoom respects current overlay state", and "Snapshot proxy honors bbox param" each trace to a Phase 1 step.
- SSR safety is covered by `useState(false)` initial.
- Accessibility: `aria-pressed` on the toggle is explicit.
