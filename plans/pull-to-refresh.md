# Plan: Pull-to-Refresh

**Created**: 2026-04-18
**Branch**: feat/pull-to-refresh
**Status**: pending
**Spec**: [docs/specs/pull-to-refresh.md](../docs/specs/pull-to-refresh.md)

## Goal

Add a pull-to-refresh gesture to the Camera Events and Cameras pages that works cross-platform (iOS Safari, Android Chrome, desktop). When triggered, the refresh bypasses the server-side Frigate cache so the user always gets fresh data.

## Acceptance Criteria

- [ ] AC-1: Pull-to-refresh on Camera Events page triggers data refresh with fresh data
- [ ] AC-2: Pull-to-refresh on Cameras page triggers data refresh with fresh camera snapshots
- [ ] AC-3: Server cache is cleared before re-fetch — data comes directly from Frigate
- [ ] AC-4: Works in iOS Safari standalone PWA (native pull-to-refresh suppressed)
- [ ] AC-5: Works in iOS Safari in-browser (native pull-to-refresh suppressed)
- [ ] AC-6: Works in Android Chrome (native pull-to-refresh suppressed)
- [ ] AC-7: Releasing before threshold cancels refresh — no data fetch
- [ ] AC-8: Pulling down when scrolled partway down scrolls normally — no refresh
- [ ] AC-9: Visual indicator shows pull progress, arrow rotation, and loading spinner
- [ ] AC-10: Cannot trigger a second refresh while one is in progress
- [ ] AC-11: Animations suppressed when `prefers-reduced-motion` is active
- [ ] AC-12: No gesture handling or indicator on mouse-only desktop devices
- [ ] AC-13: `pnpm build` succeeds; no hydration mismatch warnings
- [ ] AC-14: Horizontal scrolling of filter pills not affected

## Steps

### Step 1: Add `overscroll-behavior-y: contain` to body

**Complexity**: trivial
**Task**: Add `overscroll-behavior-y: contain` to the `body` rule in `src/styles.css`. This suppresses native pull-to-refresh on Chrome/Android/desktop. It's a no-op on iOS Safari (iOS suppression is handled by `touchmove` `preventDefault()` in Step 2).
**Files**: `src/styles.css`
**Commit**: `feat: add overscroll-behavior-y contain to suppress native pull-to-refresh`

### Step 2: Create `usePullToRefresh` hook

**Complexity**: complex
**Task**:

1. Create `src/features/shared/hooks/usePullToRefresh.ts`
2. Implement the hook with the following interface:
   ```typescript
   interface UsePullToRefreshOptions {
     onRefresh: () => Promise<void>
     threshold?: number // default 80px
     maxPull?: number // default 120px
   }
   interface UsePullToRefreshResult {
     pullDistance: number
     isRefreshing: boolean
   }
   ```
3. Register `touchstart`, `touchmove`, `touchend` listeners on `window` in a `useEffect`
4. Use `{ passive: false }` for `touchmove` to allow `preventDefault()` (suppresses iOS native refresh)
5. Only activate the gesture when `document.documentElement.scrollTop === 0` (or `document.body.scrollTop` for Safari compatibility)
6. Apply dampening to pull distance: `Math.min(deltaY * 0.5, maxPull)`
7. Ignore multi-finger touches (only respond to single-finger pulls)
8. Ignore horizontal-dominant gestures (compare `deltaX` vs `deltaY` at gesture start to avoid interfering with horizontal filter pill scrolling)
9. Guard all browser API access behind `useEffect` — initial state is SSR-safe (`pullDistance: 0`, `isRefreshing: false`)
10. Skip all touch event registration if `'ontouchstart' in window` is false (desktop no-op)
11. Prevent double-refresh: ignore new gestures while `isRefreshing` is true

**Files**: `src/features/shared/hooks/usePullToRefresh.ts`
**Commit**: `feat: add usePullToRefresh hook with cross-platform gesture handling`

### Step 3: Create `PullToRefreshIndicator` component

**Complexity**: standard
**Task**:

1. Create `src/features/shared/components/PullToRefreshIndicator.tsx`
2. Props: `pullDistance: number`, `isRefreshing: boolean`, `threshold: number`
3. Render a small circular indicator at the top center of the page that translates down by `pullDistance`
4. Show a downward arrow that rotates 180° when `pullDistance >= threshold` (indicating "release to refresh")
5. When `isRefreshing`, replace arrow with a spinning loader animation
6. Use design system CSS variables (`--lagoon`, `--sea-ink-soft`, `--surface-strong`)
7. Hidden when `pullDistance === 0 && !isRefreshing` (no DOM impact when idle)
8. Respect `prefers-reduced-motion`: skip rotation/translation animations, use instant transitions
9. Use an `aria-live="polite"` region with `role="status"` for screen reader announcements ("Refreshing...", "Refreshed")

**Files**: `src/features/shared/components/PullToRefreshIndicator.tsx`
**Commit**: `feat: add PullToRefreshIndicator component`

### Step 4: Create cache-clear server function

**Complexity**: trivial
**Task**:

1. In `src/features/shared/server/frigate/client.ts`, add a new `createServerFn` that calls `clearFrigateCache()`:
   ```typescript
   export const clearCacheFn = createServerFn({ method: 'POST' }).handler(
     async () => {
       clearFrigateCache()
     },
   )
   ```
2. This allows the client to trigger a server-side cache clear before `router.invalidate()` re-runs the route loader.

**Files**: `src/features/shared/server/frigate/client.ts`
**Commit**: `feat: add clearCacheFn server function for pull-to-refresh cache bypass`

### Step 5: Integrate pull-to-refresh in Camera Events route

**Complexity**: standard
**Task**:

