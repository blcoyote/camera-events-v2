03# Plan: Cross-Platform PWA Fixes

**Created**: 2026-04-17
**Branch**: fix/cross-platform-pwa
**Status**: pending
**Spec**: [docs/specs/cross-platform-pwa-fixes.md](../docs/specs/cross-platform-pwa-fixes.md)

## Goal

Fix 6 cross-platform compatibility issues discovered during a full PWA audit. These issues affect iOS Safari standalone mode, Android Chrome, and SSR correctness. Three additional issues were already fixed in commit `a2bcf6d` (credentials: 'include', SW navigate fallback, notification tag/renotify).

## Acceptance Criteria

- [ ] AC-1: `apple-mobile-web-app-capable` meta tag present; app launches standalone on iOS
- [ ] AC-2: `viewport-fit=cover` in viewport; safe-area padding on header, bottom content, and fixed elements
- [ ] AC-3: Clip/snapshot downloads work on iOS standalone without navigating away
- [ ] AC-4: Sign-out works on iOS standalone (cookie sent correctly)
- [ ] AC-5: Event limit setting respected on initial page load (not just client nav)
- [ ] AC-6: Theme-color meta tag updates dynamically with dark/light mode
- [ ] AC-7: No SSR regressions — build succeeds, no hydration mismatches

## Steps

### Step 1: Add `apple-mobile-web-app-capable` meta tag

**Complexity**: trivial
**Task**: Add `{ name: 'apple-mobile-web-app-capable', content: 'yes' }` to the meta array in `__root.tsx` `head()`. Place it next to the existing `mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` tags.
**Files**: `src/routes/__root.tsx`
**Commit**: `fix: add apple-mobile-web-app-capable meta tag for iOS standalone PWA`

### Step 2: Add `viewport-fit=cover` and safe-area padding

**Complexity**: standard
**Task**:

1. Update the viewport meta tag in `__root.tsx` to `width=device-width, initial-scale=1, viewport-fit=cover`
2. Add `env(safe-area-inset-top)` padding to the sticky header in `src/styles.css` or directly on the header element
3. Add `env(safe-area-inset-bottom)` padding to the page body/content wrapper
4. Update the SW update toast in `ServiceWorkerRegistration.tsx` to respect `safe-area-inset-bottom`
   **Files**: `src/routes/__root.tsx`, `src/styles.css`, `src/features/shell/components/Header.tsx`, `src/features/shell/components/ServiceWorkerRegistration.tsx`
   **Commit**: `fix: add viewport-fit=cover and safe-area padding for notch devices`

### Step 3: Fix downloads for iOS standalone PWA

**Complexity**: standard
**Task**:

1. Create a `useDownload` hook or helper function that uses `fetch()` + `Blob` + `URL.createObjectURL()` + programmatic `<a>` click to trigger downloads
2. Replace the `<a href download>` pattern in `CameraEventDetailPage.tsx` with an `onClick` handler that calls this download function
3. Ensure the download works for both clips (video) and snapshots (images)
4. On platforms where `<a download>` works natively, this approach is equally valid — no feature detection needed
   **Files**: `src/features/camera-events/components/CameraEventDetailPage.tsx`
   **Commit**: `fix: use fetch+blob download for iOS standalone PWA compatibility`

### Step 4: Fix sign-out for iOS standalone PWA

**Complexity**: standard
**Task**:

1. Replace the native `<form method="post" action="/api/auth/logout">` with a `fetch()` call using `credentials: 'include'`
2. On success, redirect to `/` via `window.location.assign('/')`
3. Prevent the default form submission
4. Keep the button accessible (same `role`, keyboard behavior)
   **Files**: `src/features/shell/components/Header.tsx`
   **Commit**: `fix: use fetch for sign-out to ensure cookies sent in iOS standalone PWA`

### Step 5: Fix event limit SSR — use cookie instead of localStorage

**Complexity**: standard
**Task**:

