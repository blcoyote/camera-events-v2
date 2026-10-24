---
tags: [architecture, theming, css, design-system, dark-mode]
created: 2026-06-29
updated: 2026-10-24
---

# Theming: Glassmorphism tokens, light and dark

> Colour, type, radius, elevation and motion come from one token stack in
> `src/styles.css`. The app has a light and a dark version of the same design,
> chosen by a three-way mode (light / dark / auto) that is stored per device.
> The dark version was added on 2026-10-24; the light-only decision it extends
> is [[decisions/2026-10-24-glassmorphism-shadcn-design-system]] and the dark
> decision is [[decisions/2026-10-24-glassmorphism-dark-mode]]. The design spec
> is `docs/specs/glassmorphism-dark-mode.md`.

## The three layers

1. **Primitives.** `--gl-*` values in `src/styles.css`, copied from
   `docs/design-system/glassmorphism/tokens.json`. The `:root` block holds the
   light values and the `:root.dark` block overrides them. They carry a prefix
   because the design system's `accent` and `muted` mean something different in
   shadcn.
2. **Semantic.** shadcn variables (`--background`, `--card`, `--primary`,
   `--destructive`, `--muted-foreground`, `--border`, `--ring`, …), each a
   `var(--gl-…)`. These are not overridden per mode; they follow the primitives.
3. **Tailwind.** `@theme inline` maps the semantic layer and the design-system
   extras (`fg-2`, `brand`, `brand-strong`, `primary-hover`, `overlay`,
   `surface-warm`, `surface-hover`, `border-soft`, `success`/`warn`/`danger` and
   their `-text` partners) to utilities. It also defines radii
   (`rounded-input|card|hero`), shadows (`shadow-raised|focus`), blur
   (`backdrop-blur-glass`), `ease-standard` and `leading-display`.

Custom utilities: `glass`, `glass-flat`, `glass-strong` and `eyebrow`. Element
rules live in `@layer base` and kept component classes in `@layer components`;
see [[gotchas/unlayered-css-beats-tailwind-utilities]].

### Fill and text roles

Some colours were used both as a fill (a button background with white text) and
as text (a link on a pane). Dark mode needs lighter text but the same fills, so
the roles are split into separate primitives:

| Primitive            | Role                                                    |
| -------------------- | ------------------------------------------------------- |
| `--gl-accent-fill`   | Fill: `--primary`, white text on buttons (`#1856ff`)    |
| `--gl-accent-strong` | Text: `text-brand-strong`, links, `eyebrow`             |
| `--gl-danger-fill`   | Fill: `--destructive` (`#c81e3a` light, `#dc2626` dark) |
| `--gl-danger-text`   | Text: `text-danger-text`                                |

Fills stay the same in both modes. Text roles get lighter in dark mode. Do not
use a text primitive as a fill, or the dark text colour will leak into buttons.

## Modes and the runtime

Three modes: `light`, `dark` and `auto` (follows `prefers-color-scheme`). The
default is `auto`. The choice is stored per device in `localStorage` under the
key `theme`. It never reaches the server.

- **`src/features/shared/hooks/themeMode.ts`** (pure, no React, no DOM at import):
  `ThemeMode`, `THEME_STORAGE_KEY = 'theme'`,
  `THEME_COLORS = { light: '#eef6ff', dark: '#0b1424' }`,
  `parseThemeMode(raw)` (anything unknown, including `null`, becomes `'auto'`),
  `resolveThemeMode(mode, prefersDark)`, `nextThemeMode(mode)` (light → dark →
  auto → light), `applyResolvedTheme(resolved, doc = document)` and
  `buildThemeInitScript()`. `applyResolvedTheme` sets exactly one of the
  `light` / `dark` classes on `<html>` (the `dark` class marks dark mode),
  sets `style.colorScheme`, and sets `<meta name="theme-color">` to the resolved
  colour.
- **`src/features/shared/hooks/useTheme.ts`**: one module-level store read
  through `useSyncExternalStore`. Its server snapshot is `'auto'`, so SSR markup
  is the same for every visitor. It returns `{ mode, resolved, setTheme,
cycleTheme }`. On mount it reads storage, then applies the resolved theme.
  While `mode === 'auto'` it listens to the `(prefers-color-scheme: dark)` media
  query and re-applies on change, falling back to the legacy `addListener` API
  for older iOS Safari. `setTheme` writes storage inside try/catch (private
  mode can throw) and applies the theme. The header toggle and Settings share
  this store, so one change updates both.