1. In `src/routes/_authenticated/camera-events.index.tsx`, import `usePullToRefresh`, `PullToRefreshIndicator`, `clearCacheFn`, and `useRouter`
2. In the `CameraEventsRoute` component:
   - Call `useRouter()` to get the router instance
   - Call `usePullToRefresh({ onRefresh })` where `onRefresh` is an async function that calls `clearCacheFn()` then `router.invalidate()`
   - Render `<PullToRefreshIndicator>` at the top of the `<CameraEventsListPage>` wrapper, passing `pullDistance` and `isRefreshing`
3. The `CameraEventsListPage` component may need a minor refactor to accept the indicator as a prop or child, or the indicator can be rendered in the route component wrapping the page

**Files**: `src/routes/_authenticated/camera-events.index.tsx`
**Commit**: `feat: integrate pull-to-refresh on Camera Events page`

### Step 6: Integrate pull-to-refresh in Cameras route

**Complexity**: standard
**Task**:

1. In `src/routes/_authenticated/cameras.tsx`, apply the same pattern as Step 5
2. Import `usePullToRefresh`, `PullToRefreshIndicator`, `clearCacheFn`, and `useRouter`
3. Wire up `onRefresh` to clear cache and invalidate router
4. Render `<PullToRefreshIndicator>` at the top of the page

**Files**: `src/routes/_authenticated/cameras.tsx`
**Commit**: `feat: integrate pull-to-refresh on Cameras page`

### Step 7: Write tests

**Complexity**: standard
**Task**:

1. Unit test `usePullToRefresh` hook:
   - Verify initial state is SSR-safe
   - Verify gesture activation only when scrollTop === 0
   - Verify threshold behavior (below threshold = cancel, above = trigger)
   - Verify double-refresh prevention
   - Verify horizontal gesture filtering
2. Unit test `PullToRefreshIndicator`:
   - Verify hidden when idle
   - Verify arrow rotation at threshold
   - Verify spinner during refresh
   - Verify aria announcements
3. Integration test: verify `clearCacheFn` + `router.invalidate()` flow

**Files**: `src/features/shared/hooks/usePullToRefresh.test.ts`, `src/features/shared/components/PullToRefreshIndicator.test.tsx`
**Commit**: `test: add tests for pull-to-refresh hook and indicator`

### Step 8: Verify and test

**Complexity**: trivial
**Task**:

1. Run `pnpm build` to verify no build errors
2. Run `pnpm test` to verify all tests pass
3. Start dev server and verify in browser:
   - Pull-to-refresh works on events page
   - Pull-to-refresh works on cameras page
   - Data is visibly fresh after refresh (check timestamps or new events)
   - Normal scrolling is not affected
   - Filter pill horizontal scrolling is not affected
   - No hydration mismatch warnings in console
4. Manual device testing (if available):
   - iOS Safari standalone: custom refresh works, native suppressed
   - iOS Safari browser: custom refresh works, native suppressed
   - Android Chrome: custom refresh works, native suppressed
     **Files**: none (verification only)
     **Commit**: none

## Complexity Classification

| Rating     | Criteria                                                                   |
| ---------- | -------------------------------------------------------------------------- |
| `trivial`  | Single-file change, config addition                                        |
| `standard` | Behavioral change within existing patterns, multiple files, testable logic |
| `complex`  | New abstraction, cross-cutting concern, platform-specific workarounds      |

## Pre-PR Quality Gate

- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck` or included in build)
- [ ] `pnpm build` succeeds
- [ ] No hydration mismatch warnings in browser console
- [ ] Manual: pull-to-refresh works on events page (dev server)
- [ ] Manual: pull-to-refresh works on cameras page (dev server)
- [ ] Manual: normal scrolling and horizontal scrolling unaffected
- [ ] Manual: indicator shows progress, arrow rotation, and spinner
- [ ] Manual: releasing before threshold cancels refresh
- [ ] Manual: no indicator on desktop (mouse-only)

## Risks & Open Questions

- **`touchmove` preventDefault and scroll chaining**: Calling `preventDefault()` on touchmove events that are not passive could theoretically cause scroll jank if the gesture detection logic is too aggressive. The horizontal-gesture filter (Step 2, item 8) mitigates this — we only preventDefault when the dominant direction is vertical and the user started at scrollTop 0. Need to verify this doesn't create edge cases where the user is at the very top but trying to scroll a nested horizontal container.
- **`router.invalidate()` behavior**: TanStack Router's `invalidate()` re-runs loaders and updates component data. Need to verify it triggers the pending component or if the update is seamless. If it shows the pending component, we may want to suppress it during pull-to-refresh (the indicator itself provides loading feedback).
- **Safari scrollTop quirk**: Safari sometimes reports `scrollTop` on `document.body` instead of `document.documentElement`. The hook should check both: `document.documentElement.scrollTop || document.body.scrollTop`.
- **`clearCacheFn` as a POST server function**: Using POST for the cache-clear function is semantically correct (it mutates server state). Need to verify TanStack Start handles POST server functions correctly when called from the client — specifically that it doesn't require a form context.
- **Multi-page cache clear scope**: `clearFrigateCache()` clears the entire cache, not just entries for the current page. This is intentional — if the user refreshes events, camera data should also be fresh if they navigate there next. But it means a refresh on one page invalidates cache entries that other pages might have been relying on. At our scale (single user, small cache) this is fine.

## Plan Review Summary

- **Scope**: 6 new/modified files, 1 new hook, 1 new component, 1 new server function, integrations in 2 route files
- **Risk**: Medium — cross-platform touch event handling has edge cases; iOS Safari's non-standard overscroll behavior requires specific workarounds
- **Testing strategy**: Unit tests for hook logic and component rendering; manual cross-platform device testing for gesture behavior
- **No new dependencies**: Pure implementation using existing APIs and patterns
