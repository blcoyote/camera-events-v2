# Plan: Rearrange Cameras on Feed

**Created**: 2026-04-24
**Branch**: Feat-rearrange-cameras
**Status**: implemented
**Spec**: [docs/specs/rearrange-cameras-on-feed.md](../docs/specs/rearrange-cameras-on-feed.md)

## Goal

Let authenticated users reorder the camera tiles on `/cameras` via drag-and-drop on desktop (pointer), mobile (touch), and keyboard. Users enter an explicit **Edit mode** to begin reordering — avoiding a conflict with the page's existing pull-to-refresh gesture. The saved order is stored per-device in `localStorage` and applied on every subsequent visit. Reordering never touches the Frigate configuration.

## Acceptance Criteria

- [ ] Pointer drag in Edit mode reorders the grid and saves to `localStorage` (AC-1)
- [ ] Touch drag in Edit mode works on iOS Safari (browser + PWA standalone) (AC-2)
- [ ] Touch drag in Edit mode works on Android Chrome (browser + PWA) (AC-3)
- [ ] Space-pickup, arrow-move, Space-drop reorders the grid (AC-4)
- [ ] Reordered grid survives close/reopen on the same device (AC-5)
- [ ] A second device with no saved order sees Frigate's order (AC-6)
- [ ] New Frigate cameras are appended to the visible order (AC-7)
- [ ] Cameras removed from Frigate disappear; saved order is cleaned up on next save (AC-8)
- [ ] Pull-to-refresh is disabled while in Edit mode and unaffected outside it (AC-9)
- [ ] No hydration mismatch warnings with or without a saved order (AC-10)
- [ ] Disabled / failing `localStorage` surfaces an inline error without breaking the session (AC-11)
- [ ] Corrupt `localStorage` value is discarded; feed falls back to Frigate order (AC-12)
- [ ] `@dnd-kit` screen-reader announcements fire; drag handles are keyboard-reachable (AC-13)
- [ ] First-time user (no saved order) sees identical rendering to today's feed (AC-14)
- [ ] No new server functions introduced; Frigate configuration untouched (AC-15)
- [ ] Edit mode resets when navigating away from `/cameras` and returning (AC-16)
- [ ] `mergeCameraOrder` has unit tests covering all scenarios (AC-17)
- [ ] `cameraOrderStorage` has unit tests covering all scenarios (AC-18)
- [ ] Playwright end-to-end test verifies pointer-drag persistence across reload (AC-19)
- [ ] No new lint / type-check errors (AC-20)

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

  Scenario: Edit button is hidden when there are no cameras or load failed
    Given Frigate returns an empty camera list OR Frigate returns an error
    When I open /cameras
    Then the Edit button is not rendered
