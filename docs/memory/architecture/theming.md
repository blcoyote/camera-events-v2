---
tags: [architecture, theming, css, ssr]
created: 2026-06-29
---

# Theming System & How to Add Color Themes

> Color is fully token-driven and applied via one `<html>` attribute. Adding
> swappable color themes is additive and low-risk — the hard indirection layer
> already exists.

## How theming works today

The app currently has **one axis: light / dark / auto mode**. There is a single
color palette (ocean/lagoon — teals & greens).

1. **Tokens are the single source of truth.** `src/styles.css` defines ~25 CSS
   custom properties in `:root` (`--sea-ink`, `--lagoon`, `--surface`,
   `--bg-base`, …). Components consume them via Tailwind's `text-(--sea-ink)`
   syntax — almost no component hardcodes a color.
2. **One attribute applies the theme.** Everything keys off `data-theme` on
   `<html>`:
   - `:root` → light (default)
   - `:root[data-theme='dark']` → dark
   - `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` →
     the "auto" path (follows the OS)
3. **One hook owns the state.** `src/features/shared/hooks/useTheme.ts` is a
   `useSyncExternalStore` store: sets the attribute + class, persists
   `localStorage['theme']`, updates `<meta theme-color>`. Mode is
   `'light' | 'dark' | 'auto'`.
4. **FOUC prevention.** A blocking inline script in `src/routes/__root.tsx`
   (`THEME_INIT_SCRIPT`) reads localStorage and sets `data-theme` **before first
   paint**. This is required for SSR — without it the page flashes the wrong
   theme on hydration. See [[gotchas/ssr-hydration-browser-globals]].
5. **UI entry points:** `ThemeToggle.tsx` (cycles light→dark→auto) and the
   buttons on `SettingsPage.tsx`.

## Recommended way to add color themes

Treat the color **palette** as a _second axis orthogonal to mode_. Keep
light/dark/auto exactly as-is; add a parallel `data-palette` attribute so each
palette works in both light and dark.

- **CSS:** define a token block per palette, e.g. `:root[data-palette='sunset']`
  plus its `:root[data-palette='sunset'][data-theme='dark']` variant. This is the
  bulk of the work — but it's _design_ (choosing/tuning ~25 token values per
  palette × mode), not engineering.
- **Hook:** add a `palette` store mirroring the existing `mode` store
  (`setAttribute('data-palette', …)`, persist `localStorage['palette']`). ~30
  lines, copy of the existing pattern.
- **FOUC script:** extend it to also read + apply `data-palette` (~2 lines).
  **Don't forget this** — a palette applied only in React will flash on load.
- **UI:** add a palette picker mirroring `themeOptions` in `SettingsPage.tsx`.
- **Tests (TDD, per CLAUDE.md):** mirror `useTheme.test.ts`.

Estimated ~half-day; most of it is picking palettes, not wiring.

## Gotchas / cleanup before scaling palettes

- **Dark-token duplication.** Dark values are written _twice_ in
  `src/styles.css` — once under `[data-theme='dark']` and again inside the
  `@media (prefers-color-scheme: dark)` block for the "auto" path. With N
  palettes this duplication multiplies. Refactor to define each palette's dark
  tokens once (shared selector list) **before** adding palettes, or the
  stylesheet gets unwieldy.
- **~15 files hardcode color literals** that bypass tokens (hex / `rgba()`). Most
  are mode-independent decoration (thumbnail overlays, shadows) and are fine. But
  a few hardcode _brand hues_ — e.g. the active pill in `SettingsPage.tsx` uses
  `rgba(79,184,178,0.18)`, which is `--lagoon` inlined — and those will stay
  green when the palette changes. Tokenize them or palettes won't fully take.

## Why it matters

Theming is usually painful because color is scattered. Here it isn't — the
token + single-attribute design is exactly the foundation a multi-theme system
needs, so the feature is additive rather than a rewrite. The only structural debt
is the dark-token duplication, which is cheap to fix while there's still one
palette.

## Related

- [[architecture/system-overview]]
- [[gotchas/ssr-hydration-browser-globals]]
- [[Home]]
