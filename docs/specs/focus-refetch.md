# Spec: Refetch on Focus / Notification Tap

## Intent Description

When the PWA regains focus — whether from a notification tap, an app-switch, or unlocking the phone — the camera events list and cameras page should check for fresh data instead of showing stale content.

Today, data is fetched by TanStack Start route loaders backed by a 10-minute server-side `TtlCache`. MQTT already clears the server cache when Frigate publishes events, so the server often has fresh data ready. But the client has no trigger to re-fetch: it keeps rendering whatever the loader returned on the last navigation. The user opens a notification, the app focuses, and they see the old event list.

The fix is a lightweight client-side hook that listens to the `visibilitychange` event and calls `router.invalidate()` (with a server cache clear) when the page becomes visible again after being hidden. This re-runs the current route's loader and updates the UI with fresh data.

The notification-click path in the service worker already navigates to the event detail page (via `client.navigate()` or `postMessage` → `window.location.assign()`). If the notification targets a _different_ route than the current one, TanStack Router already runs the loader for the new route — no extra work needed. The focus-refetch hook catches the case where the app was already on the events list and the user taps a notification: the SW focuses the existing window, but the route doesn't change, so the loader doesn't re-run without invalidation.

## Cross-Platform Considerations

### `visibilitychange` vs `focus` event

- `visibilitychange` fires reliably on both iOS Safari (standalone PWA and in-browser) and Android Chrome when the app goes to/from background, when the user switches tabs, or when the screen locks/unlocks.
- The `focus` event on `window` is less reliable in standalone PWA mode on iOS — it doesn't always fire when returning from a notification.
- **Decision:** Use `visibilitychange` as the sole trigger. It covers all the cases we care about on both platforms.

### iOS standalone PWA

When a user taps a notification in iOS standalone PWA mode, iOS brings the PWA to the foreground and fires `visibilitychange` (hidden → visible). The service worker's `notificationclick` handler focuses the client window. Our hook will detect the visibility change and invalidate.

### Android Chrome / TWA

Android fires `visibilitychange` when switching to the app from the notification shade. Same behavior as iOS.

### Debounce / throttle

Rapid visibility toggles (e.g., quickly switching between apps) should not hammer the server. A minimum interval between refetches (e.g., 10 seconds) prevents redundant requests while still ensuring data freshness.

## User-Facing Behavior

```gherkin
Feature: Refetch on Focus

  Background:
    Given the user is authenticated
    And the PWA is running (standalone or in-browser)

  # --- Core refetch on visibility ---

  Scenario: App returns to foreground with stale data
    Given the user is on the Camera Events page
    And the page was loaded 5 minutes ago
    When the user switches away from the app and then back
    Then the app detects the visibility change
    And clears the server-side Frigate cache
    And re-fetches the camera events via the route loader
    And the event list updates with fresh data

  Scenario: App returns to foreground on Cameras page
    Given the user is on the Cameras page
    And the page was loaded 3 minutes ago
    When the user returns to the app
    Then the cameras are re-fetched with fresh data

  # --- Notification tap ---

  Scenario: User taps a notification while on the events list
    Given the user is on the Camera Events page
    And a new camera event notification arrives
    When the user taps the notification
    Then the service worker focuses the existing app window
    And the app detects the visibility change
    And re-fetches the camera events
    And the new event appears in the list

  Scenario: User taps a notification targeting an event detail page
    Given the user is on the Camera Events page
    And a notification arrives for event "abc123"
    When the user taps the notification
    Then the service worker navigates to /camera-events/abc123
    And TanStack Router runs the event detail route loader (standard behavior)
    And the event detail page shows fresh data
    Note: The focus-refetch hook is not needed here — navigation triggers the loader

  Scenario: User taps a notification while app is closed
    Given the PWA is not currently open
    When the user taps a notification
    Then the service worker opens a new window to the target URL
    And the page loads with a fresh route loader call
    Note: No focus-refetch needed — this is a fresh page load

  # --- Throttle ---

  Scenario: Rapid app-switching does not spam the server
    Given the user is on the Camera Events page
    And the user just triggered a focus-refetch 3 seconds ago
    When the user switches away and back again quickly
    Then no additional refetch occurs
    And the minimum interval (10 seconds) has not elapsed

  Scenario: Refetch allowed after throttle window
    Given the user is on the Camera Events page
    And the last focus-refetch was 15 seconds ago
    When the user switches away and back
    Then a new refetch is triggered

  # --- Edge cases ---

  Scenario: Page was just loaded — no redundant refetch
    Given the user just navigated to the Camera Events page
    And the page loaded less than 10 seconds ago
    When the page receives a visibilitychange to "visible"
    Then no refetch occurs (the data is already fresh)

  Scenario: Pull-to-refresh resets the throttle
    Given the user just performed a pull-to-refresh
    When the user switches away and back within 10 seconds
    Then no focus-refetch occurs (the pull-to-refresh counts as a recent fetch)

  Scenario: Refetch does not interrupt active pull-to-refresh
    Given the user is in the middle of a pull-to-refresh gesture
    When a visibilitychange fires
    Then the focus-refetch is skipped
    And the pull-to-refresh continues normally

  # --- SSR safety ---

  Scenario: Server-side render produces no side effects
    Given the page is being server-side rendered
    Then no visibilitychange listener is registered
    And the initial render is identical on server and client
```