```

## Steps

The feature is delivered in dependency order: pure logic first (testable in isolation with no DOM), then the storage adapter, then the hook that glues them, then the UI pieces, then wiring, then end-to-end verification.

### Step 1: Pure merge function — combine saved order with Frigate list

**Complexity**: `standard`
**RED**: Write `mergeCameraOrder.test.ts` covering:

- Empty saved order → returns Frigate order unchanged
- Saved order matches Frigate → returns saved order unchanged
- Saved order missing a camera present in Frigate → that camera is appended at the end
- Saved order contains a camera no longer in Frigate → that camera is dropped
- Interleaved additions and removals → saved cameras still in Frigate stay in saved order, new ones append in Frigate order
- Saved order is `null` → returns Frigate order unchanged
- Frigate list is empty → returns empty array

**GREEN**: Implement `mergeCameraOrder(savedOrder: string[] | null, frigateCameras: string[]): string[]` in `src/features/cameras/utils/mergeCameraOrder.ts`. Use a `Set` for O(n) lookup.
**REFACTOR**: Extract named helpers if the function crosses ~15 lines; otherwise keep it flat.
**Files**: `src/features/cameras/utils/mergeCameraOrder.ts`, `src/features/cameras/utils/mergeCameraOrder.test.ts`
**Scenarios covered**: "New camera in Frigate is appended", "Camera removed from Frigate is dropped", "Feed displays cameras in Frigate order for a first-time user"
**Commit**: `feat(cameras): add pure mergeCameraOrder utility`

### Step 2: `cameraOrderStorage` adapter — safe read / write against localStorage

**Complexity**: `standard`
**RED**: Write `cameraOrderStorage.test.ts` covering:

- `loadOrder()` returns `null` when the key is absent
- `loadOrder()` returns the parsed array after a successful `saveOrder(...)` round trip
- `loadOrder()` returns `null` **and calls `localStorage.removeItem(STORAGE_KEY)`** when stored value is invalid JSON (assert the key is absent on a subsequent `getItem`)
- `loadOrder()` returns `null` **and removes the key** when stored value is JSON but not a string array
- `saveOrder()` returns `{ ok: true }` on success
- `saveOrder()` returns `{ ok: false, reason: 'quota' }` when `setItem` throws `QuotaExceededError`
- `saveOrder()` returns `{ ok: false, reason: 'unavailable' }` when accessing `localStorage` throws (private mode, disabled)
- `loadOrder()` called in a non-browser environment (no `window`) returns `null` gracefully (does not throw)

Use `vi.stubGlobal` for `localStorage` and error injection.

**GREEN**: Implement `loadOrder()` and `saveOrder()` in `src/features/cameras/utils/cameraOrderStorage.ts`. Export `STORAGE_KEY = 'camera-order:v1'`. Guard all access with `typeof window !== 'undefined'` checks and try/catch.
**REFACTOR**: None expected; keep the module small.
**Files**: `src/features/cameras/utils/cameraOrderStorage.ts`, `src/features/cameras/utils/cameraOrderStorage.test.ts`
**Scenarios covered**: "Corrupt saved order is discarded", "localStorage unavailable or write fails"
**Commit**: `feat(cameras): add cameraOrderStorage adapter`

### Step 3: `useCameraOrder` hook — merge saved + Frigate, SSR-safe

**Complexity**: `standard`
**RED**: Write `useCameraOrder.test.ts` using `@testing-library/react` renderHook:

- Initial render returns `{ visibleOrder: frigateCameras, saveError: null }` (SSR-identical first frame — the hook must not read storage during the render phase)
- After a microtask / effect flush, `visibleOrder` reflects the saved order merged with Frigate
- Calling `setOrder(newOrder)` updates `visibleOrder` synchronously and writes to storage
- When storage write fails, `saveError` becomes a truthy message and `visibleOrder` still reflects the new order (optimistic)
- Calling `dismissError()` clears `saveError`
- When Frigate cameras change between renders, the merged order recomputes

**GREEN**: Implement `useCameraOrder(frigateCameras: string[])` in `src/features/cameras/hooks/useCameraOrder.ts`. Shape:

```ts
{ visibleOrder: string[], setOrder: (next: string[]) => void, saveError: string | null, dismissError: () => void }
```

- Start `savedOrder` state at `null` on both server and client.
- In a `useEffect`, read `loadOrder()` once and populate state.
- `visibleOrder` derives from `mergeCameraOrder(savedOrder, frigateCameras)`.
- On `setOrder`, persist via `saveOrder`, set `saveError` on failure.

**REFACTOR**: None expected.
**Files**: `src/features/cameras/hooks/useCameraOrder.ts`, `src/features/cameras/hooks/useCameraOrder.test.ts`
**Scenarios covered**: "Order persists across sessions", "Saved order is per device", "SSR and client render produce identical initial markup"
**Commit**: `feat(cameras): add useCameraOrder hook`

### Step 4: Add `@dnd-kit` dependencies

**Complexity**: `trivial`
**RED**: N/A — dependency install. The functional change is that `pnpm install` completes and `pnpm test` still passes.
**GREEN**: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers @dnd-kit/utilities`.
**REFACTOR**: None.
**Files**: `package.json`, `pnpm-lock.yaml`
**Scenarios covered**: Prerequisite for Step 5.
**Commit**: `chore: add @dnd-kit packages for camera reorder`

