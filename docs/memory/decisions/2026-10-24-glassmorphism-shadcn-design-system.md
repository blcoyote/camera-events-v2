---
tags: [decision, design-system, ui, tailwind, shadcn, pwa]
created: 2026-10-24
---

# Glassmorphism design system on shadcn/ui, light only

> The app's ocean/sunset/slate palettes, light/dark modes, and Manrope + Fraunces
> type give way to the Glassmorphism design system (Inter, frosted panes on
> `#eef6ff`). shadcn/ui is adopted as the component layer, themed through its
> semantic CSS variables.

**Status:** implemented 2026-10-24; device QA pending (bd ce-cqt.16). Spec:
`docs/specs/glassmorphism-design-system.md`.

## Context

The owner chose a new visual identity, published as a design-system artifact.
That artifact is based on Open Design's "Glassmorphism", Apache-2.0, and a copy
lives in `docs/design-system/glassmorphism/`. It is light-only. The app had no
component library; it used hand-written Tailwind against `--sea-ink`/`--lagoon`
vars and a palette × mode theming system that a blocking FOUC script applied.

## Decision

- **Token layering:** DS primitives `--gl-*` (exact values) → shadcn semantic
  vars (`--background`, `--primary`, …) → Tailwind `@theme inline`. The `--gl-`
  prefix exists because the DS's `accent`/`muted` mean something else in shadcn.
  Brand blue is exposed as `brand` / `brand-strong`.
- **shadcn/ui** primitives live in `src/features/shared/components/ui/`, with
  `cn()` in `src/features/shared/utils/cn.ts`. DS styling is baked into their
  variants: pill buttons, `rounded-card` 24px, `rounded-input` 16px, `rounded-hero` 36px.
- **Light only:** `useTheme`, `usePalette`, `themeColor`, ThemeToggle and the
  FOUC script are deleted. A dark theme can return later as a `:root.dark` block
  over the same semantic vars.
- **Blur everywhere**, as the DS specifies, with an `@supports` fallback.
  Performance on iOS/Android is checked in device QA. The pre-agreed mitigation
  is to drop the blur only on grid cards.
- **PWA chrome** is `#eef6ff`. On iOS the status bar changes from
  `black-translucent` to `default`, because white status text was illegible on the
  pale bar. iOS reads it only at install time, so existing installs must be
  re-added to the home screen.
- **The overlays move to Radix:** NavDrawer → Sheet, AvatarMenu → DropdownMenu,
  SnapshotLightbox → Dialog. Their behavioural contracts are kept.
- **Native `<select>` and range inputs stay native**, because the native pickers
  are the best UX on mobile.

## Alternatives

- Tokens only, or Tailwind only without shadcn: rejected by the owner.
- Keeping the mode toggle but hiding it: it would leave dead code.
- Blur only on chrome: offered for performance; the owner chose full fidelity.
- Restyling the overlays now and swapping to Radix later: the owner chose to swap
  now. The risk is that the lightbox gestures conflict with Radix's scroll lock,
  so that task has an explicit escalation rule.

## Implementation notes and deviations

- shadcn CLI could not reach ui.shadcn.com from the cloud container; primitives were hand-written in new-york style on the unified `radix-ui` package.
- Base/element CSS must be layered: unlayered `a { color }` beat Tailwind utilities and blanked `<Button asChild><a>` labels; element rules moved to `@layer base`, kept component classes (`.event-card`, `.nav-link`, …) to `@layer components`.
- AvatarMenu sign-out keeps its `fetch(POST)` + redirect inside a real `<form method=post>`; the admin indicator stays the compact "A" badge (`Badge tone=accent dot={false}`).
- SnapshotLightbox: `useImageGestures` moved into a child rendered inside `DialogContent` (Radix portals mount content a commit later, so the hook saw a null ref); focus is restored manually on close because the dialog is parent-controlled (no `Dialog.Trigger`). Radix's RemoveScroll sets `allowPinchZoom` and the image's own non-passive handlers run first, so gestures are not cancelled — confirm on device.
- `dialog.tsx` gained `variant="bare"`; `sheet.tsx` `SheetContent` gained `overlayProps`.
- The event detail page has no single primary Button: downloads are whole InfoCard tiles. Mobile edge-to-edge layout kept (`sm:glass`).
- Native `<select>` / range inputs restyled, not replaced; switches are shadcn `Switch`.
- knip: `ignoreIssues` for `src/features/shared/components/ui/**` exports/types (library API surface); `tw-animate-css` stays in `ignoreDependencies` (imported from CSS only).
- Overlay dim is 40% ink (`bg-(--gl-fg)/40`), not the spec's 30%.

## Why it matters

- Anyone styling UI uses semantic utilities (`bg-card`, `text-fg-2`, `glass`,
  `eyebrow`) or shadcn primitives. Raw hex values and `[var(--…)]` are out.
- A grep-guard test forbids the legacy token names, so the old palette can't
  creep back in.
- Any future dark mode belongs in the semantic layer, not the primitives.

Related: [[decisions/2026-04-17-cross-platform-pwa-first]],
[[decisions/2026-04-15-feature-sliced-architecture]].
