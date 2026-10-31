---
name: Camera Events
description: Frosted glass panes over a cool sky backdrop, a calm household window onto the home cameras.
colors:
  sky-glass: '#4f8cff'
  sky-glass-hover: '#467de4'
  cobalt: '#1856ff'
  cobalt-hover: '#1448e0'
  on-cobalt: '#ffffff'
  morning-haze: '#eef6ff'
  glass-pane: 'rgba(255, 255, 255, 0.74)'
  glass-pane-warm: 'rgba(238, 246, 255, 0.72)'
  glass-pane-lit: 'rgba(255, 255, 255, 0.9)'
  glass-pane-solid: 'rgba(255, 255, 255, 0.94)'
  glass-edge: 'rgba(255, 255, 255, 0.64)'
  glass-edge-soft: 'rgba(255, 255, 255, 0.38)'
  harbour-ink: '#102033'
  slate-ink: '#34465f'
  dusk-grey: '#60708a'
  porch-green: '#22c55e'
  porch-green-text: '#15803d'
  lamp-amber: '#f59e0b'
  lamp-amber-text: '#b45309'
  alarm-red: '#ef4444'
  alarm-red-text: '#c81e3a'
  alarm-red-fill: '#c81e3a'
  dim-overlay: 'rgba(16, 32, 51, 0.4)'
  control-edge: 'rgba(255, 255, 255, 0.64)'
  control-well: 'rgba(238, 246, 255, 0.72)'
  thumb-pearl: '#ffffff'
typography:
  display:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '2.25rem'
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.4
  eyebrow:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.04em'
  mono:
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace"
    fontSize: '0.9em'
rounded:
  input: '16px'
  card: '24px'
  hero: '36px'
  pill: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '12': '48px'
components:
  button-primary:
    backgroundColor: '{colors.cobalt}'
    textColor: '{colors.on-cobalt}'
    rounded: '{rounded.pill}'
    padding: '12px 20px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.cobalt-hover}'
  button-secondary:
    backgroundColor: '{colors.glass-pane}'
    textColor: '{colors.harbour-ink}'
    rounded: '{rounded.pill}'
    padding: '12px 20px'
    height: '44px'
  button-secondary-hover:
    backgroundColor: '{colors.glass-pane-lit}'
  button-ghost:
    textColor: '{colors.cobalt}'
    rounded: '{rounded.pill}'
    padding: '12px 20px'
    height: '44px'
  button-ghost-hover:
    backgroundColor: '{colors.glass-pane-warm}'
  button-destructive:
    backgroundColor: '{colors.alarm-red-fill}'
    textColor: '{colors.on-cobalt}'
    rounded: '{rounded.pill}'
    padding: '12px 20px'
    height: '44px'
  input:
    backgroundColor: '{colors.glass-pane-warm}'
    textColor: '{colors.harbour-ink}'
    rounded: '{rounded.input}'
    padding: '12px 16px'
    height: '44px'
  card:
    backgroundColor: '{colors.glass-pane}'
    textColor: '{colors.harbour-ink}'
    rounded: '{rounded.card}'
    padding: '24px'
  card-flat:
    backgroundColor: '{colors.glass-pane-warm}'
    rounded: '{rounded.input}'
    padding: '16px'
  card-hero:
    backgroundColor: '{colors.glass-pane}'
    rounded: '{rounded.hero}'
    padding: '32px'
  badge:
    backgroundColor: '{colors.glass-pane}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.eyebrow}'
    rounded: '{rounded.pill}'
    padding: '6px 10px'
  filter-pill:
    backgroundColor: '{colors.glass-pane}'
    textColor: '{colors.harbour-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '8px 16px'
    height: '44px'
  filter-pill-active:
    backgroundColor: '{colors.cobalt}'
    textColor: '{colors.on-cobalt}'
  switch:
    backgroundColor: '{colors.glass-pane-warm}'
    rounded: '{rounded.pill}'
    width: '48px'
    height: '28px'
  switch-checked:
    backgroundColor: '{colors.cobalt}'
---

# Design System: Camera Events

## Overview

**Creative North Star: "The Frosted Porch Light"**

Camera Events is the home's own glass, lit softly from behind. It should feel domestic and reassuring, never like a security console. Every surface is a frosted pane floating over a cool sky backdrop. Two blurred blue light pools sit behind the panes, so the blur always has something to catch, and each pane catches the light along a 1px white edge. When nothing is happening the app is calm and airy, and the camera footage is the only vivid thing on screen.

