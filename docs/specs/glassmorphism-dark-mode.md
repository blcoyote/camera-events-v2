# Glassmorphism dark mode

**Status:** planned 2026-10-24. Epic: bd `ce-5hb`. Decision record:
`docs/memory/decisions/2026-10-24-glassmorphism-dark-mode.md`. Builds on
`docs/specs/glassmorphism-design-system.md` (light only).

## Problem

The Glassmorphism swap (PR #149) removed the old light/dark/auto theming and
shipped light only. The owner wants a dark version of the same design: frosted
panes, brand-blue accents and background glow, re-fitted for a dark, not
pure-black, background. The theme toggle comes back.

## Decisions (settled with the owner)

| #   | Topic              | Decision                                                                                                                                                             |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Modes              | `light` / `dark` / `auto` (follows `prefers-color-scheme`). Default `auto`. Persisted per device in `localStorage` key `theme`.                                      |
| D2  | Controls           | Both: a header icon button that cycles light → dark → auto, and an **Appearance** card in Settings with a Light / Dark / System segmented control. One shared store. |
| D3  | Background         | Deep navy `#0b1424`.                                                                                                                                                 |
| D4  | Glass panes        | Translucent navy `rgba(22,34,58,0.62)` with a faint white hairline (`rgba(255,255,255,0.10)`).                                                                       |
| D5  | Backdrop blobs     | Kept, at about half the light-mode alpha.                                                                                                                            |
| D6  | Accents and status | Filled primary stays `#1856ff` with white text. Text-role blue lightens to `#8ab4ff`. Status text lightens. Shadows go from blue glow to soft black.                 |
| D7  | CSS mechanism      | `.dark` class on `<html>`. One `:root.dark` block overrides the `--gl-*` primitives and sets `color-scheme: dark`. `dark:` variants stay banned (guard test).        |
| D8  | PWA chrome         | JS keeps `<meta name="theme-color">` in sync with the resolved mode. iOS `apple-mobile-web-app-status-bar-style` stays `default` (see Platform notes).               |
| D9  | Splash and icons   | Manifest `background_color` stays `#eef6ff`. Icons unchanged.                                                                                                        |
| D10 | No flash           | A blocking inline script in `__root.tsx` applies the class, `colorScheme` and `theme-color` before first paint. `<html suppressHydrationWarning>`.                   |

## Token design

### Role split (prerequisite, no visual change in light)

Today `--gl-accent-strong` is used both as a **fill** (`--primary`, button
hover via `bg-brand-strong-hover`) and as **text** (`text-brand-strong`,
links, `eyebrow`). Likewise `--destructive` aliases `--gl-danger-text` but is
used as a fill with white text. In dark mode the text role must get lighter
while the fill must not, so the roles are split first:

| New primitive            | Light value                            | Used by                                                                  |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| `--gl-accent-fill`       | `#1856ff`                              | `--primary`                                                              |
| `--gl-accent-fill-hover` | `#1448e0`                              | new Tailwind colour `primary-hover` (replaces `brand-strong-hover`)      |
| `--gl-danger-fill`       | `#c81e3a`                              | `--destructive`                                                          |
| `--gl-surface-solid`     | `rgba(255, 255, 255, 0.94)`            | the `@supports not (backdrop-filter)` fallbacks in the 3 glass utilities |
| `--gl-overlay`           | `rgba(16, 32, 51, 0.4)`                | new Tailwind colour `overlay`; Dialog and Sheet overlays (`bg-overlay`)  |
| `--gl-blob-1`            | `rgba(79, 140, 255, 0.45)`             | `body::before` first radial gradient                                     |
| `--gl-blob-2`            | `rgba(24, 86, 255, 0.28)`              | `body::before` second radial gradient                                    |
| `--gl-elev-raised-hover` | `0 28px 88px rgba(79, 140, 255, 0.26)` | `.event-card:hover` box-shadow                                           |

After the split, every colour literal in `src/styles.css` lives inside a
`:root` or `:root.dark` block, except the image scrims/scanlines (black on
photos, mode-independent) which are allow-listed.

`--color-brand-strong-hover` is removed (its only user is the Button default
variant, which moves to `hover:bg-primary-hover`).

### Dark values (`:root.dark`)

| Primitive                  | Light                                  | Dark                                  |
| -------------------------- | -------------------------------------- | ------------------------------------- |
| `color-scheme`             | `light`                                | `dark`                                |
| `--gl-bg`                  | `#eef6ff`                              | `#0b1424`                             |
| `--gl-surface`             | `rgba(255, 255, 255, 0.74)`            | `rgba(22, 34, 58, 0.62)`              |
| `--gl-surface-warm`        | `rgba(238, 246, 255, 0.72)`            | `rgba(18, 30, 52, 0.55)`              |
| `--gl-surface-hover`       | `rgba(255, 255, 255, 0.9)`             | `rgba(30, 46, 76, 0.82)`              |
| `--gl-surface-solid`       | `rgba(255, 255, 255, 0.94)`            | `rgba(22, 34, 58, 0.96)`              |
| `--gl-fg`                  | `#102033`                              | `#e6eefc`                             |
| `--gl-fg-2`                | `#34465f`                              | `#b6c4dc`                             |
| `--gl-muted`               | `#60708a`                              | `#8c9dba`                             |
| `--gl-border`              | `rgba(255, 255, 255, 0.64)`            | `rgba(255, 255, 255, 0.1)`            |
| `--gl-border-soft`         | `rgba(255, 255, 255, 0.38)`            | `rgba(255, 255, 255, 0.06)`           |
| `--gl-accent`              | `#4f8cff`                              | unchanged                             |
| `--gl-accent-strong`       | `#1856ff`                              | `#8ab4ff`                             |
| `--gl-accent-strong-hover` | `#1448e0`                              | `#a9c7ff`                             |
| `--gl-accent-fill`         | `#1856ff`                              | unchanged                             |
| `--gl-accent-fill-hover`   | `#1448e0`                              | unchanged                             |
| `--gl-success-text`        | `#15803d`                              | `#4ade80`                             |
| `--gl-warn-text`           | `#b45309`                              | `#fbbf24`                             |
| `--gl-danger-text`         | `#c81e3a`                              | `#fb7185`                             |
| `--gl-danger-fill`         | `#c81e3a`                              | `#dc2626`                             |
| `--gl-overlay`             | `rgba(16, 32, 51, 0.4)`                | `rgba(2, 6, 14, 0.6)`                 |
| `--gl-blob-1`              | `rgba(79, 140, 255, 0.45)`             | `rgba(79, 140, 255, 0.22)`            |
| `--gl-blob-2`              | `rgba(24, 86, 255, 0.28)`              | `rgba(24, 86, 255, 0.14)`             |
| `--gl-elev-raised`         | `0 24px 80px rgba(79, 140, 255, 0.18)` | `0 24px 80px rgba(0, 0, 0, 0.45)`     |
| `--gl-elev-raised-hover`   | `0 28px 88px rgba(79, 140, 255, 0.26)` | `0 28px 88px rgba(0, 0, 0, 0.55)`     |
| `--gl-elev-ring`           | `0 0 0 1px rgba(255, 255, 255, 0.64)`  | `0 0 0 1px rgba(255, 255, 255, 0.1)`  |
| `--gl-focus-ring`          | `0 0 0 4px rgba(79, 140, 255, 0.28)`   | `0 0 0 4px rgba(138, 180, 255, 0.45)` |

Unchanged in dark: `--gl-accent-hover`, `--gl-accent-active`, `--gl-accent-on`,
`--gl-success`, `--gl-warn`, `--gl-danger`, blur, motion, radii. Photo
overlays (`bg-black/50 text-white` etc.) are mode-independent.

### Contrast (WCAG AA, computed)

Measured against bare `#0b1424`, against the brightest blob-tinted backdrop
(`#1a2e54`) and against a pane over that backdrop (`#182744`):

| Text                    | on bg | on blob | on pane |
| ----------------------- | ----- | ------- | ------- |
| fg `#e6eefc`            | 15.8  | 11.5    | 12.7    |
| fg-2 `#b6c4dc`          | 10.5  | 7.6     | 8.4     |
| muted `#8c9dba`         | 6.7   | 4.9     | 5.4     |
| accent-strong `#8ab4ff` | 8.8   | 6.4     | 7.1     |
| accent `#4f8cff`        | 5.7   | 4.2*    | 4.6     |
| success-text `#4ade80`  | 10.6  | 7.7     | 8.5     |
| warn-text `#fbbf24`     | 11.0  | 8.1     | 8.9     |
| danger-text `#fb7185`   | 6.9   | 5.0     | 5.5     |
| white on `#1856ff` fill | 5.5   |         |         |
| white on `#dc2626` fill | 4.8   |         |         |

\* `text-brand` is only used on panes or large text; acceptable.

## Theme runtime

- `src/features/shared/hooks/themeMode.ts` (pure, no React):
  `ThemeMode = 'light' | 'dark' | 'auto'`, `THEME_STORAGE_KEY = 'theme'`,
  `THEME_COLORS = { light: '#eef6ff', dark: '#0b1424' }`,
  `parseThemeMode(raw): ThemeMode` (unknown → `'auto'`),
  `resolveThemeMode(mode, prefersDark): 'light' | 'dark'`,
  `nextThemeMode(mode)` (light → dark → auto → light),
  `applyResolvedTheme(resolved, doc = document)`: sets exactly one of the
  `light`/`dark` classes on `<html>`, `style.colorScheme`, and the
  `theme-color` meta content.
- `src/features/shared/hooks/useTheme.ts`: module-level store via
  `useSyncExternalStore` (server snapshot `'auto'`). Returns
  `{ mode, resolved, setTheme, cycleTheme }`. On mount reads storage. While
  `mode === 'auto'` it listens to `matchMedia('(prefers-color-scheme: dark)')`
  `change` and re-applies. `setTheme` writes storage (try/catch: private mode)
  and applies. Header and Settings share the module store.
- `src/routes/__root.tsx`: `THEME_INIT_SCRIPT` built from `THEME_STORAGE_KEY`
  and `THEME_COLORS` with `JSON.stringify` (constants only, no user input),
  injected in `<head>` right after `<HeadContent />` (which emits the `theme-color` meta it updates; `<body>` is not parsed yet, so it still runs before first paint). Wrapped in try/catch. The
  `theme-color` meta default stays `#eef6ff`.

## UI

- `src/features/shell/components/ThemeToggle.tsx`: `<Button variant="ghost"
size="icon">` with lucide `SunIcon` / `MoonIcon` / `SunMoonIcon` for
  light / dark / auto. `aria-label` = `Theme: <Light|Dark|System>. Switch to
<next>.` Placed in `Header.tsx` inside the `ml-auto` group, before sign-in /
  avatar, shown for signed-in and signed-out users. Until mounted it renders
  the auto icon (server snapshot) so SSR markup matches.
- `src/features/settings/components/AppearanceSettings.tsx`: a `Card` titled
  **Appearance** with a `role="group"` `aria-label="Theme"` of three
  `Toggle`s (Light / Dark / System), `pressed` (`aria-pressed`) = current mode.
  Toggle buttons rather than radios: radios would need arrow-key roving focus.
  Rendered in `SettingsPage.tsx` right after the hero card.

## Platform notes

- **iOS standalone:** the status bar style is read at install time.
  With `default`, iOS draws it from the _system_ appearance, not the app's
  choice. A user who picks Dark on a light-mode iPhone sees a light status bar
  over the dark app (and vice versa). Accepted; documented in
  `docs/memory/gotchas/`. Switching to `black-translucent` would fix it but
  forces every iOS user to re-add the PWA and needs safe-area padding work.
- **Android / desktop Chrome, iOS Safari tab:** `theme-color` is updated live
  from JS, so the bar follows the app's choice.
- **Splash:** Android builds the splash from manifest `background_color`
  (`#eef6ff`); dark users see a short light splash. Accepted.

## Acceptance criteria

1. Every route (home, events list, event detail + lightbox, cameras, live view,
   favorites, settings, 404) and every `ui/` primitive renders correctly in dark.
2. All text meets WCAG AA in both modes (table above; spot-checked in QA).
3. Reloading with `theme=dark` (or `auto` + system dark) never paints light first.
4. Header button and Settings control share state, persist across reloads,
   and `auto` follows a live system change.
5. `theme-color` matches the resolved mode after every change.
6. `bun run test`, `bun run lint`, `bun x tsc --noEmit`, `bun run build` and
   the e2e suite pass.
7. Owner confirms on an iOS and an Android device.

## Tasks

Model: **S** = Sonnet subagent, **H** = Haiku subagent, **Owner** = human.
Each leaf task is one subagent run: a few named files, exact values, tests
first, and the gates `bun run test`, `bun run lint`, `bun x tsc --noEmit`.
Full instructions live in each bd issue (`bd show <id>`). Tasks `.1`, `.3`,
`.4`, `.7` and `.8` are containers, closed when their subtasks are.

| Task       | Model | After     | Scope                                                                     |
| ---------- | ----- | --------- | ------------------------------------------------------------------------- |
| ce-5hb.1.1 | H     |           | `--gl-accent-fill(-hover)`, `primary-hover`, Button hover                 |
| ce-5hb.1.2 | H     | .1.1      | `--gl-danger-fill` → `--destructive`; creates `src/styles.tokens.test.ts` |
| ce-5hb.1.3 | H     | .1.2      | `--gl-overlay` + `bg-overlay` in Dialog and Sheet                         |
| ce-5hb.1.4 | H     | .1.3      | Glass fallbacks, backdrop blobs, event-card hover shadow tokens           |
| ce-5hb.1.5 | S     | .1.4      | Guard test: colour literals only inside `:root` blocks                    |
| ce-5hb.2   | H     | .1        | `:root.dark` block with the dark values + parity test                     |
| ce-5hb.3.1 | H     |           | `themeMode.ts` pure helpers                                               |
| ce-5hb.3.2 | H     | .3.1      | `applyResolvedTheme` DOM helper                                           |
| ce-5hb.3.3 | S     | .3.2      | `useTheme` store: shared state + persistence                              |
| ce-5hb.3.4 | S     | .3.3      | `useTheme`: follow live system changes in auto                            |
| ce-5hb.4.1 | S     | .3        | `buildThemeInitScript()` pure builder                                     |
| ce-5hb.4.2 | H     | .4.1      | Inject the script in `__root.tsx`, `suppressHydrationWarning`             |
| ce-5hb.5   | H     | .3        | Header `ThemeToggle`                                                      |
| ce-5hb.6   | H     | .3        | Settings `AppearanceSettings`                                             |
| ce-5hb.7.1 | H     | .1, .2    | `tokens.json` + DS README dark addendum                                   |
| ce-5hb.7.2 | H     | .1, .2    | Vault: theming note + iOS status bar gotcha                               |
| ce-5hb.7.3 | H     | .1, .2    | CLAUDE.md / AGENTS.md / light spec wording                                |
| ce-5hb.8.1 | S     | .2, .4–.6 | e2e: no flash, toggle cycles and persists                                 |
| ce-5hb.8.2 | S     | .8.1      | Dark visual QA sweep with screenshots                                     |
| ce-5hb.9   | Owner | .8        | Device QA on iOS and Android                                              |

Parallel lanes: `.1.x` (CSS) and `.3.x` (runtime) start together. After
`.3`: `.4.x`, `.5` and `.6` run in parallel. `.7.x` run in parallel once
the tokens land. The `.1.x` chain is sequential because every step edits
`src/styles.css`.