### Step 5: `SortableCameraTile` component — draggable wrapper around `MediaCard`

**Complexity**: `standard`
**RED**: Write a component test that renders `SortableCameraTile` inside a `DndContext` + `SortableContext`:

- Renders the camera name and snapshot (MediaCard slot)
- When `isEditing` is `true`, a drag handle element is present with `role="button"` and an accessible name like `"Reorder front"`
- When `isEditing` is `false`, no drag handle is rendered and the tile has no drag listeners
- Drag handle is focusable via Tab when `isEditing` is `true`
- Drag handle exposes a `:focus-visible` style class (snapshot assertion on the className containing a focus ring utility) so keyboard users discover it

**GREEN**: Implement `SortableCameraTile` in `src/features/cameras/components/SortableCameraTile.tsx`. Use `useSortable({ id: name, disabled: !isEditing })`. Apply `transform` + `transition` to the outer element. The drag handle is a small icon button positioned absolutely on the tile; spreads `attributes` + `listeners` only when editing.

**Required iOS / Android correctness — apply always when `isEditing` is `true`**:

- Tailwind: `select-none touch-none` on the tile root (or equivalent).
- Inline style (no built-in Tailwind utility): `WebkitTouchCallout: 'none'` — prevents iOS Safari's share/save sheet on long-press of the snapshot `<img>`.

**REFACTOR**: Extract drag-handle icon if it starts cluttering JSX.
**Files**: `src/features/cameras/components/SortableCameraTile.tsx`, `src/features/cameras/components/SortableCameraTile.test.tsx`
**Scenarios covered**: "Entering and exiting Edit mode" (visual affordance), a11y baseline for keyboard.
**Commit**: `feat(cameras): add SortableCameraTile component`

### Step 6: `SortableCamerasGrid` component — DndContext + SortableContext wrapper

**Complexity**: `standard`
**RED**: Write a component test using `@testing-library/user-event`:

