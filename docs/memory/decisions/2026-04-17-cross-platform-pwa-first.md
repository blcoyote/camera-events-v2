---
tags: [decision, pwa, cross-platform]
created: 2026-04-17
---

# Cross-platform (iOS/Android/desktop) support is a hard constraint, not a nice-to-have

> No PWA feature ships unless it works on iOS Safari standalone, Android
> Chrome, and desktop — all three, not "mostly Chrome."

## Context

An audit of the PWA found a cluster of bugs that all trace back to the same
root cause: code written against Chrome/Android assumptions silently breaks
on iOS Safari standalone. iOS standalone mode diverges from Android Chrome in
ways that don't show up in normal desktop testing:

- `fetch()` in iOS standalone doesn't reliably send `sameSite: 'lax'` cookies
  — session-cookie-dependent calls (push subscribe/unsubscribe, sign-out) got
  401s.
- `<a href download>` is silently ignored in iOS standalone — tapping a
  download link navigates away from the app instead of saving a file.
- `ServiceWorkerRegistration.navigate()` is Chromium-only; `clients.openWindow(url)`
  on iOS ignores the URL argument entirely and launches the PWA at its
  `start_url` instead of the notification's target.
- Android stacks every push notification separately without a `tag`.
- `localStorage` doesn't exist during SSR, so a route loader reading it (event
  limit setting) always fell back to the default — see
  [[gotchas/ssr-hydration-browser-globals]].
- Missing `apple-mobile-web-app-capable` / `viewport-fit=cover` meta tags mean
  iOS doesn't launch standalone or respect notch/Dynamic-Island safe areas.

None of these show up if you only test in a desktop Chrome tab.

## Decision

Cross-platform correctness is a top-priority, non-negotiable constraint for
this project. Every feature touching the service worker, push notifications,
OAuth, or cookies must be built and verified against iOS Safari standalone,
Android Chrome, **and** desktop before it ships — not just the platform the
author happened to test on.

Concrete fixes now baked into the codebase, each addressing one iOS/Android
divergence:

- All cookie-dependent `fetch()` calls (push subscribe/unsubscribe, sign-out
  in `AvatarMenu.tsx`) pass `credentials: 'include'` explicitly.
- Clip/snapshot downloads (`useBlobDownload.ts`) fetch the file, wrap it in a
  `Blob`, and trigger a programmatic `<a>` click via `URL.createObjectURL()`
  instead of relying on `<a download>`, which iOS standalone ignores.
- The event limit setting is persisted in a plain (non-`httpOnly`) cookie
  (`readEventLimitFromCookies`/`useEventLimit.ts`) instead of `localStorage`,
  so the SSR route loader can read the user's real preference on first
  render.
- Push notifications set `tag: 'camera-event'` + `renotify: true` so Android
  collapses a burst into one notification instead of stacking them.
- `__root.tsx` sets `apple-mobile-web-app-capable`, `viewport-fit=cover`, and
  a dynamic `theme-color` meta tag; safe-area insets (`env(safe-area-inset-*)`)
  pad the header, page content, and the SW-update toast.
- The service worker is a custom Serwist build (`src/sw.ts` +
  `src/sw-push-handlers.ts`, bundled by `vite-plugin-sw.ts`) rather than
  `vite-plugin-pwa`, because `vite-plugin-pwa` doesn't yet support TanStack
  Start's Vite 6 Environment API. `vite-plugin-sw.ts` builds the SW with a
  plain Vite `build()` call and injects the precache manifest via
  `@serwist/build` after the main bundle (production) or on `buildStart`
  (dev).

**Working agreement:** when a platform-specific limitation is discovered, it
gets flagged for human review _before_ being silently patched — the fix
usually has a cross-platform trade-off (e.g. JS-required sign-out, blob
buffering large clips in memory) that's worth a second opinion rather than a
quiet one-line patch.

## Alternatives considered

- **Feature-detect iOS standalone and branch behavior** (e.g. native
  `<a download>` everywhere except iOS) — rejected for downloads: the
  fetch+Blob approach works identically on every platform, so branching would
  add complexity for zero benefit.
- **`vite-plugin-pwa`** for the service worker — rejected: incompatible with
  TanStack Start's Vite 6 Environment API at build time.

## Deviation from the plan

The spec/plan (`docs/specs/cross-platform-pwa-fixes.md`) scoped notification-click
navigation as "already fixed" via a simple `postMessage({ type: 'NAVIGATE' })`
fallback + listener. In practice that wasn't sufficient: `clients.openWindow(url)`
on iOS ignores the URL and always opens `start_url`, so a cold-start notification
tap landed on the home page regardless of the fallback.

The current implementation (`src/sw-push-handlers.ts`,
`ServiceWorkerRegistration.tsx`) replaced this with a Cache-Storage-backed
pending-navigation queue: `notificationclick` writes the target URL into a
dedicated cache (`setPendingNavigationUrl`) before calling `openWindow`/`focus`;
the client, on every mount (`claimPendingNavigation`), asks the SW via a
`CLAIM_NAVIGATION` message whether a URL is queued and navigates to it if so.
This survives SW termination between the click and the new window becoming
ready, which the plan's simpler postMessage-only approach did not handle for
the iOS cold-start case.

## Why it matters

iOS PWA constraints don't reproduce in normal desktop development — they only
show up on a real device in standalone mode, so single-platform assumptions
slip in silently and are expensive to catch later. The "flag before fix" rule
exists because the fragile platform (iOS) is usually the one paying the cost
of a fix, and its constraints (JS-only sign-out, in-memory blob downloads,
cache-backed navigation queues) are easy to under-scope without a second look.

## Related

- [[Home]]
- [[gotchas/ssr-hydration-browser-globals]]
- [[gotchas/push-subscription-desync]]
- [[architecture/push-pipeline]]
