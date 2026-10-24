# Spec: Glassmorphism Design System Swap (shadcn/ui)

Status: implemented (2026-10-24); see the ADR for deviations.

## Intent Description

Replace the app's visual identity (the "Ocean/Sunset/Slate" sea-ink/lagoon palette,
Manrope + Fraunces type, light/dark/auto modes) with the **Glassmorphism** design
system: frosted, translucent panes floating over a cool pale-blue backdrop, Inter
throughout, pill buttons, 24px cards, a soft blue-tinted glow for elevation.

At the same time the app adopts **shadcn/ui** as its component layer. The glass
tokens are fed into shadcn's semantic CSS variables, so shadcn components come
out on-brand without per-call-site styling.

Source of truth for every value: `docs/design-system/glassmorphism/` (a copy of
the design-system artifact's `tokens.json`, `README.md` and reference
`bundle.css`; Open Design "Glassmorphism", Apache-2.0, attribution kept in its
README). Live system: https://claude.ai/artifact/9Pjkhbzu3Y5e8hCJrQqS91.

## Decisions (settled with the owner, 2026-10-24)

| #   | Question                       | Decision                                                                                                                                                                                           |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | shadcn/ui                      | **Adopt now.** `components.json`, primitives under `src/features/shared/components/ui/`, themed via shadcn semantic vars.                                                                          |
| D2  | Theme machinery                | **Light only.** Delete palettes, palette picker, theme toggle, `useTheme`, `usePalette`, `themeColor`, dark tokens and the FOUC script. Tokens stay layered so dark can return as one block later. |
| D3  | Blur budget                    | **Blur everywhere, per the DS** — every pane gets `backdrop-filter`. Verified on real devices in the QA task; `@supports` fallback to near-opaque white.                                           |
| D4  | Browser / PWA chrome           | `theme-color` and manifest `theme_color`/`background_color` = **`#eef6ff`**.                                                                                                                       |
| D5  | iOS status bar (platform flag) | `apple-mobile-web-app-status-bar-style` **`black-translucent` → `default`** (white status text was illegible on the pale bar). iOS reads it at install; existing installs must re-add the PWA.     |
| D6  | Hand-built overlays            | **Swap to Radix now**: NavDrawer → shadcn `Sheet`, AvatarMenu → `DropdownMenu`, SnapshotLightbox → `Dialog`.                                                                                       |
| D7  | Delivery                       | **One PR, stacked commits**, one commit per task, on one branch. Every commit must build, test green and render coherently (hence the temporary legacy-alias layer, below).                        |

Further decisions made in planning (not owner-level; recorded so implementers
don't re-derive them):

- **Prefix DS primitives `--gl-*`.** The DS's `accent` (brand blue) and `muted`
  (a text colour) collide with shadcn's `--accent` (hover fill) and `--muted`
  (subtle background). Primitives are `--gl-<ds-name>`; shadcn vars alias them;
  the DS brand blue is exposed to Tailwind as `brand` / `brand-strong`.
- **Named radii, not a rescaled Tailwind scale.** `rounded-sm/md/lg` keep Tailwind
  defaults for incidental use. DS radii become `rounded-input` (16px),
  `rounded-card` (24px), `rounded-hero` (36px); pills use `rounded-full`.
- **Tailwind's default type scale already equals the DS scale** (12/14/16/18/24/36
  = `text-xs/sm/base/lg/2xl/4xl`). No custom font-size tokens.
- **Native `<select>` and `<input type="range">` stay native** (best iOS/Android
  pickers) and are restyled with tokens. Only `role="switch"` buttons become shadcn
  `Switch`; `aria-pressed` filter pills become shadcn `Toggle`.
- **Destructive fill is `danger-text` `#c81e3a`**, not `danger` `#ef4444`: white on
  `#ef4444` fails 4.5:1.
- **Global focus = the DS halo** (`box-shadow: var(--gl-focus-ring)`, no outline).
- Orphaned `localStorage` keys `theme` / `palette` are left alone (harmless).
- App icons are **not** re-tinted in this effort (follow-up issue).

## Scope

**In scope:** `src/styles.css`, shadcn setup + primitives, every `.tsx` that
references a legacy token or legacy CSS class, theme-machinery removal,
`__root.tsx` head meta, `public/manifest.json`, CLAUDE.md/AGENTS.md styling
sections, ADR.

**Out of scope:** dark theme; icon re-tint; layout/IA changes; behaviour changes
other than the Radix overlay swaps; Storybook.

