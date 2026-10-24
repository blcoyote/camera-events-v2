---
tags: [gotcha, ios, pwa, theming, dark-mode]
created: 2026-10-24
---

# ⚠️ iOS standalone status bar ignores the app's theme toggle

> With `apple-mobile-web-app-status-bar-style` set to `default`, the iOS status
> bar follows the system appearance, not the app's light/dark choice. We accept
> this.

## Context

Dark mode adds a light / dark / auto toggle inside the app (see
[[decisions/2026-10-24-glassmorphism-dark-mode]]). Android and desktop Chrome
take their browser-chrome colour from `<meta name="theme-color">`, which the app
updates from JS, so the bar follows the toggle. iOS does not.

## What we know / decided

- iOS reads the status bar style from `apple-mobile-web-app-status-bar-style`
  when the app is added to the Home Screen. It is not re-read on each load.
- With `default`, the bar is light or dark to match the **system** appearance.
  A user who picks Dark in the app on a light-mode iPhone sees a light status
  bar over the dark app. The reverse also happens.
- `theme-color` does not change the iOS standalone status bar, so the JS sync
  cannot fix this on iOS.
- Decision: keep `default`. This is accepted, and the app's own UI is correct.

## Why it matters

- The fix would be `black-translucent`, which makes the status bar sit over the
  page. It would then need the content to be padded for the safe area (the
  notch). Changing the style is also read only at install time, so every iOS
  user would have to delete and re-add the app to see it.
- Both costs are bigger than a mismatched status bar strip, so `default` stays.
- Do not "fix" this by changing the style and expecting the toggle to take
  effect. Test on a device: iOS standalone, the toggle in dark, and a light
  iPhone system setting. The bar will still follow the system.
- Android (the manifest splash and `theme-color`) and iOS Safari tabs are not
  affected. See [[architecture/theming]].

## Related

- [[architecture/theming]]
- [[decisions/2026-10-24-glassmorphism-dark-mode]]
- [[gotchas/ios-ignores-silent-and-renotify]]
- [[Home]]
