---
tags: [architecture, theming, css, ssr]
created: 2026-06-29
---

# Theming System & How to Add Color Themes

> Color is fully token-driven across **two orthogonal axes** — mode (light/dark)
> and palette (ocean/sunset/slate). Mode keys off a class; palette off an
> attribute. Adding a new palette is ~20 lines of token values.

## How theming works today

The app has **two independent axes**:

- **Mode:** `'light' | 'dark' | 'auto'` (`useTheme`).
- **Palette:** `'ocean' | 'sunset' | 'slate'` (`usePalette`), ocean = default.

1. **Tokens are the single source of truth.** `src/styles.css` defines ~20 base
   brand/surface CSS custom properties (`--sea-ink`, `--lagoon`, `--surface`,
   `--bg-base`, …) plus a **derived layer** (`--accent-soft-bg`,
   `--accent-strong-bg`, `--hero-a/b/c`, `--shadow-island/card/…`, `--selection-bg`,
   `--link-underline`, …) built with `color-mix()` off the base tokens. Because
   custom-property substitution is lazy, the derived layer **auto-follows** any
   base-token override — so it's defined once and works for every palette × mode.
   Components consume tokens via Tailwind's `bg-(--accent-soft-bg)` syntax.
2. **Mode is a class, palette is an attribute** on `<html>`:
   - `:root` → ocean light (default). `:root.dark` → dark overrides (defined once).
   - `:root[data-palette='sunset']` + `:root[data-palette='sunset'].dark` → palette
     overrides of the ~19 base tokens only (derived layer is shared).
   - The `.dark`/`.light` class is always the **resolved** value (even in auto
     mode), so explicit toggling and OS-auto both work off the same selector.
3. **Two hooks, one meta tag.** `useTheme.ts` and `usePalette.ts` are parallel
   `useSyncExternalStore` stores (persist `localStorage['theme']` /
   `['palette']`). Both call `syncThemeColorMeta()` in `themeColor.ts`, which
   reads the current `<html>` class + `data-palette` and sets `<meta theme-color>`
   from `THEME_COLOR_MAP` — DOM is the shared source of truth, so the two stores
   never race on the tag.
4. **FOUC prevention.** The blocking inline `THEME_INIT_SCRIPT` in `__root.tsx`
   reads both localStorage keys and sets the resolved class, `data-palette`,
   `colorScheme`, and `<meta theme-color>` **before first paint**. Its
   palette→chrome-color map must stay in sync with `THEME_COLOR_MAP`. See
   [[gotchas/ssr-hydration-browser-globals]].
5. **UI entry points:** `ThemeToggle.tsx` (header, mode only) and two pickers on
   `SettingsPage.tsx` (Theme + Color palette).

## ⚠️ Why mode is a `.dark` class, NOT `light-dark()`

The obvious modern approach is one definition per token via
`light-dark(lightVal, darkVal)` driven by `color-scheme`. **It does not work
here.** Tailwind v4's bundled Lightning CSS **polyfills** `light-dark()` into
`--lightningcss-light/dark` toggle vars keyed to `@media (prefers-color-scheme)`
**only** — it ignores the `color-scheme` _property_ that an explicit Light/Dark
toggle sets. Result: the toggle buttons would stop changing colors and the app
would just follow the OS. Tailwind v4 also **ignores `browserslist`**, so you
can't raise the target to emit native `light-dark()`. Verified empirically
(2026-06): both `light-dark()` and a modern browserslist still produced the
media-query-only polyfill. The `.dark`-class approach is plain CSS no toolchain
can rewrite; the only thing lost is no-JS OS-following, which is moot for a
JS-required PWA (the FOUC script always runs).

## How to add a new palette

~20 lines, no engineering:

1. Add two token blocks to `src/styles.css`: `:root[data-palette='NAME']` (light)
   and `:root[data-palette='NAME'].dark` (dark), each overriding the ~19 base
   tokens. The derived layer follows automatically — don't touch it.
2. Add `'NAME'` to the `Palette` union + `PALETTES` array and a `THEME_COLOR_MAP`
   entry in `themeColor.ts`.
3. Add the same entry to the inline map in `THEME_INIT_SCRIPT` (`__root.tsx`).
4. Add `{ value: 'NAME', label: '…' }` to `paletteOptions` in `SettingsPage.tsx`.
5. Tests (TDD): the `usePalette.test.ts` / `SettingsPage.test.tsx` patterns cover
   the wiring; new palettes are pure data.

## Debt status (resolved 2026-06)

- **Dark-token duplication — fixed.** Dark values were written twice (`[data-theme]`
  block + `@media` block). Now defined once under `:root.dark`.
- **Inlined brand hues — tokenized.** ~30 `rgba(79,184,178,…)` / lagoon-deep / palm
  literals across ~12 files now use the derived `--accent-*` / `--hero-*` tokens,
  so palette swaps fully take. (Intentionally left: `getLabelDotColor` in
  `eventFormatting.ts` — those are fixed object-category colors, not theme surfaces.)

## Related

- [[architecture/system-overview]]
- [[gotchas/ssr-hydration-browser-globals]]
- [[Home]]
