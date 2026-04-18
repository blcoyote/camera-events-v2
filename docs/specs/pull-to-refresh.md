# Spec: Pull-to-Refresh

## Intent Description

Add a "drag down to refresh" gesture to the Camera Events and Cameras pages so that mobile users (and PWA users) can refresh data with a familiar pull-down gesture. The gesture must work cross-platform: iOS Safari (standalone and in-browser), Android Chrome, and desktop browsers. When triggered, the refresh must bypass the server-side Frigate cache so the user always gets fresh data from Frigate.

The app currently has no pull-to-refresh capability. Data is fetched server-side via `createServerFn` route loaders and served from a 10-minute `TtlCache`. Users who want fresh data must do a full page reload, which is disruptive on mobile (especially in standalone PWA mode where there's no browser chrome or address bar to pull).

## Cross-Platform Considerations

### iOS Safari native pull-to-refresh conflict

iOS Safari (both in-browser and standalone PWA) has a native pull-to-refresh that performs a full page reload. This competes with any custom pull-to-refresh gesture.

- `overscroll-behavior-y: contain` on `<html>` or `<body>` does **not** suppress the native pull-to-refresh on iOS Safari (it works on Chrome/Android/desktop only).
- The reliable cross-platform approach: intercept `touchmove` events and call `preventDefault()` when the custom gesture is active (user is pulling down from `scrollTop === 0`). This suppresses the native iOS refresh without breaking normal scrolling.
- Set `overscroll-behavior-y: contain` on `<body>` as well — it handles Chrome/Android/desktop natively and is a no-op on iOS.

### PWA standalone mode

In iOS standalone PWA mode, native pull-to-refresh shows a loading indicator rather than a full reload. Our custom gesture handler will work identically in standalone and in-browser modes since we're handling touch events directly.

### Desktop support

On desktop, the pull-to-refresh gesture is not a common interaction pattern. The component should only activate on touch-capable devices. No visual indicator or gesture handling is needed for mouse-only devices.

## User-Facing Behavior

```gherkin
Feature: Pull-to-Refresh

  Background:
    Given the user is on a touch-capable device
    And the user is authenticated

  # --- Core gesture ---

  Scenario: User pulls down to refresh events
    Given the user is on the Camera Events page
    And the page is scrolled to the top
    When the user drags downward on the page
    Then a refresh indicator appears at the top of the content
    And the indicator shows increasing progress as the user pulls further
    When the user pulls past the activation threshold and releases
    Then the indicator shows a loading state
    And the events are re-fetched from Frigate, bypassing the server cache
    And the page content updates with fresh data
    And the refresh indicator animates away

  Scenario: User pulls down to refresh cameras
    Given the user is on the Cameras page
    And the page is scrolled to the top
    When the user drags downward past the activation threshold and releases
    Then the cameras are re-fetched from Frigate, bypassing the server cache
    And the page content updates with fresh data

  Scenario: User cancels pull before threshold
    Given the user is on the Camera Events page
    And the page is scrolled to the top
    When the user drags downward but releases before reaching the activation threshold
    Then the refresh indicator snaps back and disappears
    And no data refresh occurs

  Scenario: Pull gesture ignored when not at top
    Given the user is on the Camera Events page
    And the page is scrolled partway down
    When the user drags downward
    Then normal scroll behavior occurs
    And the refresh indicator does not appear

  # --- Cache bypass ---

  Scenario: Refresh bypasses the server-side cache
    Given the server has a cached Frigate response from 5 minutes ago
    When the user performs a pull-to-refresh
    Then the server clears the Frigate cache before fetching
    And the response contains data fetched directly from Frigate
    And the cache is repopulated with the fresh response

  # --- Cross-platform ---

  Scenario: Gesture works on iOS Safari standalone PWA
    Given the user is running the app as an iOS standalone PWA
    And the page is scrolled to the top
    When the user pulls down
    Then the custom refresh indicator appears (not the native iOS one)
    And the native iOS pull-to-refresh is suppressed

  Scenario: Gesture works on Android Chrome
    Given the user is using Android Chrome
    And the page is scrolled to the top
    When the user pulls down
    Then the custom refresh indicator appears (not the native Chrome one)
    And the native Android pull-to-refresh is suppressed

  # --- Loading and error states ---

  Scenario: Refresh shows loading state
    Given the user has triggered a pull-to-refresh
    When the data is being fetched
    Then the refresh indicator shows a spinning/loading animation
    And the user cannot trigger another refresh until the current one completes

  Scenario: Refresh handles errors gracefully
    Given the user triggers a pull-to-refresh
    And Frigate is unreachable
    When the fetch completes with an error
    Then the refresh indicator disappears
    And the page shows the existing data (or error state if no prior data)

  # --- Reduced motion ---

  Scenario: Respects prefers-reduced-motion
    Given the user has prefers-reduced-motion enabled
    When the user performs a pull-to-refresh
    Then the refresh indicator appears and disappears without animation
    And the data refresh still occurs normally

  # --- Desktop ---

  Scenario: No pull-to-refresh on mouse-only devices
    Given the user is on a desktop browser with no touch screen
    Then no pull-to-refresh gesture handling is active
    And no refresh indicator is rendered
```

## Architecture Specification

### Component: `usePullToRefresh` hook

**Location:** `src/features/shared/hooks/usePullToRefresh.ts`

A reusable hook that encapsulates the entire pull-to-refresh gesture logic. Placed in `shared` because it's used by both the `camera-events` and `cameras` features (via their route files).

**Interface:**

```typescript
interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number // px to pull before activation (default: 80)
  maxPull?: number // max px the indicator can travel (default: 120)
}

interface UsePullToRefreshResult {
  pullDistance: number // current pull distance in px (0 when idle)
  isRefreshing: boolean // true while onRefresh() is in-flight
  containerRef: React.RefObject<HTMLElement> // attach to scrollable container
}
```

**Gesture logic:**

1. On `touchstart`: record `startY`. Only activate if the page `scrollTop` is 0 (or the container's `scrollTop` if a ref is used).
2. On `touchmove`: if gesture is active, compute `deltaY = currentY - startY`. If `deltaY > 0` (pulling down), call `preventDefault()` on the touch event to suppress native pull-to-refresh. Update `pullDistance` with a dampened value (e.g., `deltaY * 0.5` to give a rubber-band feel).
3. On `touchend`: if `pullDistance >= threshold`, trigger `onRefresh()` and set `isRefreshing = true`. Otherwise, reset `pullDistance` to 0.
4. When `onRefresh()` resolves, set `isRefreshing = false` and animate `pullDistance` back to 0.

**Touch event registration:** Use `{ passive: false }` for `touchmove` so `preventDefault()` can be called. Register listeners on the `window` (not a specific element) so the gesture works regardless of what the user touches.

**SSR safety:** The hook must not access `window`, `document`, or `navigator` during render. All event listeners are registered in `useEffect` and cleaned up on unmount. Initial state values are SSR-safe (all `0`/`false`).

### Component: `PullToRefreshIndicator`

**Location:** `src/features/shared/components/PullToRefreshIndicator.tsx`

A visual indicator that appears at the top of the page content when the user is pulling down.

**Behavior:**

- Positioned at the top of `<main>`, above the hero section
- Translates downward by `pullDistance` pixels
- Shows an arrow icon that rotates to point upward when `pullDistance >= threshold`
- Transitions to a spinning loader when `isRefreshing` is true
- Uses CSS variables from the design system (`--lagoon`, `--sea-ink-soft`)
- Respects `prefers-reduced-motion`
- Hidden when `pullDistance === 0 && !isRefreshing`

### Cache bypass: `clearFrigateCache` server function

**Location:** `src/features/shared/server/frigate/client.ts` (new export)

Add a new `createServerFn` that calls `clearFrigateCache()` and can be invoked from the client. The pull-to-refresh `onRefresh` callback will:

1. Call the cache-clear server function
2. Call `router.invalidate()` to re-run the current route's loader (which re-fetches from Frigate, now hitting the real API since cache was just cleared)

```typescript
// New server function in the route file or a shared location
const clearCache = createServerFn({ method: 'POST' }).handler(async () => {
  clearFrigateCache()
})
```

**Why a server function, not a query param?** The cache is server-side in-memory. The client can't bypass it directly — it must tell the server to clear it. A dedicated server function is cleaner than adding a `?bustCache=true` query param to loader functions, because it separates the "clear cache" intent from the "load data" intent and avoids URL pollution.

### Integration in route files

**Files:**

- `src/routes/_authenticated/camera-events.index.tsx`
- `src/routes/_authenticated/cameras.tsx`

Each route component will:

1. Call `usePullToRefresh({ onRefresh })` where `onRefresh` calls `clearCache()` then `router.invalidate()`
2. Render `<PullToRefreshIndicator>` at the top of `<main>`, passing `pullDistance` and `isRefreshing`

The `router.invalidate()` call re-runs the route loader, which fetches fresh data from Frigate (cache was just cleared). TanStack Router handles updating `useLoaderData()` reactively, so the page re-renders with fresh data.

### CSS changes

**File:** `src/styles.css`

Add `overscroll-behavior-y: contain` to `body` to suppress native pull-to-refresh on Chrome/Android. This is a no-op on iOS Safari.

### Dependencies

No new npm packages. The implementation uses:

- Native `touchstart`/`touchmove`/`touchend` events
- `@tanstack/react-router`'s `useRouter()` for `router.invalidate()`
- `@tanstack/react-start`'s `createServerFn` for cache clearing
- Existing `clearFrigateCache()` from `src/features/shared/server/frigate/cache.ts`

### Constraints

- All components must produce identical HTML on server and client during initial render (SSR/hydration safety)
- Browser-only globals (`window`, `navigator`, `document`, `TouchEvent`) must only be accessed in `useEffect` or event handlers
- Touch event listeners must use `{ passive: false }` to allow `preventDefault()`
- The gesture must not interfere with horizontal scrolling (filter bar scroll) or other touch interactions
- `overscroll-behavior-y: contain` must not break any existing scroll behavior
- The feature must not add any new npm dependencies

## Acceptance Criteria

| #     | Criterion                         | Pass Condition                                                                                                       |
| ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| AC-1  | Pull-to-refresh on events page    | Pulling down from top of Camera Events page triggers data refresh; fresh data appears                                |
| AC-2  | Pull-to-refresh on cameras page   | Pulling down from top of Cameras page triggers data refresh; fresh camera snapshots appear                           |
| AC-3  | Cache bypass                      | After pull-to-refresh, server fetches directly from Frigate (cache cleared); verified by checking response freshness |
| AC-4  | iOS Safari standalone             | Custom gesture works in iOS standalone PWA; native pull-to-refresh is suppressed                                     |
| AC-5  | iOS Safari in-browser             | Custom gesture works in iOS Safari browser; native pull-to-refresh is suppressed                                     |
| AC-6  | Android Chrome                    | Custom gesture works; native Chrome pull-to-refresh is suppressed via `overscroll-behavior-y: contain`               |
| AC-7  | Cancel before threshold           | Releasing before threshold resets the indicator; no data fetch occurs                                                |
| AC-8  | Not at scroll top                 | Pulling down when scrolled partway down scrolls normally; no refresh triggered                                       |
| AC-9  | Visual indicator                  | Indicator shows pull progress, rotates arrow at threshold, shows spinner during fetch                                |
| AC-10 | No double-refresh                 | Cannot trigger a second refresh while one is in progress                                                             |
| AC-11 | Reduced motion                    | Animations suppressed when `prefers-reduced-motion` is active; refresh still works                                   |
| AC-12 | Desktop no-op                     | No gesture handling or indicator on mouse-only desktop devices                                                       |
| AC-13 | SSR safe                          | `pnpm build` succeeds; no hydration mismatch warnings; server and client render identical initial HTML               |
| AC-14 | No horizontal scroll interference | Horizontal scrolling of filter pills on events page is not affected                                                  |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
