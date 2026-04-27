# Spec: Rearrange Cameras on Feed

## Intent Description

Authenticated users need to reorder the camera tiles on `/cameras` to match how they think about their property (front door first, driveway next, etc.). Today the order is whatever Frigate returns, which is arbitrary and shared across all users.

This feature lets each user set their own order directly on the `/cameras` feed. The same interaction works on desktop (pointer), mobile (touch), and keyboard. Users enter an explicit **Edit mode** to begin reordering, which resolves the inherent conflict between vertical drag gestures and the existing pull-to-refresh interaction. The saved order is stored per device in `localStorage` and applied on every subsequent visit.

Rearranging is not a destructive action — it never changes the underlying Frigate configuration. It is a pure per-device presentation preference.

## User-Facing Behavior

```gherkin
Feature: Rearrange cameras on the /cameras feed

  Background:
    Given I am signed in
    And Frigate returns cameras in the order: "front", "back", "garage"

  Scenario: Feed displays cameras in Frigate order for a first-time user
    Given I have no saved camera order on this device
    When I open /cameras
    Then the grid shows cameras in the order: "front", "back", "garage"
    And no "Edit" affordance is triggered automatically

  Scenario: Entering and exiting Edit mode
    Given I am on /cameras
    When I tap the "Edit" button
    Then tiles show a visual affordance indicating they are draggable
    And the button label changes to "Done"
    When I tap the "Done" button
    Then tiles return to their non-draggable appearance
    And the button label changes back to "Edit"

  Scenario: Desktop user reorders cameras with a pointer in Edit mode
    Given I am on /cameras with a pointer device
    And I have entered Edit mode
    When I drag "garage" above "front"
    Then the grid shows cameras in the order: "garage", "front", "back"
    And my saved order on this device becomes: "garage", "front", "back"

  Scenario: Mobile user reorders cameras with touch in Edit mode
    Given I am on /cameras with a touch device
    And I have entered Edit mode
    When I press and drag "garage" above "front"
    Then the grid shows cameras in the order: "garage", "front", "back"
    And my saved order on this device becomes: "garage", "front", "back"

  Scenario: Keyboard user reorders with arrow keys in Edit mode
    Given I am on /cameras using a keyboard
    And I have entered Edit mode
    When I focus the sortable handle on "garage"
    And I press Space to pick up
    And I press ArrowUp twice
    And I press Space to drop
    Then the grid shows cameras in the order: "garage", "front", "back"
    And my saved order on this device becomes: "garage", "front", "back"

  Scenario: Screen reader announces drag lifecycle
    Given I am using a screen reader on /cameras
    And I have entered Edit mode
    When I pick up "garage" with Space
    Then I hear an announcement that "garage" has been picked up
    When I move it above "front" and drop with Space
    Then I hear an announcement that "garage" was dropped over position 1

  Scenario: Order persists across sessions on the same device
    Given I have saved the order "garage", "front", "back" on this device
    When I close the browser or PWA and return later on the same device
    Then /cameras shows cameras in the order: "garage", "front", "back"

  Scenario: Saved order is per device
    Given I have saved the order "garage", "front", "back" on device A
    When I open /cameras on device B, where I have no saved order
    Then /cameras on device B shows cameras in Frigate's order: "front", "back", "garage"

  Scenario: New camera in Frigate is appended to the saved order
    Given my saved order on this device is "garage", "front", "back"
    And Frigate now also returns a new camera "driveway"
    When I open /cameras
    Then the grid shows cameras in the order: "garage", "front", "back", "driveway"

  Scenario: Camera removed from Frigate is dropped from saved order
    Given my saved order on this device is "garage", "front", "back"
    And Frigate no longer returns "back"
    When I open /cameras
    Then the grid shows cameras in the order: "garage", "front"
    And my saved order on this device is cleaned up to "garage", "front" on the next save

  Scenario: Reordering does not trigger pull-to-refresh
    Given I am on /cameras on a touch device
    And I have entered Edit mode
    When I drag a camera tile vertically past the top of the viewport
    Then pull-to-refresh is not triggered

  Scenario: Pull-to-refresh still works outside Edit mode
    Given I am on /cameras on a touch device
    And I am not in Edit mode
    When I pull down from the top of the viewport past the refresh threshold
    Then pull-to-refresh is triggered normally

  Scenario: Edit mode exits on route change
    Given I am on /cameras in Edit mode
    When I navigate away from /cameras
    And I return to /cameras
    Then Edit mode is off

  Scenario: localStorage unavailable or write fails
    Given localStorage is disabled or the write quota is exceeded
    When I reorder a camera in Edit mode
    Then the grid visually reflects the new order for the current session
    And an inline, dismissible error message informs me that the order could not be saved
    And the next page load falls back to Frigate's order

  Scenario: Corrupt saved order is discarded
    Given the saved order in localStorage is not valid JSON or not an array of strings
    When I open /cameras
    Then the grid shows cameras in Frigate's order
    And the corrupt entry is removed from localStorage

  Scenario: Reorder does not mutate Frigate configuration
    Given I reorder cameras on this device
    When another user opens /cameras on a different device with no saved order
    Then that user sees cameras in Frigate's original order

  Scenario: SSR and client render produce identical initial markup
    Given I load /cameras with a saved order in localStorage
    Then the server-rendered HTML shows cameras in Frigate's order
    And the client reconciles to the saved order after hydration without a hydration mismatch warning
```

