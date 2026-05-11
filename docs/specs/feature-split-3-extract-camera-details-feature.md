# Spec: Feature Split 3 — Extract `camera-details` Feature + Clean Up `camera-events`

## Intent Description

The final extraction creates `src/features/camera-details/` and moves the event detail page
along with all of its exclusive dependencies: `CameraEventDetailPage`, `SnapshotLightbox`,
`EventSnapshot`, `InfoCard`, `useBlobDownload`, and the three API proxy handlers
(`clip-proxy`, `snapshot-proxy`, `thumbnail-proxy`).

After this step, `camera-events/` contains only the events list page and its direct
dependencies. The three proxy handler files move to `camera-details/server/`; the API route
files update their import paths. CLAUDE.md's feature map is updated to reflect the final
three-feature split, with the `camera-events` entry narrowed to list-only scope.

This is a pure structural relocation — zero behavior change.

**Depends on:** `feature-split-1-extract-shared-foundations.md` must be complete before
this spec is implemented. (Spec 2 may be done in parallel with this one after Spec 1 lands.)

## User-Facing Behavior

```gherkin
Feature: Extract camera-details feature and clean up camera-events (zero behavior change)

  Scenario: Event detail page loads after extraction
    Given the user is authenticated
    And event "abc123" exists in Frigate
    When the user navigates to /camera-events/abc123
    Then the event detail page renders with the event snapshot
    And the camera name, detection label, duration, and zones are displayed
    And the detection confidence bar is shown when score > 0
    And the favorite button reflects the current favorite state

  Scenario: Snapshot lightbox opens on the detail page
    Given the user is viewing an event detail with a snapshot
    When the user taps the snapshot image
    Then the full-screen lightbox opens
    And pressing Escape or clicking outside closes it

  Scenario: Clip download works from the detail page
    Given the user is viewing an event with a clip
    When the user activates the clip download link
    Then the browser downloads the clip via /api/events/:id/clip

  Scenario: Snapshot download works from the detail page
    Given the user is viewing an event with a snapshot
    When the user activates the snapshot download link
    Then the browser downloads the snapshot via /api/events/:id/snapshot?download=true

  Scenario: Events list is unaffected by the camera-details extraction
    Given the user is authenticated
    When the user navigates to /camera-events
    Then the events list renders identically to before the refactor
    And filter pills, event cards, and skeletons all function correctly

  Scenario: No detail-only files remain in camera-events after extraction
    Given the refactored codebase
    Then src/features/camera-events/ contains no file named
    CameraEventDetailPage, SnapshotLightbox, EventSnapshot, InfoCard,
    useBlobDownload, clip-proxy, snapshot-proxy, or thumbnail-proxy
```

## Architecture Specification

**New feature directory:**

```
src/features/camera-details/
  components/
    CameraEventDetailPage.tsx      (moved from camera-events/components/)
    CameraEventDetailPage.test.tsx (moved)
    SnapshotLightbox.tsx           (moved from camera-events/components/)
    SnapshotLightbox.test.tsx      (moved)
    EventSnapshot.tsx              (moved from camera-events/components/)
    InfoCard.tsx                   (moved from camera-events/components/)
  hooks/
    useBlobDownload.ts             (moved from camera-events/hooks/)
  server/
    clip-proxy.ts                  (moved from camera-events/server/)
    clip-proxy.test.ts             (moved)
    snapshot-proxy.ts              (moved from camera-events/server/)
    snapshot-proxy.test.ts         (moved)
    thumbnail-proxy.ts             (moved from camera-events/server/)
```

**Deleted from `camera-events/`:**
All files listed above that are moved to `camera-details/`.

**Final `camera-events/` structure (what remains):**

```
src/features/camera-events/
  components/
    CameraEventsListPage.tsx       (unchanged)
    CameraEventsListPage.test.tsx  (unchanged)
    CameraEventsLoading.tsx        (unchanged)
    FilterPill.tsx                 (unchanged)
  data/
    mock-events.ts                 (unchanged)
    mock-events.test.ts            (unchanged)
```

**Route update** (`src/routes/_authenticated/camera-events.$id.tsx`):

```ts
// Before:
import { CameraEventDetailPage } from '#/features/camera-events/components/CameraEventDetailPage'

// After:
import { CameraEventDetailPage } from '#/features/camera-details/components/CameraEventDetailPage'
```

**API route handler updates** (import paths only — URLs remain identical):

```ts
// src/routes/api/events/$id/clip.ts
// Before: import ... from '#/features/camera-events/server/clip-proxy'
// After:  import ... from '#/features/camera-details/server/clip-proxy'

// src/routes/api/events/$id/snapshot.ts
// Before: import ... from '#/features/camera-events/server/snapshot-proxy'
// After:  import ... from '#/features/camera-details/server/snapshot-proxy'

// src/routes/api/events/$id/thumbnail.ts
// Before: import ... from '#/features/camera-events/server/thumbnail-proxy'
// After:  import ... from '#/features/camera-details/server/thumbnail-proxy'
```

**`camera-details` imports from:**

- `#/features/shared/` — `FavoriteButton`, `useFavoriteToggle`, format utils from
  `eventFormatting`, Frigate types/client/validation, session
- Nothing from `camera-events/` or `favorites/`

**Import direction (enforced):**

```
features/camera-details  →  features/shared       (allowed)
features/camera-details  →  features/camera-events (forbidden)
features/camera-details  →  features/favorites     (forbidden)
features/camera-events   →  features/camera-details (forbidden)
```

**CLAUDE.md feature map** is updated:

| Feature              | Location                       | What it owns                                                                                                             |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `camera-events`      | `src/features/camera-events/`  | Event list page, filter pills, events loading skeleton, mock data                                                        |
| `camera-details`     | `src/features/camera-details/` | Event detail page, snapshot lightbox, clip/snapshot/thumbnail proxies                                                    |
| `favorites`          | `src/features/favorites/`      | Saved-events list page; server logic in `shared/server/favorites/`                                                       |
| `shared` (additions) | `src/features/shared/`         | EventCard, EventThumbnail, SkeletonCard, FavoriteButton, useFavoriteToggle, favorites server code, eventFormatting utils |

## Acceptance Criteria

1. All Vitest tests pass with no logic changes — only file locations and import paths change.
2. TypeScript compilation is clean.
3. `src/features/camera-details/` exists with all files listed above.
4. `src/features/camera-events/` contains none of: `CameraEventDetailPage`, `SnapshotLightbox`,
   `EventSnapshot`, `InfoCard`, `useBlobDownload`, `clip-proxy`, `snapshot-proxy`, `thumbnail-proxy`.
5. API endpoints `/api/events/:id/clip`, `/api/events/:id/snapshot`, `/api/events/:id/thumbnail`
   respond correctly (verified via browser or curl).
6. No file in `camera-details/` imports from `camera-events/` or `favorites/`.
7. No file in `camera-events/` imports from `camera-details/` or `favorites/`.
8. CLAUDE.md feature map reflects the final four-row structure shown above.
9. `bun run lint` passes clean.

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
