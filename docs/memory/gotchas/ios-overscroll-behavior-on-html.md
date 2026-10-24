---
tags: [gotcha, ios, css, pwa]
created: 2026-10-24
---

# ⚠️ iOS Safari reads overscroll-behavior from html, not body

> To stop Safari's native pull-to-refresh and rubber-band bounce, put
> `overscroll-behavior-y: none` on `html`. On `body` Safari ignores it, and
> `contain` keeps the bounce.

## Context

Our custom pull-to-refresh (`usePullToRefresh`) ran alongside Safari's own on
iOS: our arrow appeared while the bounce dragged the sticky header down the
page — a double refresh. The spec claimed `overscroll-behavior` was a no-op on
iOS and relied on `touchmove` `preventDefault()` instead, with
`body { overscroll-behavior-y: contain }` for Android.

## What we know / decided

- Safari 16+ supports `overscroll-behavior`, but for the page scroller it is
  only read from the root element. Chrome also accepts it on `body`, so the old
  rule fixed Android and silently did nothing on iOS.
- `contain` only stops scroll chaining; `none` also removes the bounce and the
  native pull-to-refresh.
- `preventDefault()` in `touchmove` cannot rescue it: iOS commits to scrolling
  at the first uncancelled `touchmove`, and the hook waits ~5px to lock the
  swipe direction before cancelling. Later cancels are ignored.
- Decision: `html { overscroll-behavior-y: none; }` app-wide, iOS 16+ only. The
  bounce goes everywhere, including list bottoms and pages without our gesture.
  The hook's touch handling stays as is. Guarded by `src/styles.overscroll.test.ts`.

## Why it matters

The failure only shows on a real iOS device; jsdom, desktop WebKit and Android
all look fine. If the double refresh returns, check the rule is still on `html`
before touching the hook.

## Related

- [[Home]]
- [[gotchas/unlayered-css-beats-tailwind-utilities]]