## Architecture Specification

### Components and files (all under `src/features/cameras/`)

| File                                                                 | Role                                                                                                                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/CamerasPage.tsx` (existing, modified)                    | Hosts the Edit-mode toggle and swaps between static grid and `SortableCamerasGrid`. Disables pull-to-refresh while in Edit mode (via a prop passed up to the route).                          |
| `components/SortableCamerasGrid.tsx` (new)                           | Wraps `DndContext` + `SortableContext`, renders `SortableCameraTile` for each camera, and emits reorder events.                                                                               |
| `components/SortableCameraTile.tsx` (new)                            | `useSortable`-wrapped `MediaCard`; renders a visible drag handle only in Edit mode.                                                                                                           |
| `hooks/useCameraOrder.ts` (new)                                      | Pure hook: takes Frigate's list, reads saved order from the storage adapter, returns the merged visible order plus a `setOrder` callback. Handles SSR-safe deferred read.                     |
| `hooks/useEditMode.ts` (new, or inlined `useState` in `CamerasPage`) | Boolean toggle, reset on unmount.                                                                                                                                                             |
| `utils/cameraOrderStorage.ts` (new)                                  | Storage adapter: `loadOrder(): string[] \| null`, `saveOrder(order: string[]): Result<void, SaveError>`. Wraps `localStorage` with try/catch; validates shape on read; discards corrupt data. |
| `utils/mergeCameraOrder.ts` (new)                                    | Pure function: `(savedOrder, frigateCameras) → visibleOrder`. Drops removed cameras, appends new cameras in Frigate's order. Pure and unit-testable.                                          |

### Dependencies to add

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/modifiers` (for `restrictToVerticalAxis` / `restrictToParentElement`)
- `@dnd-kit/utilities`

### Sensors

- `PointerSensor` with a small activation distance (`8px`) so simple clicks inside tiles are not swallowed.
- `TouchSensor` with activation delay (`150ms`) + tolerance (`5px`) so finger scrolling still works before a drag begins.
- `KeyboardSensor` using `sortableKeyboardCoordinates` for arrow-key reordering.
- Modifier: `restrictToParentElement` so tiles cannot be dragged out of the grid region.

### Persistence contract

- Storage key: `camera-order:v1` in `localStorage`.
- Value: JSON-encoded `string[]` of camera names.
- Versioning: key suffix `:v1` lets us invalidate stale shapes in the future.
- Scope: per device and per browser. Not shared across users or devices.
- Reads: deferred to `useEffect` to keep SSR and first client render identical.
- Writes: synchronous on every drop event (end of drag). On failure (quota, security error), the in-memory order still updates and an inline error is surfaced; no retry loop.

### SSR and hydration

- Server-side render uses the Frigate order exactly as returned.
- The `useCameraOrder` hook initializes with `null` on both server and client; after `useEffect` runs on the client, it reads the saved order and triggers a re-render.
- No browser globals (`localStorage`, `window`, `navigator`) are read during render.
- The grid's DOM structure (keys = camera names) is stable across the order change, minimizing DOM churn.

### Edit-mode interaction with pull-to-refresh

- `CamerasPage` tracks `isEditing` and passes a `disabled` flag to `usePullToRefresh` in the route component (new optional prop on the existing hook), OR communicates via a shared context. Pull-to-refresh hook already lives in `src/features/shared/hooks/usePullToRefresh`; adding a `disabled` flag is the minimal change.
- The `Edit` / `Done` toggle is a button within the page header island.