The system follows the open-source Open Design "Glassmorphism" system (`docs/design-system/glassmorphism/`, Apache-2.0) and adds its own dark theme. The light theme is a pale morning sky. The dark theme is night mode, the same porch at night: deep navy, not black, with dimmed light pools, pale-blue accent text, a deeper and less luminous cobalt, pearl rather than white thumbs, and an opaque header over footage, so opening an alert at 3 a.m. doesn't glare. Camera footage is never dimmed or filtered in either theme; it is evidence. Density is moderate, with generous radii, a 44px minimum touch target and whitespace before borders.

Components are light and tactile, glass you can press. Cards lift on hover, buttons drop 1px on press, and focus shows as a soft blue halo instead of an outline. Motion is quick and uses a single curve.

**Key Characteristics:**

- Translucent panes with backdrop blur and saturate(140%), always edged with a white hairline.
- A blue-tinted glow for elevation, never a grey drop shadow.
- One sans family (Inter) with tight display tracking and relaxed body leading.
- Pill-shaped actions, 24px cards and 16px inputs.
- Light and dark are equal citizens. Dark is a full token override, not a filter.

## Colors

A cool, low-saturation sky palette with one confident blue for action and three status hues kept for meaning.

### Primary

- **Cobalt** (`cobalt`): the action colour. It fills primary buttons, the active filter pill and a checked switch, and it colours small accent text and links, where it passes AA. In dark mode, accent text lightens to a pale cobalt (`#8ab4ff`, hover `#a9c7ff`), and the fill deepens to a night cobalt (`#2b55c9`, hover `#345fd8`; white text 6.5:1) so the brightest UI on a dark screen is not a saturated blue slab.
- **Sky Glass** (`sky-glass`): the ambient brand blue. Use it for the focus halo, selection, nav underlines, active icons, the backdrop light pools and large display accents. It is too light for small text or for white-on-blue labels (3.2:1).

### Neutral

- **Morning Haze** (`morning-haze`): the page backdrop under all glass. Dark: `#0b1424` deep navy.
- **Glass Pane** (`glass-pane`): the default pane surface for cards, the header, badges and secondary buttons. Dark: `rgba(22, 34, 58, 0.62)`.
- **Warm Glass** (`glass-pane-warm`): nested or flat surfaces such as flat cards and ghost hover. Dark: `rgba(18, 30, 52, 0.55)`.
- **Control Edge** (`control-edge`): the boundary of every input, select, filter pill, switch and slider rail. Light it matches Glass Edge; dark it is white at 38% (3.4:1 against a card), because the 10% glass hairline disappears at night.
- **Control Well** (`control-well`): the fill of inputs, selects and switch tracks. Light it matches Warm Glass; dark it is a recessed `rgba(5, 10, 20, 0.55)` well.
- **Thumb Pearl** (`thumb-pearl`): switch and slider thumbs. White in light; dark `#c5d3ea`, bright enough to read (11:1) without the glare of pure white.
- **Lit Glass** (`glass-pane-lit`): hover state for panes, popovers and strong glass.
- **Solid Glass** (`glass-pane-solid`): the fallback surface when `backdrop-filter` is unsupported.
- **Glass Edge / Soft Edge** (`glass-edge`, `glass-edge-soft`): the white hairline on every pane, and the softer one on nested panes. Dark: white at 10% and 6% alpha.
- **Harbour Ink** (`harbour-ink`): primary text. Dark: `#e6eefc`.
- **Slate Ink** (`slate-ink`): secondary text, nav links and descriptions. Dark: `#b6c4dc`.
- **Dusk Grey** (`dusk-grey`): muted metadata and placeholders, the lightest text allowed. Dark: `#8c9dba`.
- **Dim Overlay** (`dim-overlay`): the scrim behind dialogs and sheets.

### Status

- **Porch Green / Lamp Amber / Alarm Red** (`porch-green`, `lamp-amber`, `alarm-red`): for dots, icons and fills only. Online, warning and offline or live.
- **Their `-text` partners** carry words in each status colour. Dark: `#4ade80`, `#fbbf24`, `#fb7185`. **Alarm Red Fill** (`alarm-red-fill`) is the destructive button. Dark: `#dc2626`.

### Named Rules

**The Fill-Versus-Text Rule.** Fills and text never share a token. A status or accent colour has a fill token and a separate `-text` or `-strong` token, and each one gets a dark value.

**The Night Boundary Rule.** In dark mode every control boundary and focus indicator reaches 3:1 against what is behind it (WCAG 1.4.11). Controls use Control Edge and Control Well, never the glass hairline alone.

**The No Raw Colour Rule.** Use only semantic utilities (`bg-card`, `text-fg-2`, `text-brand-strong`, `bg-success`, ...). Raw hex, Tailwind scale colours (`red-500`) and `dark:` variants are banned and are enforced by `src/styles.legacy-tokens.test.ts`. The one exception is chips that sit on top of camera footage (see Components).

