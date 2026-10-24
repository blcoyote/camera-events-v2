# Glassmorphism

Frosted, translucent layers floating over a cool, pale-blue backdrop — calm, airy and legible.

This system is built from the open-source **Open Design "Glassmorphism" design system**:

- Guide: <https://open-design.ai/plugins/design-system-glassmorphism/>
- Source repository (free, open source): <https://github.com/nexu-io/open-design> — folder `plugins/_official/design-systems/glassmorphism`
- Releases: <https://github.com/nexu-io/open-design/releases>
- License: the Open Design project is published under **Apache-2.0** (© 2026 Powerformer, Inc.). The plugin page doesn't state a separate license for this design system, so treat it as covered by the repository's license and keep the attribution.

Values come from the guide's **token contract** (the `--bg`, `--surface`, `--accent` … set). The guide's DESIGN.md body lists a second, conflicting palette (Primary `#1856FF`, Plus Jakarta Sans); from it we kept only `#1856FF` as **accent-strong**, because it is the accessible version of the brand blue. Anything not in the source is labelled _added_ in its token note.

## Content fundamentals

- Hierarchy is always **headline → support text → one primary action**.
- Headlines may be expressive; UI labels stay literal ("Save changes", not "Let's go!").
- Sentence case everywhere. Short sentences. No exclamation marks in UI.
- Separate content with whitespace first; reach for borders and shadows only after.

## Visual foundations

### The glass pane

Every container is a pane of frosted glass:

```css
.pane {
  background: var(--surface);
  backdrop-filter: blur(var(--blur-glass)) saturate(140%);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--elev-raised);
}
```

- Panes sit on **bg** (`#eef6ff`). The blur only reads if something is behind it — give hero areas soft **accent** shapes in the backdrop, never photos with busy detail.
- Nest at most **two** levels: `surface` → `surface-warm` with `border-soft` and `elev-flat`.
- The 1px white `border` is the signature: it is the edge of the glass catching light. Never replace it with a grey border.
- Elevation is a soft **blue-tinted** glow (`elev-raised`), never a grey drop shadow.

### Colour

- **fg / fg-2 / muted** carry all text. `muted` is the lightest text grey allowed.
- **accent** `#4f8cff` is the brand blue for focus, selection, icons and big display accents. It is too light for small text or for white-on-blue labels (3.2:1).
- **accent-strong** `#1856ff` fills primary buttons and colours small accent text.
- **success / warn / danger** are for icons, dots and fills; their `*-text` partners (added) are for words.
- Don't introduce off-palette colours when a token can solve the problem.

### Type

Inter for display and body, SF Mono for code (Google Fonts serves Inter). Display sizes use **leading-tight 1.04** and **tracking −0.025em**; text uses **leading 1.55**. Never use one size and weight for everything — the scale is 12 / 14 / 16 / 18 / 24 / 36 / 54 / 76.

### Shape & space

Radii are generous and soft: **16** inputs, **24** cards, **36** hero panes, **pill** for buttons and badges. Spacing runs on a 4px base (4 → 48), sections breathe with 104 / 72 / 52px vertical padding (desktop / tablet / phone), content maxes at 1180px with 36 / 24 / 16px gutters.

### Motion

Hover and press: `motion-fast` 180ms. Panels and dialogs: `motion-base` 280ms. One curve: `ease-standard` `cubic-bezier(0.22, 1, 0.36, 1)`. Respect `prefers-reduced-motion`.

### States

Hover, focus-visible, active, disabled and loading are always explicit. Focus is `focus-ring` (4px soft blue halo) on every interactive element.

### Accessibility

- Text contrast ≥ 4.5:1 against the pane **and** the worst-case backdrop showing through it. If the backdrop gets busy, raise pane opacity or switch to `blur-glass-strong`.
- Provide a fallback where `backdrop-filter` is unsupported: raise `surface` to near-opaque white.

## Iconography

The source specifies no icon set. Use a single-weight outline set at 1.5–2px stroke (e.g. Lucide, ISC license), coloured `fg-2`, or `accent` when active.

## Do / don't

- **Do** use whitespace before borders or shadows.
- **Do** keep one primary action per view.
- **Don't** add decorative effects that reduce readability.
- **Don't** mix unrelated visual metaphors (no neumorphism or skeuomorphic textures next to glass).
- **Don't** stack more than two translucent layers — contrast collapses.

## Components

`Button`, `GlassCard`, `Input`, `Badge` — React components on `window.Glass`, styled by `components/bundle.css` with only tokens. Plain HTML can use the same classes (`gl-btn gl-btn--primary`, `gl-card`, `gl-field`, `gl-badge`).