## Token architecture (`src/styles.css`)

Three layers, top to bottom:

### 1. DS primitives — exact values from `tokens.json`

```css
:root {
  color-scheme: light;
  /* colour */
  --gl-bg: #eef6ff;
  --gl-surface: rgba(255, 255, 255, 0.74);
  --gl-surface-warm: rgba(238, 246, 255, 0.72);
  --gl-surface-hover: rgba(
    255,
    255,
    255,
    0.9
  ); /* bundle.css secondary-button hover */
  --gl-fg: #102033;
  --gl-fg-2: #34465f;
  --gl-muted: #60708a;
  --gl-border: rgba(255, 255, 255, 0.64);
  --gl-border-soft: rgba(255, 255, 255, 0.38);
  --gl-accent: #4f8cff;
  --gl-accent-hover: #467de4;
  --gl-accent-active: #3f72d1;
  --gl-accent-strong: #1856ff;
  --gl-accent-strong-hover: #1448e0; /* bundle.css primary hover */
  --gl-accent-on: #ffffff;
  --gl-success: #22c55e;
  --gl-warn: #f59e0b;
  --gl-danger: #ef4444;
  --gl-success-text: #15803d;
  --gl-warn-text: #b45309;
  --gl-danger-text: #c81e3a;
  /* elevation, blur, motion */
  --gl-elev-raised: 0 24px 80px rgba(79, 140, 255, 0.18);
  --gl-elev-ring: 0 0 0 1px rgba(255, 255, 255, 0.64);
  --gl-focus-ring: 0 0 0 4px rgba(79, 140, 255, 0.28);
  --gl-blur-glass: 20px;
  --gl-blur-glass-strong: 32px;
  --gl-motion-fast: 180ms;
  --gl-motion-base: 280ms;
  --gl-ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
}
```

### 2. shadcn semantic variables

| shadcn var                               | value                                         |
| ---------------------------------------- | --------------------------------------------- |
| `--background` / `--foreground`          | `--gl-bg` / `--gl-fg`                         |
| `--card` / `--card-foreground`           | `--gl-surface` / `--gl-fg`                    |
| `--popover` / `--popover-foreground`     | `--gl-surface-hover` / `--gl-fg`              |
| `--primary` / `--primary-foreground`     | `--gl-accent-strong` / `--gl-accent-on`       |
| `--secondary` / `--secondary-foreground` | `--gl-surface` / `--gl-fg`                    |
| `--muted` / `--muted-foreground`         | `--gl-surface-warm` / `--gl-muted`            |
| `--accent` / `--accent-foreground`       | `--gl-surface-warm` / `--gl-fg`               |
| `--destructive`                          | `--gl-danger-text`                            |
| `--border` / `--input` / `--ring`        | `--gl-border` / `--gl-border` / `--gl-accent` |
| `--radius`                               | `24px`                                        |

### 3. Tailwind `@theme inline`

- Colours: the standard shadcn set (`--color-background: var(--background)` …
  `--color-ring`), plus DS extras: `fg-2`, `brand` (`--gl-accent`),
  `brand-strong`, `brand-strong-hover`, `surface-warm`, `surface-hover`,
  `border-soft`, `success`, `success-text`, `warn`, `warn-text`, `danger`,
  `danger-text`.
- Fonts: `--font-sans: Inter, system-ui, sans-serif`;
  `--font-mono: 'SF Mono', ui-monospace, Menlo, monospace`. Google Fonts import
  becomes Inter 400;500;600;700 only (Manrope and Fraunces go).
- Radii: `--radius-input: 16px; --radius-card: 24px; --radius-hero: 36px`.
- Shadows: `--shadow-raised`, `--shadow-ring`, `--shadow-focus`.
- Blur: `--blur-glass: 20px; --blur-glass-strong: 32px` (→ `backdrop-blur-glass`).
- Easing: `--ease-standard`. Leading: `--leading-display: 1.04` (→ `leading-display`).
  Durations use Tailwind's numeric `duration-180` / `duration-280`.

### Utilities and base

- `@utility glass` — `bg-card`, `backdrop-filter: blur(var(--gl-blur-glass)) saturate(140%)`
  (+ `-webkit-`), `1px solid var(--gl-border)`, `box-shadow: var(--gl-elev-raised)`.
  `@utility glass-flat` — `--gl-surface-warm`, `--gl-border-soft`, no shadow
  (nested panes, max two levels). `@utility glass-strong` — the same as `glass`
  with `--gl-blur-glass-strong` (dialogs, menus, sheet).
  The `@supports not (backdrop-filter…)` fallback sets these backgrounds to
  `rgba(255,255,255,0.94)`.