## Typography

**Display Font:** Inter (with system-ui, sans-serif)
**Body Font:** Inter
**Mono Font:** SF Mono (with ui-monospace, Menlo)

**Character:** A single humanist sans throughout. Display sizes tighten up (1.04 leading, −0.025em tracking) to read as confident headings, and body text loosens to 1.55 for easy scanning on a phone.

### Hierarchy

- **Display** (600, 2.25rem, 1.04): page titles such as Cameras, Favorites and Settings.
- **Headline** (600, 1.875rem, 1.04): section and detail-view headings.
- **Title** (600, 1.5rem): card titles.
- **Body** (400, 1rem, 1.55): descriptions and settings copy. Secondary text uses Slate Ink.
- **Label** (600, 0.875rem): nav links, filter pills, buttons in compact areas and event-card camera names. This is the most-used size in the app.
- **Eyebrow** (500, 0.75rem, 0.04em, uppercase, Cobalt): small section labels above titles. Timestamps and counts use 0.75rem in Dusk Grey without the uppercase.

The upstream scale is 12 / 14 / 16 / 18 / 24 / 36 / 54 / 76. The app uses up to 36 in practice.

### Named Rules

**The Literal Label Rule.** Use sentence case and short sentences, with no exclamation marks in the UI. Labels say exactly what happens ("Save changes", "Download clip").

## Layout

- **Container:** `.page-wrap` is centred, with a maximum width of 1180px and side gutters of 16px on phones, 24px from 640px and 36px from 1024px.
- **Spacing:** on a 4px base. Card padding is 24px (raised), 16px (flat) or 32px (hero), and stacks use gaps of 8 to 16px.
- **Touch targets:** every interactive element is at least 44px (`min-h-11` / `size-11`). Even the small button and toggle sizes keep 44px. The switch extends its hit area with an 8px invisible inset.
- **Responsive:** phone-first. The header nav collapses into a drawer below 640px, and event grids gain columns as the width grows.
- **Safe areas:** the sticky header pads `env(safe-area-inset-top)`, and the body and bottom toasts pad `env(safe-area-inset-bottom)` for the iOS standalone app.
- **Scroll:** `overscroll-behavior-y: none` on `html`, so only the app's own pull-to-refresh gesture runs.

## Elevation & Depth

Depth comes from translucency first, then a soft, blue-tinted glow. Panes blur and saturate what's behind them. The fixed backdrop provides two radial light pools (Sky Glass at the top left and Cobalt at the bottom right) so the blur always has colour to catch. In dark mode the glow becomes a deeper black shadow and the light pools drop to about half their alpha.

### Shadow Vocabulary

- **Raised** (`0 24px 80px rgba(79, 140, 255, 0.18)`): the default for glass panes, cards, the header and primary buttons. Dark: `0 24px 80px rgba(0, 0, 0, 0.45)`.
- **Raised hover** (`0 28px 88px rgba(79, 140, 255, 0.26)`): when an event card lifts.
- **Focus ring** (`0 0 0 4px rgba(79, 140, 255, 0.28)`): a 4px halo on every focusable element, used instead of an outline. Dark: a solid 2px `#8ab4ff` ring plus a 6px `rgba(138, 180, 255, 0.35)` halo (`0 0 0 2px #8ab4ff, 0 0 0 6px rgba(138, 180, 255, 0.35)`), 8:1 against a card; the halo alone measured 2.7:1.

### Named Rules

**The Two-Layer Rule.** Nest glass at most two levels deep: a pane, then a warm pane with the soft edge and no shadow. A third translucent layer makes contrast collapse.

**The Glow-Not-Grey Rule.** Elevation in the light theme is a blue-tinted glow. Never use a neutral grey drop shadow.

## Shapes

The shapes are soft and generous. Inputs and flat cards have gently curved 16px corners, raised cards and event cards have 24px corners, and hero panes have 36px corners. Every action (buttons, filter pills, badges, switches and the avatar) is a full pill or circle. Panes always have a 1px white hairline border that catches the light, and it is never a grey border. Media inside cards is clipped to the card's radius.

## Components

### Buttons

Light and tactile pills.

- **Shape:** full pill, at least 44px tall, with 12px × 20px padding (16px horizontal at the small size).
- **Primary:** Cobalt fill, white Inter 500 text and the Raised glow. Hover darkens to Cobalt hover.
- **Secondary / Outline:** a glass pane with no shadow. Hover brightens it to Lit Glass.
- **Ghost:** Cobalt text with no fill. Hover adds a Warm Glass wash.
- **Destructive:** Alarm Red Fill with white text.
- **States:** 180ms transitions on the standard curve, `translate-y-px` on press, the focus halo, and 50% opacity when disabled. When loading, a small spinner sits beside the label and `aria-busy` is set.