### Out of scope

- Per-user server-side storage (explicitly deferred; storage adapter interface allows a future swap).
- A separate `/settings/camera-order` route.
- Drag-to-group, columns per camera, or multi-select.
- Resetting to "Frigate default" via a dedicated button — reset happens implicitly by clearing localStorage in DevTools; can be added later if requested.

### Constraints (from CLAUDE.md)

- Feature-slice boundary: everything new stays under `src/features/cameras/` or `src/features/shared/`. No cross-feature imports.
- No browser globals during render (SSR safety).
- Prefer canonical Tailwind utilities over arbitrary value syntax.
- All existing route-level `requireSession()` auth is unchanged; no new server functions are introduced.

## Acceptance Criteria

| #     | Criterion                                 | Pass Condition                                                                                                                                            |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | Desktop reorder works                     | Pointer drag in Edit mode reorders the grid; saved order updates in localStorage.                                                                         |
| AC-2  | iOS Safari reorder works                  | Touch drag in Edit mode works on iOS Safari (browser and PWA standalone).                                                                                 |
| AC-3  | Android Chrome reorder works              | Touch drag in Edit mode works on Android Chrome (browser and PWA).                                                                                        |
| AC-4  | Keyboard reorder works                    | Space-pickup, arrow-move, Space-drop reorders the grid and updates storage.                                                                               |
| AC-5  | Persistence                               | Reordering, then closing and reopening the app on the same device, shows the saved order.                                                                 |
| AC-6  | Per-device scope                          | A second device with no saved order shows Frigate's order.                                                                                                |
| AC-7  | New cameras                               | A new Frigate camera appears at the end of the visible order.                                                                                             |
| AC-8  | Removed cameras                           | A camera removed from Frigate does not appear; the saved order is cleaned up on next save.                                                                |
| AC-9  | Pull-to-refresh isolation                 | Pull-to-refresh does not fire while dragging in Edit mode; it fires normally outside Edit mode.                                                           |
| AC-10 | No hydration warnings                     | Browser console is free of hydration mismatch warnings on `/cameras` load with and without a saved order.                                                 |
| AC-11 | Storage failure                           | With `localStorage` disabled, the grid still reflects the new order in-session and shows an inline error; next load falls back to Frigate's order.        |
| AC-12 | Corrupt-data recovery                     | An invalid JSON / wrong-shape value in `localStorage` is discarded; the grid renders Frigate's order.                                                     |
| AC-13 | A11y baseline                             | `@dnd-kit` screen-reader announcements fire on pickup, move, and drop; drag handles are reachable via Tab and activated via Space.                        |
| AC-14 | No regression — cold load                 | First-time user (no saved order) sees identical behavior and rendering to the current feed.                                                               |
| AC-15 | No backend change                         | No new server functions are introduced; no Frigate configuration mutation occurs.                                                                         |
| AC-16 | Edit-mode exit                            | Navigating away from `/cameras` and returning resets `isEditing` to false.                                                                                |
| AC-17 | Unit-test coverage — `mergeCameraOrder`   | Pure function has tests covering: empty saved, saved matches Frigate, saved missing cameras, Frigate missing cameras, interleaved additions and removals. |
| AC-18 | Unit-test coverage — `cameraOrderStorage` | Adapter has tests covering: fresh read, write-then-read round trip, corrupt data discard, quota-exceeded error path.                                      |
| AC-19 | Integration test                          | End-to-end reorder test (Playwright or equivalent) verifies pointer drag persistence across a reload.                                                     |
| AC-20 | Lint and typecheck                        | No new lint errors; strict TypeScript passes.                                                                                                             |

## Consistency Gate

- [x] Intent is unambiguous — two developers would interpret it the same way.
- [x] Every behavior in the intent has at least one corresponding BDD scenario (Edit mode, per-device persistence, new/removed cameras, pull-to-refresh isolation, SSR parity, storage failure, a11y).
- [x] Architecture specification constrains implementation without over-engineering — uses `@dnd-kit` defaults, one storage adapter, pure merge function; defers server-side persistence behind the same interface.
- [x] Terminology consistent across artifacts — "Edit mode", "saved order", "visible order", "Frigate order", "per device" are used uniformly.
- [x] No contradictions — persistence is exclusively `localStorage`; reordering never mutates Frigate; Edit mode is the only draggable state.

**Gate verdict: PASS.**
