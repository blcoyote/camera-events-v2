# Spec: Cross-Platform PWA Fixes

## Intent Description

Address cross-platform compatibility issues discovered during a full audit of the PWA. The app must work correctly on all major platforms: iOS Safari (standalone PWA), Android Chrome, and desktop browsers (Chrome, Firefox, Safari, Edge). This spec covers 8 remaining issues — 3 already fixed in commit `a2bcf6d` (credentials: 'include', SW navigate fallback, notification tag/renotify) and 2 low-risk items deferred as informational. The fixes range from missing meta tags and safe-area handling to SSR-incompatible localStorage reads and broken downloads on iOS standalone mode.

## Issues Summary

### Already Fixed (commit a2bcf6d)

| #   | Issue                                                                                                | Fix                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| F1  | iOS PWA push notification 401 — `sameSite: 'lax'` cookies not sent with `fetch()` in standalone mode | Added `credentials: 'include'` to all push API fetch calls                                       |
| F2  | `client.navigate()` is Chromium-only — iOS/Firefox SW can't navigate on notification click           | Added `postMessage({ type: 'NAVIGATE' })` fallback + listener in `ServiceWorkerRegistration.tsx` |
| F3  | Missing notification `tag` — Android stacks every notification separately                            | Added `tag: 'camera-event'` and `renotify: true` to notification options                         |

### To Fix

| #   | Issue                                                                      | Severity | Platform                   |
| --- | -------------------------------------------------------------------------- | -------- | -------------------------- |
| 1   | Missing `apple-mobile-web-app-capable` meta tag                            | Critical | iOS Safari standalone      |
| 2   | Missing `viewport-fit=cover` and safe-area padding                         | UX       | iOS (notch/Dynamic Island) |
| 3   | `<a download>` ignored in iOS standalone PWA mode                          | UX       | iOS Safari standalone      |
| 4   | Sign-out form may not send cookies in iOS standalone mode                  | Medium   | iOS Safari standalone      |
| 5   | `readEventLimit()` called during SSR route loader — always returns default | Bug      | All platforms              |
| 6   | No dynamic `theme-color` meta tag for dark mode                            | UX       | iOS Safari, Android Chrome |

### Deferred (Low Risk / Informational)

| #   | Issue                                                     | Reason                                                                                       |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D1  | `localStorage` eviction on iOS after 7 days of inactivity | Code handles gracefully (falls back to defaults); no fix needed, just awareness              |
| D2  | `color-mix(in oklab)` requires Chrome 111+ / Safari 16.2+ | Broad support on modern browsers; older devices get fallback rendering; not worth a polyfill |
| D3  | `backdrop-filter` rendering artifacts on iOS < 16         | Only affects very old iOS versions; current versions work fine                               |

## User-Facing Behavior

```gherkin
Feature: Cross-Platform PWA Compatibility

  # --- Issue 1: apple-mobile-web-app-capable ---

  Scenario: iOS Safari recognizes app as standalone PWA
    Given the user has added the app to their iOS home screen
    When the user launches the app from the home screen
    Then the app opens in standalone mode (no Safari browser chrome)
    And the status bar style matches the configured appearance

  # --- Issue 2: viewport-fit and safe areas ---

  Scenario: Content respects iPhone notch and Dynamic Island
    Given the user is using an iPhone with a notch or Dynamic Island
    And the app is running in standalone PWA mode
    When the app renders
    Then the app extends behind the status bar and home indicator
    And the header content is inset to avoid the notch/Dynamic Island
    And bottom content is inset to avoid the home indicator
    And no content is clipped or hidden behind hardware elements

  # --- Issue 3: Download on iOS standalone ---

  Scenario: User downloads a clip on iOS standalone PWA
    Given the user is viewing a camera event detail page
    And the event has a clip available
    When the user taps the clip download card
    Then the clip file downloads to the device
    And the user is NOT navigated away from the app

  Scenario: User downloads a snapshot on iOS standalone PWA
    Given the user is viewing a camera event detail page
    And the event has a snapshot available
    When the user taps the snapshot download card
    Then the snapshot image downloads to the device
    And the user is NOT navigated away from the app

  Scenario: Download works on desktop and Android
    Given the user is viewing a camera event detail page on desktop or Android
    When the user clicks a clip or snapshot download link
    Then the file downloads normally via the browser's native download behavior

  # --- Issue 4: Sign-out cookie in iOS standalone ---

  Scenario: User signs out from iOS standalone PWA
    Given the user is authenticated
    And the app is running in iOS standalone PWA mode
    When the user opens the account menu and taps "Sign out"
    Then the session cookie is sent with the logout request
    And the user is signed out successfully
    And the user is redirected to the home page

  # --- Issue 5: Event limit SSR ---

  Scenario: Event limit setting is respected on initial page load
    Given the user has set event limit to 50 in settings
    When the user navigates to the camera events page (including hard refresh)
    Then 50 events are loaded
    And the event limit is not ignored due to SSR

  Scenario: Event limit defaults to 20 for new users
    Given the user has never changed the event limit setting
    When the user navigates to the camera events page
    Then 20 events are loaded (the default)

  # --- Issue 6: Dynamic theme-color ---

  Scenario: Browser chrome matches dark mode
    Given the user has selected dark mode in settings
    When the app renders
    Then the browser status bar / title bar uses a dark color
    And the theme-color meta tag reflects the dark mode palette

  Scenario: Browser chrome matches light mode
    Given the user has selected light mode (or auto with light preference)
    When the app renders
    Then the browser status bar / title bar uses the light color (#173a40)

  Scenario: Theme-color updates when user cycles theme
    Given the user cycles the theme from light to dark
    Then the theme-color meta tag updates immediately
    And the browser chrome color changes to match
```

