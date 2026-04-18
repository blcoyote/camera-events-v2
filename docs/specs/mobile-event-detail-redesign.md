# Spec: Mobile Event Detail Redesign

## Intent Description

On mobile devices, the event detail page currently wraps all content (snapshot image, metadata cards, confidence bar) inside an `island-shell` card container. This makes the snapshot image small and difficult to inspect on narrow screens. Users should be able to zoom into the snapshot image to see detection details clearly.

The redesign removes the card container on mobile, presenting content in a full-width edge-to-edge layout. The snapshot image becomes tappable, opening a fullscreen lightbox with pinch-to-zoom and pan support. On desktop (sm+ breakpoint), the existing card layout is preserved unchanged.

## Cross-Platform Considerations

### Pinch-to-zoom gesture handling

The lightbox must support pinch-to-zoom and pan gestures natively across:

- **iOS Safari (standalone + in-browser):** Touch events work consistently. `touch-action: none` on the image container is needed to prevent the browser from intercepting gestures.
- **Android Chrome:** Same touch event model. `touch-action: none` prevents the browser from handling pinch-to-zoom at the page level.
- **Desktop:** Mouse wheel zoom and click-drag pan as fallbacks for non-touch devices.

### No new dependencies

The pinch-to-zoom will be implemented using native touch events (`touchstart`, `touchmove`, `touchend`) and pointer events for mouse support. No external gesture or lightbox libraries will be added.

### SSR safety

The lightbox is client-only UI (opens on tap). Initial render produces no lightbox DOM — it's triggered by state change in an event handler, so there's no SSR/hydration concern. The component renders null until opened.

## User-Facing Behavior

```gherkin
Feature: Mobile Event Detail Redesign

  # --- Mobile layout ---

  Scenario: Full-width layout on mobile
    Given the user is viewing an event detail page on a mobile device (< 640px)
    Then the snapshot image spans the full width with no card border or padding
    And the metadata items (camera, duration, zones, clip, snapshot) are displayed without card borders
    And the confidence bar is displayed without a card border

  Scenario: Card layout preserved on desktop
    Given the user is viewing an event detail page on a screen >= 640px
    Then the existing island-shell card container is displayed
    And the metadata info cards have their rounded borders and background
    And the layout is unchanged from the current design

  # --- Snapshot zoom ---

  Scenario: Tap snapshot to open lightbox on mobile
    Given the user is on a mobile device viewing an event with a snapshot
    When the user taps the snapshot image
    Then a fullscreen lightbox overlay opens
    And the snapshot image is displayed at full resolution
    And the lightbox has a close button

  Scenario: Pinch-to-zoom in lightbox
    Given the lightbox is open with a snapshot image
    When the user performs a pinch-to-zoom gesture
    Then the image zooms in/out following the gesture
    And the minimum zoom is 1x (fit-to-screen)
    And the maximum zoom is 4x

  Scenario: Pan zoomed image
    Given the lightbox is open and the image is zoomed in beyond 1x
    When the user drags the image
    Then the image pans to follow the drag
    And the image cannot be panned beyond its boundaries

  Scenario: Double-tap to zoom
    Given the lightbox is open
    When the user double-taps the image
    Then the image toggles between 1x and 2x zoom at the tap location

  Scenario: Close lightbox
    Given the lightbox is open
    When the user taps the close button
    Then the lightbox closes and returns to the detail page
    When the user swipes down on the image at 1x zoom
    Then the lightbox closes

  Scenario: Lightbox respects back gesture / Escape
    Given the lightbox is open
    When the user presses the Escape key or browser back
    Then the lightbox closes without navigating away from the page

  # --- Desktop zoom ---

  Scenario: Click snapshot to open lightbox on desktop
    Given the user is on a desktop browser viewing an event with a snapshot
    When the user clicks the snapshot image
    Then a fullscreen lightbox overlay opens
    And the user can zoom with mouse wheel
    And the user can pan by click-dragging when zoomed

  # --- Accessibility ---

  Scenario: Lightbox traps focus
    Given the lightbox is open
    Then focus is trapped within the lightbox
    And the close button is focusable
    And pressing Escape closes the lightbox

  Scenario: Screen reader announces lightbox
    Given the lightbox is open
    Then the lightbox has role="dialog" and aria-modal="true"
    And the image has appropriate alt text
    And the close button has an accessible label
```

## Architecture Specification

### Mobile layout changes

**File:** `src/features/camera-events/components/CameraEventDetailPage.tsx`

The `CameraEventDetailPage` component's success-state render will be restructured:

**Mobile (< sm / < 640px):**

- Remove the outer `island-shell` card wrapper — content flows edge-to-edge within the `page-wrap` container
- The `EventSnapshot` image gets no `rounded-2xl border` wrapper — it renders full-width with minimal margin
- The `InfoCard` components render without borders/backgrounds — just stacked label/value pairs with dividers
- The confidence bar renders without its card wrapper

**Desktop (sm+):**

- The existing `island-shell` section wraps all content as it does today
- `InfoCard` components keep their `rounded-xl border bg-(--surface)` styling
- No visual change from current behavior