1. When the user changes the event limit in settings, also write the value to a cookie (e.g., `event-limit=50`, `SameSite=Lax`, `Path=/`, non-httpOnly so JS can read it, max-age 1 year)
2. In `readEventLimit()`, check cookie first (works on both server and client), fall back to localStorage, then default
3. On the server, the route loader reads the cookie from the request, so the correct limit is used on initial load
4. Keep localStorage as a secondary store for backward compatibility
   **Files**: `src/features/shared/hooks/useEventLimit.ts`, `src/routes/_authenticated/camera-events.index.tsx`
   **Commit**: `fix: persist event limit in cookie for SSR-compatible initial load`

### Step 6: Dynamic `theme-color` meta tag

**Complexity**: standard
**Task**:

1. Define theme colors: light `#173a40`, dark `#0d1f23`
2. In `applyThemeMode()` in `useTheme.ts`, update the `<meta name="theme-color">` tag's `content` attribute to match the resolved theme
3. Update the THEME_INIT_SCRIPT in `__root.tsx` to also set the correct initial theme-color based on the resolved theme (so it's correct before React hydrates)
   **Files**: `src/features/shared/hooks/useTheme.ts`, `src/routes/__root.tsx`
   **Commit**: `fix: update theme-color meta tag dynamically when theme changes`

### Step 7: Verify and test

**Complexity**: trivial
**Task**:

1. Run `pnpm build` to verify no build errors
2. Run `pnpm test` to verify no test regressions
3. Start dev server and verify in browser:
   - Meta tags are present in rendered HTML
   - Theme-color changes when cycling themes
   - Downloads work (can test on desktop; iOS needs manual device testing)
   - Sign-out works
   - Event limit persists across hard refresh
     **Files**: none (verification only)
     **Commit**: none

## Complexity Classification

| Rating     | Criteria                                                                   |
| ---------- | -------------------------------------------------------------------------- |
| `trivial`  | Single-file change, config/meta tag addition                               |
| `standard` | Behavioral change within existing patterns, multiple files, testable logic |
| `complex`  | Architectural change, cross-cutting concern, new abstraction               |

## Pre-PR Quality Gate

- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck` or included in build)
- [ ] `pnpm build` succeeds
- [ ] No hydration mismatch warnings in browser console
- [ ] Manual: meta tags present in page source (`apple-mobile-web-app-capable`, `viewport-fit=cover`)
- [ ] Manual: theme-color meta tag updates when cycling themes
- [ ] Manual: sign-out works (test with dev server)
- [ ] Manual: event limit persists across hard refresh
- [ ] Manual: download triggers file save (desktop test; iOS needs device)

## Risks & Open Questions

- **Event limit cookie approach**: Writing the event limit to a cookie means the server needs to parse it from the request headers in the route loader. TanStack Start's `createServerFn` has access to the request via `getEvent()` from vinxi — need to verify cookie access pattern. Alternative: use a URL search param `?limit=50` but that changes the URL shape.
- **Sign-out form → fetch migration**: The current `<form method="post">` approach has the advantage of working without JavaScript. Converting to `fetch()` means sign-out requires JS. Since the entire app is a React SPA that requires JS anyway, this is acceptable.
- **Safe-area padding scope**: Need to test that `env(safe-area-inset-*)` doesn't add unnecessary whitespace on devices without notches. The `env()` function returns `0px` when not applicable, so this should be safe.
- **Download blob memory**: For large video clips, the `fetch()` + `Blob` approach loads the entire file into memory before triggering the download. The existing clip proxy already streams from Frigate, but the client-side blob will buffer it. For typical camera event clips (< 30 seconds, ~5-20MB), this is fine. If clips are very large, a streaming download approach would be needed.
- **iOS standalone detection**: For issue 3 (downloads), we could feature-detect iOS standalone mode and only use the blob approach there, keeping native `<a download>` for other platforms. However, the blob approach works everywhere, so feature detection adds complexity without benefit.