- `@utility eyebrow` — 12px, weight 500, `letter-spacing: 0.04em`, uppercase,
  `color: var(--gl-accent-strong)`.
- `body`: `bg-background text-foreground font-sans`, `line-height: 1.55`, antialiased.
  Backdrop on `body::before` (`position: fixed`, works on iOS, unlike
  `background-attachment: fixed`):
  `radial-gradient(60vmax 45vmax at 12% 8%, rgba(79,140,255,0.45), transparent 70%), radial-gradient(55vmax 50vmax at 92% 85%, rgba(24,86,255,0.28), transparent 70%)`.
  Delete the `body::after` grid texture.
- `*:focus-visible { outline: none; box-shadow: var(--gl-focus-ring); }`.
- `a`: `--gl-accent-strong`, hover `--gl-accent-strong-hover`.
- `.page-wrap`: `width: min(1180px, calc(100% - 2 * gutter))`, with a gutter of 16px under
  640px, 24px up to 1023px and 36px from 1024px.
- Kept component classes, restyled: `.event-card` (glass, `rounded-card`, hover
  lift 3px + raised glow), `.event-thumb`, `.event-meta-fade` (keep the dark photo
  gradient; text over photos stays white), `.nav-link` (underline = `--gl-accent`),
  `.skeleton-shimmer` (`--gl-surface` ↔ `--gl-surface-hover`), `.live-pulse`,
  `.rise-in`, `.event-card-enter`. Every transition and animation uses
  `--gl-ease-standard` and 180/280ms. Keep the global `prefers-reduced-motion` block.