### Filter pills (Toggle)

- **Style:** glass pill, 44px tall, Label type. The optional count is in Dusk Grey when the pill is off.
- **State:** when on, it fills with Cobalt and white text and the border becomes transparent. On hover it brightens and lifts 2px.

### Badges

- **Style:** glass pill in Eyebrow-sized 500 text, with a 6px leading dot. The tone sets the text colour (`-text` token) and the dot colour (fill token): neutral, accent, success, warn or danger.

### Cards / Containers

- **Raised:** Glass Pane, 24px radius, 24px padding, Raised glow and 16px internal gap.
- **Flat:** Warm Glass, 16px radius, 16px padding, soft edge and no shadow. Use it for nesting inside a raised card.
- **Hero:** Glass Pane, 36px radius and 32px padding.
- **Fallback:** without `backdrop-filter` support, every glass surface becomes Solid Glass.

### Inputs / Fields

- **Style:** Control Well fill, a Control Edge border, 16px radius, 12px × 16px padding, at least 44px tall, and body-size text so iOS doesn't zoom.
- **Focus:** the border turns Sky Glass and the focus halo appears.
- **Error / Disabled:** `aria-invalid` turns the border Alarm Red. Disabled fields drop to 55% opacity with a not-allowed cursor.

### Switch

- **Style:** a 48 × 28px pill track in Control Well with a Control Edge border and a 20px Thumb Pearl thumb that carries the Raised glow. When checked, the track fills with Cobalt, keeps its Control Edge border, and the thumb slides 24px.

### Navigation

- **Header:** a sticky glass pane. Light it is more transparent (50%) so content scrolling underneath shows through; dark it is 80% opaque, because bright footage scrolling under a 42% header dropped nav text to 1.45:1. It pads for the top safe area.
- **Links:** Label type in Slate Ink. Hover and active states turn the text Harbour Ink and grow a 2px Sky Glass underline from the left over 180ms.
- **Mobile:** below 640px, a 44px icon button opens a side sheet (NavDrawer) with the links stacked.

### Event Card (signature)

The app's defining surface: camera footage framed in glass.

- **Frame:** a raised glass card (24px radius, Raised glow, hairline edge) that lifts 3px on hover and gains the stronger glow.
- **Thumbnail:** clipped to the card, with a faint scan-line overlay (3.5% black lines every 4px) that fades from 60% to 30% on hover. It's a quiet nod to camera footage.
- **Media chips:** chips over footage, such as the label, the score and a video icon, use translucent black (50%) or white (20%) pills with a small blur and white text. This is the only sanctioned raw-colour use, because the background is uncontrolled video.
- **Live indicator:** an Alarm Red dot with a soft ring that pulses over 2s (`live-pulse`).
- **Meta row:** camera name in Label type and the timestamp in 0.75rem Dusk Grey.
- **Entrance:** cards rise 18px and scale from 0.97 over 520ms, staggered 45ms per card.

### Motion

- **Hover and press:** 180ms. Panels, dialogs and toasts: 280ms. One curve for all of them: `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Loading:** skeletons shimmer between Glass Pane and Lit Glass over 1.6s.
- **Reduced motion:** `prefers-reduced-motion` collapses all animations and transitions.

## Do's and Don'ts

### Do:

- **Do** put every surface on a glass utility (`glass`, `glass-flat`, `glass-strong`, `glass-header`) so the blur, the edge and the fallback come together.
- **Do** keep text contrast at least 4.5:1 against the pane and the worst-case backdrop behind it. If it gets busy, raise opacity or switch to `glass-strong`.
- **Do** give every new colour primitive a `:root.dark` value, and split fill and text tokens.
- **Do** keep interactive targets at least 44px and show the focus halo on all of them.
- **Do** keep one primary (Cobalt) action per view.
- **Do** put element rules in `@layer base` and component classes in `@layer components`.

### Don't:

- **Don't** replace the white hairline edge with a grey border, or the blue glow with a grey shadow.
- **Don't** stack more than two translucent layers.
- **Don't** use Sky Glass for small text or white-on-blue labels. Use Cobalt.
- **Don't** use raw hex, Tailwind scale colours or `dark:` variants (except chips over footage).
- **Don't** add unlayered CSS to `src/styles.css`, because it overrides every utility.
- **Don't** mix in other visual metaphors such as neumorphism or skeuomorphic textures, or put busy photos behind glass.