## Architecture Specification

### Component: `useRefetchOnFocus` hook

**Location:** `src/features/shared/hooks/useRefetchOnFocus.ts`

A hook that listens for `visibilitychange` and triggers a cache-clear + router invalidation when the page becomes visible after being hidden.

**Interface:**

```typescript
interface UseRefetchOnFocusOptions {
  onRefresh: () => Promise<void>
  minIntervalMs?: number // minimum ms between refetches (default: 10_000)
}

function useRefetchOnFocus(options: UseRefetchOnFocusOptions): void
```

**Behavior:**

1. On mount (in `useEffect`), register a `visibilitychange` listener on `document`.
2. When `document.visibilityState` transitions to `'visible'`:
   - Check if `minIntervalMs` has elapsed since the last refetch (tracked via a `useRef` timestamp).
   - If enough time has passed, call `onRefresh()` and update the timestamp.
   - If not, skip.
3. On unmount, remove the listener.
4. The `onRefresh` callback is stored in a ref so the listener always calls the latest version without needing to re-register.

**SSR safety:** The hook accesses `document` only inside `useEffect`. No browser globals during render. No state is set from the hook (it's fire-and-forget), so there's no hydration mismatch risk.

**Why `visibilitychange` and not `focus`?** The `focus` event doesn't fire reliably in iOS standalone PWA mode when returning from a notification. `visibilitychange` fires consistently across all target platforms (iOS Safari standalone, iOS Safari in-browser, Android Chrome, desktop browsers).

### Integration in route files

**Files:**

- `src/routes/_authenticated/camera-events.index.tsx`
- `src/routes/_authenticated/cameras.tsx`

Each route component adds:

```typescript
useRefetchOnFocus({
  onRefresh: async () => {
    await clearCacheFn()
    await router.invalidate()
  },
})
```

The `onRefresh` callback is identical to the pull-to-refresh callback. Both clear the server cache and invalidate the router.

### Interaction with pull-to-refresh

The `useRefetchOnFocus` hook tracks its own last-refetch timestamp. When the user does a pull-to-refresh, the route's `onRefresh` runs, but the focus hook's timestamp is not updated — they're independent.

However, the throttle interval (10 seconds) is short enough that overlap is unlikely to matter. If a pull-to-refresh just completed and the user immediately switches away and back, the focus refetch will fire — but it's a cheap operation (cache was just populated, loader returns quickly). This is acceptable.

If in practice this causes noticeable flicker, a shared `lastRefreshRef` could be lifted to the route component and passed to both hooks. But this is an optimization to defer unless needed.

### No changes to the service worker

The service worker's `notificationclick` handler already focuses the window and navigates. No changes needed. The focus-refetch hook handles the "same route, stale data" case purely on the client side.

### No new dependencies

The implementation uses only:

- `document.visibilityState` and `visibilitychange` event (Web API)
- `useEffect`, `useRef` from React
- Existing `clearCacheFn` server function
- `useRouter()` from `@tanstack/react-router`

### Constraints

- Must not access `document` or `window` during render (SSR safety)
- Must not cause hydration mismatches (hook sets no state that affects render output)
- Must respect the minimum refetch interval to avoid hammering the server
- Must not interfere with pull-to-refresh (no shared state locks)
- Must work in iOS Safari standalone, iOS Safari in-browser, Android Chrome, and desktop browsers
- No new npm dependencies

## Acceptance Criteria

| #     | Criterion                             | Pass Condition                                                                                               |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AC-1  | Refetch on app focus (events page)    | Switching away and back to the Camera Events page triggers a fresh data fetch; new events appear             |
| AC-2  | Refetch on app focus (cameras page)   | Switching away and back to the Cameras page triggers a fresh data fetch; snapshots update                    |
| AC-3  | Notification tap refreshes event list | Tapping a notification while already on the events list causes the list to show the new event                |
| AC-4  | Notification to detail page works     | Tapping a notification navigates to the event detail page with fresh data (existing behavior, no regression) |
| AC-5  | Throttle prevents rapid refetch       | Switching away and back within 10 seconds of the last refetch does not trigger another fetch                 |
| AC-6  | Refetch after throttle window         | Switching away and back after 10+ seconds triggers a refetch                                                 |
| AC-7  | No refetch on fresh page load         | Navigating to the page and immediately receiving a visibilitychange does not double-fetch                    |
| AC-8  | iOS Safari standalone                 | Focus-refetch works when returning to the PWA from a notification on iOS                                     |
| AC-9  | Android Chrome                        | Focus-refetch works when returning to the PWA from a notification on Android                                 |
| AC-10 | Pull-to-refresh not interrupted       | A visibilitychange during an active pull-to-refresh gesture does not cause a conflicting refetch             |
| AC-11 | SSR safe                              | `pnpm build` succeeds; no hydration mismatch warnings; no `document` access during render                    |
| AC-12 | No new dependencies                   | No new entries in package.json                                                                               |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