- `@import 'tw-animate-css'` (shadcn's animation classes).

### Temporary legacy-alias layer (deleted in the cleanup task)

To keep every stacked commit rendering, the token task maps each legacy name
still referenced in `src/` onto the new system, in a block fenced
`/* LEGACY ALIASES — delete in cleanup task */`:

`--sea-ink`→`--gl-fg` · `--sea-ink-soft`→`--gl-fg-2` · `--lagoon`→`--gl-accent` ·
`--lagoon-deep`→`--gl-accent-strong` · `--palm`→`--gl-success-text` ·
`--sand`,`--foam`,`--bg-base`,`--bg-mix`→`--gl-bg` · `--surface` stays the DS
value · `--surface-strong`,`--link-bg-hover`,`--surface-raised`→`--gl-surface-hover` ·
`--line`→`--gl-border-soft` · `--chip-bg`,`--header-bg`→`--gl-surface` ·
`--chip-line`→`--gl-border` · `--kicker`,`--link-hover`→`--gl-accent-strong` ·
`--inset-glint`→`--gl-border` · `--accent-emphasis-bg`,`--accent-muted-bg`,
`--accent-hover-bg`,`--accent-muted-hover-bg`,`--accent-emphasis-hover-bg`,
`--selection-bg`→`color-mix(in srgb, var(--gl-accent) 14%, transparent)` (24% for
the two `*-hover-bg`) · `--accent-emphasis-border`,`--accent-muted-border`,
`--link-underline`→`color-mix(in srgb, var(--gl-accent) 40%, transparent)` ·
`--nav-underline-tip`→`--gl-accent` · `--hero-a/b/c`,`--bg-glint`,`--bg-glow-*`→`transparent` ·
`--shadow-island`,`--shadow-card`,`--shadow-card-hover`→`--gl-elev-raised` ·
`--sea-accent`→`--gl-accent`. The legacy classes `.island-shell`, `.island-shell-sm`,
`.island-kicker` and `.display-title` are restyled to glass, eyebrow and Inter
until the sweep removes their uses.

## Legacy → new mapping (call-site sweep)

| Legacy                                                                    | New                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text-(--sea-ink)`                                                        | `text-foreground`                                                                                                                                                                          |
| `text-(--sea-ink-soft)`                                                   | `text-fg-2` (copy) · `text-muted-foreground` (hints, captions, meta)                                                                                                                       |
| `text-(--lagoon-deep)`, `text-(--kicker)`                                 | `text-brand-strong`                                                                                                                                                                        |
| `text-(--lagoon)` / icon accents                                          | `text-brand`                                                                                                                                                                               |
| `text-(--palm)` / success copy                                            | `text-success-text` (dots/icons: `text-success` / `bg-success`)                                                                                                                            |
| `border-(--line)` inside a pane                                           | `border-border-soft`                                                                                                                                                                       |
| `border-(--line)` / `border-(--chip-line)` on a pane edge                 | `border-border`                                                                                                                                                                            |
| `bg-(--surface)`, `bg-(--chip-bg)`, `bg-(--header-bg)`                    | `glass` (blurred pane) or `bg-card`                                                                                                                                                        |
| `bg-(--surface-strong)`, `hover:bg-(--link-bg-hover)`                     | `bg-surface-hover` / `hover:bg-surface-hover`                                                                                                                                              |
| active chip (`--accent-emphasis-*`, `--accent-muted-*`)                   | shadcn `Toggle` / `Button` pressed state (`bg-primary text-primary-foreground`)                                                                                                            |
| `bg-(--bg-base)`                                                          | `bg-background`                                                                                                                                                                            |
| `island-shell` / `island-shell-sm`                                        | `glass rounded-card` (`sm:glass sm:rounded-card`)                                                                                                                                          |
| `island-kicker`                                                           | `eyebrow`                                                                                                                                                                                  |
| `display-title`                                                           | `font-semibold tracking-tight leading-display`                                                                                                                                             |
| raw Tailwind palette colours (`red-*`, `green-*`, `emerald-*`, `amber-*`) | DS signal tokens: text `text-danger-text`/`text-success-text`/`text-warn-text`; borders/icons `border-danger`, `text-success`…; tinted fills `bg-danger/10`, `bg-success/10`, `bg-warn/10` |
| any `dark:` variant                                                       | delete (light only; Tailwind `dark:` follows the OS setting and would fire on dark-mode phones)                                                                                            |
| corner-glow `<div>`s using `--hero-*`                                     | delete (the body backdrop replaces them)                                                                                                                                                   |
| `shadow-(--shadow-*)`                                                     | `shadow-raised`                                                                                                                                                                            |
| hand-rolled buttons                                                       | `<Button variant=…>` from `#/features/shared/components/ui/button`                                                                                                                         |
| text sizes                                                                | page h1 `text-4xl`, card/dialog title `text-2xl`, lead `text-lg`, body `text-base`, labels `text-sm`, captions/badges `text-xs` (all weight 600 for headings)                              |

Text over photos (event thumbnails, live snapshots, lightbox) stays white on the
existing dark gradient; glass badges on photos are fine.

## shadcn setup and primitives

- `components.json`: style `new-york`, `rsc: false`, `tsx: true`, Tailwind v4
  (`tailwind.config: ""`, `css: "src/styles.css"`, `baseColor: "slate"`,
  `cssVariables: true`), `iconLibrary: "lucide"`, aliases
  `components: "#/features/shared/components"`, `ui: "#/features/shared/components/ui"`,
  `utils: "#/features/shared/utils/cn"`, `lib: "#/features/shared/utils"`,
  `hooks: "#/features/shared/hooks"`. If the CLI rejects `#/` aliases, generate with
  `@/` (also mapped in tsconfig) and rewrite the imports to `#/`. If the CLI can't
  reach the registry, hand-copy the component source from the shadcn registry. Never
  let the CLI overwrite `src/styles.css`: diff it and revert anything it adds.
- Dependencies (`bun add`): `radix-ui`, `class-variance-authority`, `clsx`,
  `tailwind-merge`, `tw-animate-css`.
- `cn()` lives in `src/features/shared/utils/cn.ts`.
- Primitives, each with DS styling baked into its variants:
  - **Button**: `rounded-full`, `font-medium`, `duration-180 ease-standard`,
    `active:translate-y-px`, `disabled:opacity-50`, `focus-visible:shadow-focus`.
    Variants: `default` = `bg-primary text-primary-foreground shadow-raised hover:bg-brand-strong-hover`;
    `secondary` = `glass text-foreground hover:bg-surface-hover` (no shadow);
    `ghost` = `text-brand-strong hover:bg-surface-warm`;
    `destructive` = `bg-destructive text-white`;
    `outline` = alias of `secondary`; `link` = `text-brand-strong underline-offset-2 hover:underline`.
    Sizes: `default` (16px label, `px-5 py-3`, `min-h-11`), `sm` (14px, `px-4 py-2`,
    `min-h-11`; touch target stays 44px), `icon` (`size-11`). Prop `loading` adds a
    spinner, `disabled` and `aria-busy`.
  - **Card** (+ Header/Title/Description/Content/Footer/Action): `glass rounded-card p-6`;
    `CardTitle` `text-2xl font-semibold`; `CardDescription` `text-fg-2`. Variant prop
    `flat` (`glass-flat rounded-input p-4`) and `hero` (`rounded-hero p-8`).
  - **Input**: `rounded-input bg-surface-warm border-border px-4 py-3 text-base`
    (16px keeps iOS from zooming on focus), `placeholder:text-muted-foreground`,
    `focus-visible:border-brand focus-visible:shadow-focus`, `aria-invalid:border-danger`.
  - **Badge**: `glass rounded-full px-2.5 py-1.5 text-xs font-medium text-fg-2`, with an
    optional dot. Tones `neutral|accent|success|warn|danger`: the dot uses the signal
    colour and the text its `*-text` partner (`accent` → `text-brand-strong`, dot `bg-brand`).
  - **Switch**: track `bg-surface-warm border-border`, checked `bg-primary`; thumb white
    with `shadow-raised`; `focus-visible:shadow-focus`; touch area at least 44px.
  - **Toggle**: Button `secondary` look; `data-[state=on]:bg-primary data-[state=on]:text-primary-foreground`.
  - **Sheet**: overlay `bg-(--gl-fg)/30`; content `glass-strong` (left side, `w-72`,
    `rounded-r-hero`, `pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`),
    slide `duration-280 ease-standard`.
  - **DropdownMenu**: content `glass-strong rounded-card p-2 min-w-56`; items
    `rounded-input px-3 py-2.5 min-h-11 focus:bg-surface-warm`.
  - **Dialog**: content `glass-strong rounded-hero`. The lightbox uses a full-bleed
    unstyled variant (`className` override).
- jsdom: Radix needs `hasPointerCapture`, `releasePointerCapture`, `scrollIntoView`
  and `ResizeObserver`. Add `src/test-setup.ts` with no-op polyfills and register it as
  `setupFiles` on the `unit` project in `vite.config.ts`. Tests that open Radix menus
  use `@testing-library/user-event` (add as a devDependency if missing), not `fireEvent.click`.

## Radix overlay swaps — contract to preserve

Each swap keeps the component's public props and all existing behavioural tests.
Tests may change only how they find elements; every assertion must keep its strength.

- **NavDrawer → Sheet**: `isOpen`/`onClose`/`id` props unchanged (`open={isOpen}`,
  `onOpenChange={(o) => !o && onClose()}`). Keeps: the dialog accessible name
  "Navigation", the close button "Close navigation" (focused on open), Escape and
  backdrop click close it, links close it on navigate, `aria-current="page"` on the
  active link, body scroll lock, safe-area padding. The hand-written scroll-lock,
  Escape and focus effects are deleted (Radix owns them). The `data-testid`
  `nav-drawer-backdrop` moves onto `SheetOverlay`.
- **AvatarMenu → DropdownMenu**: keeps the trigger's accessible name, the admin
  badge fetch, the menu items and their order, sign-out (a `<form method=post action>` whose submit handler keeps the existing `fetch(POST)` + redirect),
  keyboard navigation and Escape returning focus to the trigger. The hand-written
  click-outside and roving-focus code is deleted.
- **SnapshotLightbox → Dialog**: keeps `src/alt/open/onClose`, pinch-zoom,
  pan and swipe-to-dismiss from `useImageGestures`, and the close button. Radix
  replaces `useModalFocusTrap`; delete the hook and its test if nothing else
  imports it. **Risk:** Radix's scroll lock (`react-remove-scroll`) can cancel
  `touchmove` and break gestures on iOS Safari. If the gesture tests fail, or if
  gestures can't be shown working under `RemoveScroll`, **stop and escalate to
  Opus**. Don't improvise a workaround.

## Theme-machinery removal

Delete `src/features/shared/hooks/{useTheme,usePalette,themeColor}.ts` and their tests,
`src/features/shell/components/ThemeToggle.tsx` and its test. Remove ThemeToggle from
`Header.tsx`. Remove the Theme and Palette sections from `SettingsPage.tsx` (and their
test mocks and assertions). In `__root.tsx`, delete `THEME_INIT_SCRIPT` and its
`<script>`, set the `theme-color` meta to a static `#eef6ff`, and change
`apple-mobile-web-app-status-bar-style` to `default`. Remove `.dark`/`.light`
classes and `suppressHydrationWarning` if they were only there for the theme. Delete
`serializeForScript` if `bun run knip` reports it unused. In `public/manifest.json`,
set `theme_color` and `background_color` to `#eef6ff`.

## Acceptance criteria (whole effort)

1. `bun run test`, `bun run lint`, `bun run format`, `bun run knip` and `bun run build` pass
   on every commit.
2. Grep guard test (`src/styles.legacy-tokens.test.ts`): no file under `src/` contains
   `--sea-`, `--lagoon`, `--palm`, `--sand`, `--foam`, `--chip-`, `--kicker`,
   `--hero-`, `--accent-emphasis`, `--accent-muted`, `island-shell`, `island-kicker`,
   `display-title`, `data-palette`, `dark:`, `Fraunces` or `Manrope`.
3. No `useTheme`/`usePalette`/`ThemeToggle`/`THEME_INIT_SCRIPT` remain.
4. All interactive controls show the DS focus halo and keep a touch target of at least 44px.
5. Device QA passes (task 16): iOS Safari standalone, Android Chrome installed PWA,
   desktop Chrome/Safari/Firefox.

## Task breakdown

Each task is one commit on the feature branch, in dependency order. **Model** = the
intended implementer (Opus reviews every task before the next starts). Every task
follows Red → Green → Refactor for new behaviour. Pure reskins have no new behaviour,
so they update only class-pinning assertions and must keep everything green.

| #                | Task                                                         | Model                     | Depends on |
| ---------------- | ------------------------------------------------------------ | ------------------------- | ---------- |
| 1 (`ce-cqt.1`)   | shadcn foundation + `cn`                                     | Sonnet                    | —          |
| 2 (`ce-cqt.2`)   | Token layer rewrite of `styles.css`                          | Sonnet                    | 1          |
| 3 (`ce-cqt.3`)   | Strip theme machinery + PWA chrome                           | Sonnet                    | 2          |
| 4 (`ce-cqt.4`)   | Base primitives: Button, Card, Input, Badge, Switch, Toggle  | Sonnet                    | 2          |
| 5 (`ce-cqt.5`)   | Overlay primitives + jsdom setup                             | Sonnet                    | 4          |
| 6 (`ce-cqt.6`)   | NavDrawer → Sheet                                            | Sonnet                    | 5          |
| 7 (`ce-cqt.7`)   | AvatarMenu → DropdownMenu                                    | Sonnet                    | 5          |
| 8 (`ce-cqt.8`)   | SnapshotLightbox → Dialog                                    | Sonnet (escalation-prone) | 5          |
| 9 (`ce-cqt.9`)   | Shell reskin: Header, nav, not-found                         | Haiku                     | 3, 4       |
| 10 (`ce-cqt.10`) | Shared components sweep                                      | Haiku                     | 4          |
| 11 (`ce-cqt.11`) | camera-events + cameras + live-view + favorites + home sweep | Haiku                     | 4, 10      |
| 12 (`ce-cqt.12`) | camera-details sweep                                         | Sonnet                    | 4, 10      |
| 13 (`ce-cqt.13`) | settings sweep (Switch, native controls)                     | Sonnet                    | 3, 4       |
| 14 (`ce-cqt.14`) | Cleanup: delete aliases + legacy classes, grep guard test    | Haiku                     | 6–13       |
| 15 (`ce-cqt.15`) | Docs: CLAUDE.md, AGENTS.md, Home.md                          | Haiku                     | 14         |
| 16 (`ce-cqt.16`) | Device QA + final review + PR                                | Opus + owner              | 15         |

Task details live in the matching bd issues (epic `ce-cqt`; `bd ready` shows the next unblocked task). Follow-ups: `ce-0wx` (icon re-tint), `ce-5hb` (dark theme).
Each is written to be self-contained against this spec.

## Alternatives considered

- **Keep the tokens and restyle only:** rejected; the owner wants shadcn.
- **Keep the mode toggle and hide it:** rejected; it leaves dead code until dark mode returns.
- **Blur only on chrome:** offered for iOS/Android performance, but the owner chose
  full fidelity. The risk moves to device QA, where the fallback (a near-opaque
  `glass` background, no blur, only on cards inside scrolling grids) is the
  pre-agreed mitigation if jank shows.
- **Overlays restyled now, Radix later:** rejected by the owner; the swap is in scope,
  and the lightbox gesture risk is fenced by an explicit escalation rule.