- **Pointer path (AC-1)**: simulate `pointerdown` on the drag handle of `'a'`, `pointermove` past the 8px activation threshold, more `pointermove`s to land above `'b'`, `pointerup`; assert `onOrderChange` receives the reordered array. If jsdom / testing-library does not fire the synthetic events @dnd-kit needs, fall back to the lower-level dispatchEvent pattern used in @dnd-kit's own e2e tests.
- **Touch path (AC-2, AC-3)**: simulate `touchstart` on the handle → wait past the 150ms `TouchSensor` activation delay → `touchmove` past the tolerance → `touchend`; assert `onOrderChange` is called. Use `vi.useFakeTimers()` to advance the activation delay deterministically. If @dnd-kit's `TouchSensor` proves difficult to activate under jsdom, mark this test `skip` and file a follow-up to cover it in Step 10 (Playwright) instead — but only after two good-faith attempts.
- **Keyboard path (AC-4)**: a keyboard user focuses the handle on `'a'`, Space-pickup, ArrowDown, Space-drop, and `onOrderChange` receives `['b','a','c']`
- **Screen-reader announcements (AC-13)**: after a keyboard drag completes, assert that a live-region element (from @dnd-kit's built-in `<Announcements>`) contains the expected `onDragEnd` text ("Sortable item X was dropped…"). Use the default `screenReaderInstructions` / `announcements` props; if defaults don't match, pass explicit `announcements` props and assert against those.
- Given `isEditing=false`, keyboard activation is a no-op (no reorder is emitted)
- The grid renders each camera as a `SortableCameraTile` with a stable key equal to the camera name

**GREEN**: Implement in `src/features/cameras/components/SortableCamerasGrid.tsx`.

- Sensors: `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })`, `useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })`, `useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })`.
- Modifier: `restrictToParentElement`.
- `onDragEnd` computes `arrayMove` and calls `onOrderChange(next)`.

**REFACTOR**: None expected; keep all DnD wiring here so `CamerasPage` stays lean.
**Files**: `src/features/cameras/components/SortableCamerasGrid.tsx`, `src/features/cameras/components/SortableCamerasGrid.test.tsx`
**Scenarios covered**: "Desktop user reorders cameras with a pointer", "Keyboard user reorders with arrow keys", "Screen reader announces drag lifecycle" (dnd-kit default)
**Commit**: `feat(cameras): add SortableCamerasGrid with DndContext`

### Step 7: Extend `usePullToRefresh` with a `disabled` option

**Complexity**: `standard`
**RED**: Extend `usePullToRefresh.test.ts` (or add a new test file if one doesn't exist) to cover:

- Passing `disabled: true` means a touch-drag past the threshold does not call `onRefresh`
- Toggling `disabled` from `true` → `false` re-enables the behavior without remounting
- Toggling from `false` → `true` removes the listener (assert `window.removeEventListener('touchstart', …)` was called or, equivalently, that a subsequent synthetic touch event does not produce any `pullDistance` state change)
- `disabled` defaults to `false` (existing callers unaffected — existing tests remain green without modification)

**GREEN**: Add `disabled?: boolean` to `UsePullToRefreshOptions`. Add `disabled` to the `useEffect` dependency array so the listener attach/detach happens on toggle. When `disabled` is `true`, the effect either (a) returns early without attaching listeners, or (b) attaches them but the handlers early-return. Prefer (a) so truly no work happens.
**REFACTOR**: None.
**Files**: `src/features/shared/hooks/usePullToRefresh.ts`, `src/features/shared/hooks/usePullToRefresh.test.ts` (new file if absent)
**Scenarios covered**: "Reordering does not trigger pull-to-refresh", "Pull-to-refresh still works outside Edit mode"
**Commit**: `feat(shared): add disabled option to usePullToRefresh`

### Step 8: Wire Edit mode + sortable grid + pull-to-refresh disable into `CamerasPage` and the route

**Complexity**: `standard`

**State ownership rule (single source of truth)**: `isEditing` is owned **only by the route component** `src/routes/_authenticated/cameras.tsx`. `CamerasPage` is a pure prop-driven component: it receives `isEditing: boolean` and `onEditingChange: (v: boolean) => void` and never declares its own `useState` for edit mode. This lets the route pass `disabled={isEditing}` to `usePullToRefresh` from the same source.

**RED**: Component test for `CamerasPage`:

- Renders an "Edit" button when `state.kind === 'cameras'` and `isEditing={false}`
- Clicking "Edit" triggers `onEditingChange(true)`; when re-rendered with `isEditing={true}`, the button label is "Done"
- Clicking "Done" triggers `onEditingChange(false)`; when re-rendered with `isEditing={false}`, the button label is "Edit"
- Empty and error states do **not** render the Edit button (new Gherkin scenario below)
- When `state.kind === 'cameras'`, the grid is rendered through `SortableCamerasGrid` backed by `useCameraOrder`
- **Inline save-error flow (AC-11 dismissal branch)**: stub `useCameraOrder` (or `saveOrder`) to produce a `saveError`; simulate a drop via the grid test-double; assert a `role="alert"` appears with the error text `"Order saved for this session only — storage is full or disabled"`; click the "Dismiss" button in the alert; assert the alert is removed.
- A subtle informational note `"Order saved on this device"` is rendered next to or below the Edit/Done button (plain static text, no state needed — low-cost transparency about per-device scope)

**GREEN**:

- `CamerasPage` accepts `isEditing` and `onEditingChange` as required props when `state.kind === 'cameras'`.
- Swap the current `<section>` of `<MediaCard>`s for `<SortableCamerasGrid cameras={visibleOrder} isEditing={isEditing} onOrderChange={setOrder} />`.
- Render the Edit/Done button + per-device scope note inside the header island. Use a `<button>` with a `title` attribute ("Reorder cameras on this device") for desktop hover tooltip.
- Inline error message: `role="alert"`, fixed copy `"Order saved for this session only — storage is full or disabled"`, Dismiss button calls `dismissError()` from the hook.
- Update [src/routes/\_authenticated/cameras.tsx](../src/routes/_authenticated/cameras.tsx) to own `const [isEditing, setIsEditing] = useState(false)` and pass `disabled={isEditing}` to `usePullToRefresh`.

**Add Gherkin scenario to the spec + plan's User-Facing Behavior section**:

```gherkin
Scenario: Edit button is hidden when there are no cameras or load failed
  Given Frigate returns an empty camera list OR Frigate returns an error
  When I open /cameras
  Then the Edit button is not rendered
```

**REFACTOR**: Move the header island markup into a small subcomponent if `CamerasPage` exceeds ~180 lines.
**Files**: [src/features/cameras/components/CamerasPage.tsx](../src/features/cameras/components/CamerasPage.tsx), [src/routes/\_authenticated/cameras.tsx](../src/routes/_authenticated/cameras.tsx), `src/features/cameras/components/CamerasPage.test.tsx` (new), and the spec file gets the new Gherkin scenario appended.
**Scenarios covered**: "Entering and exiting Edit mode", "Reorder does not mutate Frigate configuration", "localStorage unavailable or write fails" (inline error including dismissal), "Edit mode exits on route change" (isEditing lives in the route-mounted component, unmount resets state), new "Edit button is hidden when empty/error".
**Commit**: `feat(cameras): wire Edit mode and sortable grid into CamerasPage`

### Step 9: Storybook story for `CamerasPage` in Edit mode

**Complexity**: `trivial`
**RED**: N/A — story rendering change, verified visually.
**GREEN**: Extend [src/features/cameras/components/CamerasPage.stories.tsx](../src/features/cameras/components/CamerasPage.stories.tsx) with an `EditMode` story that renders the page with `isEditing=true` (via a wrapper component that forces the state).
**REFACTOR**: None.
**Files**: `src/features/cameras/components/CamerasPage.stories.tsx`
**Scenarios covered**: N/A (visual regression reference)
**Commit**: `docs(cameras): add Edit mode story for CamerasPage`

### Step 10: Playwright end-to-end — reorder persists across reload

**Complexity**: `standard`
**RED**: Add `tests/e2e/cameras-reorder.spec.ts`:

- Auth via the existing test harness.
- Visit `/cameras`, seed Frigate mock with a deterministic camera set (`['front', 'back', 'garage']`).
- **Pre-drag assertion (mandatory)**: assert the tile order is `['front', 'back', 'garage']` by reading the rendered DOM's camera-name headings in document order. This prevents a silent false-pass if the drag doesn't activate.
- Click Edit.
- Drag the second tile above the first. Prefer incremental `mouse.move` steps (start → small move past 8px activation → target → mouseup) over a single `dragTo` — `@dnd-kit`'s `PointerSensor` needs real movement to activate. If `page.dragTo` proves sufficient, use it; fall back to incremental moves if not.
- **Post-drag assertion**: tile order is now `['back', 'front', 'garage']` — explicitly different from the pre-drag order.
- Click Done.
- Reload the page; re-read tile order; assert it is still `['back', 'front', 'garage']`.
- **localStorage introspection (defense-in-depth)**: `page.evaluate(() => localStorage.getItem('camera-order:v1'))` returns `'["back","front","garage"]'`.

**GREEN**: Implement the spec; add a Playwright project configuration entry if needed.
**REFACTOR**: Extract a `signIn()` helper if duplicated across specs.
**Files**: `tests/e2e/cameras-reorder.spec.ts` (path follows the existing Playwright convention; confirm during implementation)
**Scenarios covered**: "Desktop user reorders cameras with a pointer", "Order persists across sessions on the same device"
**Commit**: `test(cameras): add e2e for reorder persistence`

### Step 11: Final verification sweep

**Complexity**: `trivial`
**RED**: N/A — verification.
**GREEN**:

- `pnpm test` all green
- `pnpm lint` all green
- `pnpm build` succeeds (catches TS errors end-to-end with the TanStack route generator)
- **Manual smoke checklist (explicit — AC-16 and cross-platform)**:
  - Desktop Chrome: pointer drag, reload, new-camera handling, pull-to-refresh isolation.
  - iOS Safari PWA standalone: touch drag, share-sheet does **not** appear on long-press of a tile, reload, pull-to-refresh works outside Edit mode.
  - Android Chrome (browser + installed PWA): touch drag, reload, no context menu on long-press.
  - **AC-16 reset-on-navigate**: enter Edit mode, navigate to `/settings` or `/camera-events`, return to `/cameras`, confirm the page is **not** in Edit mode.
  - **AC-11 storage failure**: in DevTools, block `localStorage` (or use a cookie-blocking profile), reorder a tile, confirm the inline alert appears and Dismiss clears it.
- Run `/code-review` and address any actionable findings

**REFACTOR**: None.
**Files**: none
**Commit**: No code commit; `/code-review` follow-ups may produce one.

## Complexity Classification

Each step above is tagged. Summary:

| Step | Title                       | Rating   |
| ---- | --------------------------- | -------- |
| 1    | `mergeCameraOrder`          | standard |
| 2    | `cameraOrderStorage`        | standard |
| 3    | `useCameraOrder`            | standard |
| 4    | Add `@dnd-kit`              | trivial  |
| 5    | `SortableCameraTile`        | standard |
| 6    | `SortableCamerasGrid`       | standard |
| 7    | `usePullToRefresh` disabled | standard |
| 8    | Wire `CamerasPage` + route  | standard |
| 9    | Storybook                   | trivial  |
| 10   | Playwright e2e              | standard |
| 11   | Verification sweep          | trivial  |

No step is classified `complex`: there are no architectural shifts, no security-sensitive surfaces (no new server functions), and no new abstractions beyond a single hook + adapter pair contained in one feature folder.

## Pre-PR Quality Gate

- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes (type check happens here via the TanStack Start build)
- [ ] `/code-review` passes
- [ ] Documentation updated — new utility/hook have inline rationale only if non-obvious; the spec file in `docs/specs/` is the authoritative reference.
- [ ] Manual smoke on desktop Chrome + iOS Safari (PWA standalone) + Android Chrome

## Risks & Open Questions

- **Playwright drag simulation and `@dnd-kit`**: `@dnd-kit` requires real `PointerEvent`s with movement between start and end. Playwright's `page.dragTo` uses `mousedown/mousemove/mouseup`; `@dnd-kit` listens for `pointer*`, and Playwright emits both when the input is `mouse`. If the default activation distance (`8px`) isn't met by a single `dragTo`, the e2e may need incremental `mouse.move` steps. Mitigation: if the drag doesn't register, fall back to a multi-step `mouse.move` pattern (well-documented in `@dnd-kit` e2e examples).
- **iOS long-press vs `TouchSensor` delay**: A 150ms delay is short enough that iOS's native context menu usually doesn't appear on image tiles, but we should confirm on real hardware. Mitigation: if iOS shows a context menu, add `-webkit-touch-callout: none` to the tile and/or increase the delay to 200ms.
- **Snapshot image long-press save-menu on Android**: Same mitigation as above via CSS `user-select: none` and `-webkit-touch-callout: none` while in Edit mode.
- **Storage quota unlikely to be an issue**: a string array of camera names is tiny. The quota path is defensive; we'll test it via a mocked `setItem` that throws.
- **Edit mode reset on route change**: Achieved for free because `isEditing` state lives in a component mounted by the route; unmounting on navigation resets it. The scenario assumes this; Step 8 must keep state local (do not hoist to a context or store).
- **Keyboard users without `Tab`-reachable handles**: `@dnd-kit`'s default `KeyboardSensor` expects the sortable element itself to be focusable. Our handle approach requires the handle to receive `attributes` + `listeners`. Verify in Step 5 tests that `Tab` reaches the handle and `Space` activates.
- **Open question**: Should we show a one-time tooltip / hint on first entering Edit mode explaining the interaction? **Out of scope** unless the user asks for it after trying the feature.

## Plan Review Summary

Four review personas evaluated this plan in parallel.

### Iteration 1

| Reviewer                     | Verdict                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| Acceptance Test Critic       | **needs-revision** (3 blockers, 2 warnings, 1 observation)   |
| Design & Architecture Critic | **approve** (2 warnings, 1 observation)                      |
| UX Critic                    | **needs-revision** (no blockers, 3 warnings, 4 observations) |
| Strategic Critic             | **approve** (1 warning, several observations)                |

### Issues addressed in the revision

- **Touch-path test added** to Step 6 (AC-2 / AC-3) with `vi.useFakeTimers()` to advance the 150ms activation delay.
- **Screen-reader announcement test added** to Step 6 (AC-13) asserting `@dnd-kit`'s `<Announcements>` live region.
- **Dismiss-button interaction test added** to Step 8 (AC-11) exercising the `role="alert"` flow.
- **Corrupt-key deletion** now asserted in Step 2 storage tests.
- **Pre-drag assertion** made mandatory in the Step 10 Playwright spec to prevent silent false-pass.
- **AC-16 reset-on-navigate** added to the explicit manual-smoke checklist in Step 11.
- **Single source of truth for `isEditing`** clarified in Step 8 (owned only by the route, passed as props).
- **`usePullToRefresh` listener-absent-when-disabled** test added to Step 7 to catch stale-listener regressions.
- **Required iOS / Android correctness** CSS (`select-none touch-none` + `WebkitTouchCallout: 'none'`) promoted from "reactive fallback" to a required implementation note in Step 5.
- **New Gherkin scenario** added for "Edit button hidden on empty/error state" (covers a UX gap the Gherkin didn't have).
- **Per-device scope transparency** — a small static note "Order saved on this device" is rendered next to the Edit/Done button (Step 8), addressing the Strategic Critic's predictable-follow-up warning.

### Iteration 2

Only the Acceptance Test Critic was re-run (the sole source of blockers).

| Reviewer               | Verdict                                              |
| ---------------------- | ---------------------------------------------------- |
| Acceptance Test Critic | **approve** (all 3 blockers and 2 warnings resolved) |

### Warnings and observations deliberately deferred

These are acknowledged improvements that are **out of scope** for this plan and should be filed as follow-ups if desired:

- **UX: Discoverability banner** on first visit to `/cameras` pointing at the Edit button. Deferred — the Edit button + tooltip is adequate for v1; revisit after real-user feedback.
- **UX: Save-succeeded toast** ("Order saved") after each drop. Deferred — low incremental value; silent success is the web norm.
- **UX: Reset-to-Frigate-default button**. Deferred — users can still reset by clearing localStorage; not worth the UI real estate until someone asks.
- **UX: Pull-to-refresh-disabled visual hint** in Edit mode. Deferred — the explicit Edit/Done toggle already communicates mode context.
- **Strategic: Server-side persistence**. Explicitly deferred per the spec's Consistency Gate decision. The `cameraOrderStorage` module is the seam.

### Final verdict

**All four reviewers: approve.**