The responsive split uses Tailwind's `sm:` breakpoint prefix. The mobile layout is the base, desktop styles are applied at `sm:`.

### Component: `SnapshotLightbox`

**Location:** `src/features/camera-events/components/SnapshotLightbox.tsx`

A fullscreen overlay component for viewing and zooming the snapshot image.

**Props:**

```typescript
interface SnapshotLightboxProps {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}
```

**Behavior:**

- Renders a fixed-position overlay covering the viewport with a dark backdrop
- Displays the snapshot image centered and fit-to-screen at 1x
- Supports pinch-to-zoom (1x–4x) using touch events
- Supports pan when zoomed beyond 1x
- Supports double-tap to toggle between 1x and 2x at the tap point
- Supports mouse wheel zoom and click-drag pan on desktop
- Close button (X) in top-right corner, always visible
- Swipe-down at 1x zoom dismisses the lightbox
- Escape key closes the lightbox
- Focus is trapped inside the lightbox while open
- `role="dialog"` and `aria-modal="true"` for accessibility
- Body scroll is locked while open (`overflow: hidden` on body)
- Returns `null` when `open` is `false`

**Gesture implementation:**

- Track touch state: `scale`, `translateX`, `translateY`, `lastDistance` (between two fingers)
- On pinch: compute distance between two touch points, derive scale delta, update transform
- On pan (single finger when zoomed): update translate values, clamp to image bounds
- On double-tap: if at 1x, animate to 2x centered on tap point; if zoomed, animate back to 1x
- All transforms applied via CSS `transform: scale(${scale}) translate(${tx}px, ${ty}px)` for GPU acceleration
- Use `will-change: transform` on the image element

**SSR safety:** The component returns `null` when `!open`. No browser globals are read during render. Touch/pointer listeners are attached in `useEffect` only when `open` is true.

### Changes to `EventSnapshot`

The existing `EventSnapshot` component (currently a private function in `CameraEventDetailPage.tsx`) will be updated to:

- Accept an `onClick` handler
- Render a `<button>` wrapper (for accessibility) that opens the lightbox
- Show a subtle zoom icon overlay on the image to hint at tap-to-zoom

### Integration

In `CameraEventDetailPage`, add state for lightbox:

```typescript
const [lightboxOpen, setLightboxOpen] = useState(false)
```

Pass `onClick={() => setLightboxOpen(true)}` to `EventSnapshot`. Render `<SnapshotLightbox>` with `open={lightboxOpen}` and `onClose={() => setLightboxOpen(false)}`.

### Dependencies

No new npm packages. The implementation uses:

- Native `TouchEvent` and `PointerEvent` APIs for gesture handling
- CSS transforms for zoom/pan rendering
- `useEffect` for event listener management and body scroll lock

### Constraints

- SSR/hydration safe: lightbox renders nothing until opened client-side
- No new npm dependencies
- Desktop layout (sm+) must not change visually
- All interactive elements must be keyboard accessible
- Lightbox must support iOS Safari standalone, iOS Safari browser, Android Chrome, and desktop browsers
- `touch-action: none` must be scoped to the lightbox image only (not leak to the rest of the page)

## Acceptance Criteria

| #     | Criterion                 | Pass Condition                                                                                      |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| AC-1  | Mobile full-width layout  | On screens < 640px, event detail content has no island-shell card wrapper; snapshot is edge-to-edge |
| AC-2  | Mobile cardless metadata  | InfoCard items on mobile render as simple label/value rows without card borders                     |
| AC-3  | Desktop layout unchanged  | On screens >= 640px, island-shell card and InfoCard styling is identical to current                 |
| AC-4  | Tap opens lightbox        | Tapping the snapshot on mobile opens a fullscreen lightbox overlay                                  |
| AC-5  | Click opens lightbox      | Clicking the snapshot on desktop opens the lightbox                                                 |
| AC-6  | Pinch-to-zoom works       | Two-finger pinch gesture zooms the image between 1x and 4x on iOS Safari and Android Chrome         |
| AC-7  | Pan when zoomed           | Single-finger drag pans the zoomed image within bounds                                              |
| AC-8  | Double-tap zoom           | Double-tap toggles between 1x and 2x zoom                                                           |
| AC-9  | Mouse wheel zoom          | Mouse wheel zooms the image on desktop                                                              |
| AC-10 | Close via button          | Tapping/clicking the X button closes the lightbox                                                   |
| AC-11 | Close via Escape          | Pressing Escape closes the lightbox                                                                 |
| AC-12 | Close via swipe-down      | Swiping down at 1x zoom dismisses the lightbox                                                      |
| AC-13 | Focus trap                | Tab key cycles within lightbox; focus doesn't escape to page behind                                 |
| AC-14 | Screen reader support     | Lightbox has role="dialog", aria-modal, accessible close button label, and image alt text           |
| AC-15 | Body scroll locked        | Page behind lightbox does not scroll while lightbox is open                                         |
| AC-16 | SSR safe                  | `pnpm build` succeeds; no hydration mismatches                                                      |
| AC-17 | No new dependencies       | No new entries in package.json                                                                      |
| AC-18 | Storybook stories updated | CameraEventDetailPage stories render correctly with the new layout                                  |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
