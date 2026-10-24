---
tags: [decision, design-system, ui, theming, pwa]
created: 2026-10-24
---

# Glassmorphism dark mode via `:root.dark` primitive overrides

> Dark mode returns as a re-fit of the Glassmorphism design: deep navy
> `#0b1424`, translucent navy panes, dimmed blue glow. It is driven by a `.dark`
> class on `<html>` that overrides the `--gl-*` primitives, with a
> light/dark/auto toggle in the header and in Settings.

**Status:** planned 2026-10-24 (bd epic ce-5hb). Spec:
`docs/specs/glassmorphism-dark-mode.md`. Supersedes the "light only" part of
[[decisions/2026-10-24-glassmorphism-shadcn-design-system]].

## Context

The Glassmorphism swap shipped light only and deleted the old theme machinery.
The owner asked for a dark version that keeps the design's nuances. The source
design system has no dark tokens, so the values are ours.

## Decision

- **Override primitives, not the shadcn layer.** The glass utilities, `eyebrow`,
  links and several Tailwind colours read `--gl-*` directly, so one
  `:root.dark` block over the primitives is the smallest change that reaches
  everything. The old backlog note suggested overriding the shadcn layer; that
  would have needed parallel dark copies of each utility.
- **Split fill and text roles first.** `--gl-accent-strong` and
  `--gl-danger-text` were each used as both a fill and a text colour. Dark mode
  needs lighter text but the same fills, so new primitives (`--gl-accent-fill`,
  `--gl-accent-fill-hover`, `--gl-danger-fill`) back `--primary`,
  `primary-hover` and `--destructive`. Remaining colour literals (glass
  fallbacks, overlay, backdrop blobs, card hover shadow) also became primitives
  so every themed colour lives in a `:root` block.
- **Modes:** light / dark / auto, default auto, `localStorage['theme']`.
  Header cycle button plus a Settings segmented control on one store.
- **No `dark:` variants.** Dark comes only from tokens; the guard test keeps
  banning `dark:`.
- **PWA chrome:** `theme-color` is synced from JS. iOS
  `apple-mobile-web-app-status-bar-style` stays `default`; the manifest splash
  stays light.

## Alternatives

- Charcoal `#121417` or slate `#0f172a` backgrounds: rejected for navy, which
  keeps the blue cast of the light design.
- White-wash glass (`rgba(255,255,255,0.06)`): looks muddy over the blue blobs
  and weakens text contrast.
- `black-translucent` iOS status bar: would match manual choices, but forces
  every iOS user to re-install and needs safe-area padding.

## Why it matters

- Adding a colour to `styles.css`? Put it in both `:root` and `:root.dark`.
- iOS standalone status bar follows the system, not the app toggle. See
  [[gotchas/ios-status-bar-ignores-app-theme]] (added with ce-5hb.7).
