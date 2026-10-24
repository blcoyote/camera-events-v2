---
tags: [architecture, theming, css, design-system]
created: 2026-06-29
updated: 2026-10-24
---

# Theming: Glassmorphism tokens, light only

> Colour, type, radius, elevation and motion all come from one token stack in
> `src/styles.css`. The app is light-only. The old mode × palette system
> (light/dark/auto × ocean/sunset/slate, `useTheme`, `usePalette` and a FOUC
> script) was removed on 2026-10-24. See
> [[decisions/2026-10-24-glassmorphism-shadcn-design-system]].

## The three layers

1. **Primitives.** `--gl-*` values, copied exactly from
   `docs/design-system/glassmorphism/tokens.json` (for example `--gl-bg`,
   `--gl-accent-strong`, `--gl-elev-raised`). They carry a prefix because the
   design system's `accent` and `muted` mean something different in shadcn.
2. **Semantic.** shadcn variables (`--background`, `--card`, `--primary`,
   `--muted-foreground`, `--border`, `--ring`, …), each a `var(--gl-…)`.
3. **Tailwind.** `@theme inline` maps the semantic layer and the design-system
   extras (`fg-2`, `brand`, `brand-strong`, `surface-warm`, `surface-hover`,
   `border-soft`, `success`/`warn`/`danger` and their `-text` partners) to
   utilities. It also defines radii (`rounded-input|card|hero`), shadows
   (`shadow-raised|focus`), blur (`backdrop-blur-glass`), `ease-standard` and
   `leading-display`.

Custom utilities: `glass`, `glass-flat`, `glass-strong` and `eyebrow`. Element
rules live in `@layer base` and kept component classes in `@layer components`;
see [[gotchas/unlayered-css-beats-tailwind-utilities]].

## Rules

- Components use semantic utilities or the shadcn primitives in
  `src/features/shared/components/ui/`. Never use raw hex, Tailwind palette
  scales (`red-500`) or `dark:` variants. `src/styles.legacy-tokens.test.ts`
  guards against the old token names and `dark:` coming back.
- Browser chrome is a static `#eef6ff` (`<meta name="theme-color">` and the
  manifest). The iOS status bar style is `default`.

## Adding a dark theme later (bd ce-5hb)

Override **only the semantic layer** under a `:root.dark` selector (or a
`[data-theme]` attribute), and leave the `--gl-*` primitives alone. Then bring
back a mode store plus a blocking pre-paint script that sets the class before
hydration. [[gotchas/ssr-hydration-browser-globals]] explains why this can't be
done in render. Also restore a theme-color per mode.