- **Blocking init script in `src/routes/__root.tsx`**: the
  script from `buildThemeInitScript()` is injected in `<head>` right after
  `<HeadContent />`, which emits the `theme-color` meta it updates. It sets the `light` / `dark` class, `colorScheme` and the
  `theme-color` meta before first paint, so a reload in dark never flashes
  light. It is ES5 that only touches `window` globals, and it is wrapped in
  try/catch so it cannot break the page. `<html>` gets `suppressHydrationWarning`,
  because the class differs between server and client. The `theme-color` meta
  default in the HTML stays `#eef6ff`. See
  [[gotchas/ssr-hydration-browser-globals]] for why this cannot run in render.

## Dark mode values

All colour lives in `:root` (light) and `:root.dark` (dark). `:root.dark` also
sets `color-scheme: dark`. The dark palette is navy, not black: background
`#0b1424`, panes are translucent navy `rgba(22, 34, 58, 0.62)` with a faint white
hairline, and the backdrop blobs are kept at about half the light alpha. The full
primitive table is in the spec. Contrast is WCAG AA in both modes.

**Rule: every new colour primitive needs a `:root.dark` value.** Adding a colour
to `:root` only will leave it light in dark mode. Unchanged values are allowed
(for example `--gl-accent`), but the entry should still be written out so the
choice is deliberate. Colour literals in `src/styles.css` should live only in
`:root` / `:root.dark` blocks; the image scrims and scanlines are the allow-listed
exception because they sit on photos, not on the theme.

Photo overlays (`bg-black/50 text-white` and the like) are mode-independent.

## Rules

- Components use semantic utilities or the shadcn primitives in
  `src/features/shared/components/ui/`. Never use raw hex, Tailwind palette
  scales (`red-500`) or `dark:` variants. Dark comes only from tokens.
  `src/styles.legacy-tokens.test.ts` guards against the old token names and
  `dark:` coming back.
- Every new colour primitive gets a `:root.dark` value (see above).
- Do not read `localStorage`, `matchMedia` or `document` during render. Use the
  `useTheme` store, the init script, or `useEffect`.

## UI

- **Header `ThemeToggle`** (`src/features/shell/components/ThemeToggle.tsx`):
  an icon-only ghost button that cycles light → dark → auto.
  It shows a sun, moon or sun-moon icon for the current mode. Its `aria-label`
  reads `Theme: <Light|Dark|System>. Switch to <next>.` It sits in the
  `ml-auto` group of `Header.tsx`, before sign-in / avatar, for signed-in and
  signed-out visitors. Until mounted it renders the `auto` icon, which matches
  the server snapshot.
- **Settings `AppearanceSettings`**
  (`src/features/settings/components/AppearanceSettings.tsx`):
  a card titled **Appearance** with a `role="group"` labelled `Theme`. It
  holds three toggle buttons (Light / Dark / System); `aria-pressed` marks the
  current mode. Toggle buttons, not radios, because the radio pattern would
  need arrow-key roving focus. It is rendered
  in `SettingsPage.tsx` below the hero card.

## Theme colour and platform

- `<meta name="theme-color">` follows the resolved mode from JS, so browser
  chrome matches the app on Android, desktop Chrome and the iOS Safari tab.
- The manifest `background_color` and `theme_color` stay `#eef6ff`, and the
  icons are unchanged. The Android splash therefore stays light for dark users.
  This is accepted.
- The iOS standalone status bar is set by `apple-mobile-web-app-status-bar-style`,
  which stays `default`. iOS then draws the bar from the _system_ appearance, not
  from the app toggle. A dark-mode user on a light iPhone sees a light bar over
  the dark app, and the reverse. See
  [[gotchas/ios-status-bar-ignores-app-theme]]. Changing the style to
  `black-translucent` would fix it but needs a re-install and safe-area padding.

## Related

- [[decisions/2026-10-24-glassmorphism-dark-mode]]
- [[decisions/2026-10-24-glassmorphism-shadcn-design-system]]
- [[gotchas/ios-status-bar-ignores-app-theme]]
- [[gotchas/unlayered-css-beats-tailwind-utilities]]
- [[gotchas/ssr-hydration-browser-globals]]
- [[Home]]