## Architecture Specification

### Issue 1: `apple-mobile-web-app-capable` Meta Tag

**File:** `src/routes/__root.tsx`

Add the missing `apple-mobile-web-app-capable` meta tag to the `head()` meta array. This tells iOS Safari to launch the app in standalone mode when added to the home screen. The existing `mobile-web-app-capable` only covers Android Chrome.

### Issue 2: `viewport-fit=cover` and Safe-Area Padding

**Files:** `src/routes/__root.tsx`, `src/styles.css`

1. Update the viewport meta tag to include `viewport-fit=cover`
2. Add `env(safe-area-inset-*)` padding to:
   - The sticky header (`top` padding for notch)
   - The page content wrapper (`bottom` padding for home indicator)
   - Any fixed-position elements (e.g., the SW update toast)

### Issue 3: iOS Standalone Download Fix

**File:** `src/features/camera-events/components/CameraEventDetailPage.tsx`

Replace `<a href download>` with a JavaScript-driven download using `fetch()` + `Blob` + `URL.createObjectURL()` + programmatic click on a temporary `<a>`. This works across all platforms including iOS standalone. The `<a download>` attribute is silently ignored in iOS standalone PWA mode, causing navigation away from the app.

The server endpoints already return correct `Content-Disposition: attachment` headers, so the fetch+blob approach will respect the filename.

### Issue 4: Sign-Out Form Cookie Fix

**File:** `src/features/shell/components/Header.tsx`

Convert the native `<form method="post">` sign-out to a `fetch()` call with `credentials: 'include'`, then `window.location.assign('/')` on success. This ensures cookies are sent in iOS standalone mode, matching the pattern used for push API calls.

### Issue 5: Event Limit SSR Fix

**Files:** `src/routes/_authenticated/camera-events.index.tsx`, `src/features/shared/hooks/useEventLimit.ts`

The route loader calls `readEventLimit()` which reads `localStorage`. In TanStack Start, the `loader` function runs on the server via `createServerFn`, where `localStorage` is undefined, so it always falls back to 20.

**Fix approach:** Accept the server always using the default limit (20). On the client, after hydration, if the user's stored limit differs, re-fetch with the correct limit. This avoids hydration mismatches while respecting the user's preference.

Alternatively, move the event limit to a server-side cookie or URL search param so the server can read it. The cookie approach is simpler and doesn't require URL changes.

### Issue 6: Dynamic `theme-color` Meta Tag

**Files:** `src/features/shared/hooks/useTheme.ts`, `src/routes/__root.tsx`

Update `applyThemeMode()` in `useTheme.ts` to also update the `theme-color` meta tag. Define light/dark theme colors and set the appropriate one when the theme changes. The initial script in `__root.tsx` should also set the initial theme-color based on the resolved theme.

**Colors:**

- Light mode: `#173a40` (current hardcoded value — matches the teal header)
- Dark mode: `#0d1f23` (dark variant of the header background)

### Dependencies

No new npm packages required. All fixes use existing browser APIs and patterns already established in the codebase.

### Constraints

- All changes must produce identical HTML on server and client during initial render (SSR/hydration safety)
- Browser-only globals (`window`, `navigator`, `document`) must only be accessed in `useEffect` or event handlers
- The download fix must work on iOS Safari standalone, Android Chrome, and desktop browsers
- Safe-area padding must gracefully degrade on devices without notches (the `env()` values fall back to `0px`)

## Acceptance Criteria

| #    | Criterion                        | Pass Condition                                                                                                                                       |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | iOS standalone meta tag          | `apple-mobile-web-app-capable` meta tag present; app launches in standalone mode from iOS home screen                                                |
| AC-2 | Safe-area handling               | `viewport-fit=cover` in viewport meta; sticky header padded for notch; bottom content padded for home indicator; no content clipped on notch devices |
| AC-3 | Download works on iOS standalone | Clip and snapshot downloads trigger file save without navigating away from the app; works on desktop and Android too                                 |
| AC-4 | Sign-out on iOS standalone       | Sign-out successfully clears session in iOS standalone mode; user is redirected to home                                                              |
| AC-5 | Event limit on initial load      | After setting event limit to non-default value, a hard refresh loads the correct number of events                                                    |
| AC-6 | Dynamic theme-color              | Switching to dark mode updates the browser chrome color; switching back updates it again; initial load matches the resolved theme                    |
| AC-7 | No SSR regressions               | `pnpm build` succeeds; no hydration mismatch warnings in console; server and client render identical initial HTML                                    |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
