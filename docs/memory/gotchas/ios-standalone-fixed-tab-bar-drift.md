---
tags: [gotcha, ios, css, pwa]
created: 2026-11-07
---

# ⚠️ iOS standalone PWAs can leave a fixed bottom bar stuck mid-screen

> After the installed app is resumed from the background and the user scrolls,
> WebKit can position `position: fixed; bottom: 0` elements against a stale,
> shorter viewport. The tab bar then sits roughly where a keyboard's top edge
> would be, with content scrolling underneath it, until the app is relaunched.

## Context

Reported on an installed iPhone app: open from background, scroll, and the tab
bar floated at about 62% of the screen height. No tap, keyboard or picker was
involved. The same thing happens in other installed PWAs (Google News), so it is
a WebKit bug, not our layout. It does not reproduce in Chromium or WebKit
emulation.

## What we know / decided

- Mitigation, not a fix: `useTabBarViewportRepair` (shell feature) runs only in
  standalone mode. On resume (`visibilitychange`, `pageshow`), visual viewport
  `resize`, `orientationchange` and after scrolling stops, it forces a relayout
  of the nav (`display: none` → reflow → restore). If the nav's bottom still
  differs from `visualViewport.offsetTop + height`, it applies a corrective
  `translateY`.
- It skips while an editable element is focused (the keyboard legitimately
  shrinks the visual viewport) and while pinch-zoomed.
- Fallback if this proves insufficient: make the page body a fixed-height flex
  column with an inner scroll container, so the tab bar is never `position:
  fixed`. Costlier: pull-to-refresh, scroll restoration and the
  `overscroll-behavior` rule all assume the document scrolls.

## Why it matters

Only a real device can confirm the mitigation. If the drift returns, check
whether `visualViewport` itself reports the stale height. If it does, the
translate has no correct target, and the inner-scroller layout is the next step.

## Related

- [[Home]]
- [[gotchas/ios-overscroll-behavior-on-html]]
