# Plan: Mobile Event Detail Redesign

**Spec:** `docs/specs/mobile-event-detail-redesign.md`
**Branch:** `feat/mobile-event-detail`
**Status:** pending

## Steps

### 1. Create `SnapshotLightbox` component

**File:** `src/features/camera-events/components/SnapshotLightbox.tsx`
**Complexity:** high

Build the fullscreen lightbox with:

- Fixed overlay with dark backdrop
- Centered snapshot image with CSS transform-based zoom/pan
- Touch gesture handling: pinch-to-zoom (1x–4x), pan when zoomed, double-tap toggle (1x ↔ 2x)
- Mouse support: wheel zoom, click-drag pan
- Swipe-down dismiss at 1x
- Close button (X) with accessible label
- Escape key handler
- Focus trap (cycle Tab within lightbox)
- Body scroll lock (add/remove `overflow: hidden` on body in useEffect)
- `role="dialog"`, `aria-modal="true"`
- `touch-action: none` on image container
- Returns `null` when closed

### 2. Update `EventSnapshot` to support tap-to-open

**File:** `src/features/camera-events/components/CameraEventDetailPage.tsx`
**Complexity:** low

- Add `onClick` prop to `EventSnapshot`
- Wrap image in a `<button>` with `cursor-zoom-in` and accessible label
- Add a subtle zoom icon hint (magnifying glass SVG) in the corner of the image

### 3. Integrate lightbox into `CameraEventDetailPage`

**File:** `src/features/camera-events/components/CameraEventDetailPage.tsx`
**Complexity:** low

- Add `lightboxOpen` state
- Pass `onClick` to `EventSnapshot` to open lightbox
- Render `<SnapshotLightbox>` with appropriate props

### 4. Make layout responsive — remove card on mobile

**File:** `src/features/camera-events/components/CameraEventDetailPage.tsx`
**Complexity:** medium

Restructure the success-state JSX:

- **Outer section:** Remove `island-shell` base styles, add them back via `sm:` prefix (e.g., `sm:island-shell` or conditional classes). Since `island-shell` is a custom CSS class, use a wrapper `<div>` approach: render the card wrapper only at `sm:` using `hidden sm:block` pattern, or restructure so mobile content flows without the card and desktop wraps it.
- **EventSnapshot:** Remove `rounded-2xl border` wrapper on mobile, keep on desktop
- **InfoCard:** On mobile, render without `rounded-xl border bg-(--surface)` — just label/value with a subtle divider. On desktop, keep current card styling.
- **Confidence bar:** Remove card wrapper on mobile, keep on desktop
- Use Tailwind `sm:` breakpoint consistently for the split

### 5. Write unit tests for `SnapshotLightbox`

**File:** `src/features/camera-events/components/SnapshotLightbox.test.tsx`
**Complexity:** medium

Test the pure logic and render states:

- Returns `null` when `open` is `false`
- Returns a dialog element when `open` is `true`
- Calls `onClose` handler (verify the callback is wired)

### 6. Update Storybook stories

**File:** `src/features/camera-events/components/CameraEventDetailPage.stories.tsx`
**Complexity:** low

- Verify existing stories render correctly with the responsive layout
- Add a mobile viewport story using Storybook viewport addon
- Add a story showing the lightbox open state if feasible

### 7. Verify build and existing tests

**Complexity:** low

- Run `pnpm check` (typecheck)
- Run `pnpm vitest run --project unit`
- Verify no regressions

## Pre-PR Quality Gate

- [ ] `pnpm check` passes
- [ ] `pnpm vitest run --project unit` passes (new + existing tests)
- [ ] Desktop layout visually unchanged (verify in browser at sm+ width)
- [ ] Mobile layout shows full-width content without card wrapper
- [ ] Lightbox opens on tap/click, supports pinch-zoom, pan, double-tap
- [ ] Lightbox closes via X button, Escape, swipe-down, browser back
- [ ] Tested on iOS Safari (standalone + browser), Android Chrome, desktop Chrome
- [ ] No new npm dependencies added
- [ ] No hydration mismatches in dev or build

## Risks & Open Questions

1. **`island-shell` is a CSS class, not a Tailwind utility** — cannot simply prefix with `sm:`. May need to restructure the HTML so mobile omits the class and desktop applies it via a wrapper or conditional approach.
2. **Touch gesture complexity** — pinch-to-zoom with proper inertia and boundary clamping is non-trivial. The initial implementation should prioritize correctness (pinch works, pan works, boundaries respected) over polish (smooth inertia, spring physics).
3. **iOS Safari standalone body scroll lock** — `overflow: hidden` on body may not fully prevent background scrolling in iOS standalone mode. May need `position: fixed` + `top` offset trick. Flag as a cross-platform issue if encountered during testing.
