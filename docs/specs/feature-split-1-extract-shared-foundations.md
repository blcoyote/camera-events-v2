# Spec: Feature Split 1 — Extract Shared Foundations

## Intent Description

Before splitting the camera-events feature, all code that will be consumed by more than one
future feature must be relocated to `src/features/shared/`. This is a pure code-relocation step
with zero behavior change. No new features are created. All imports update to the new paths.
All tests continue to pass.

**What moves to `shared`:**

| Code                                                                                           | From                        | To                                |
| ---------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------- |
| `EventCard`, `EventThumbnail`                                                                  | `camera-events/components/` | `shared/components/`              |
| `SkeletonCard`                                                                                 | `camera-events/components/` | `shared/components/`              |
| `FavoriteButton`                                                                               | `camera-events/components/` | `shared/components/`              |
| `useFavoriteToggle`                                                                            | `camera-events/hooks/`      | `shared/hooks/`                   |
| `favorites-store.ts`                                                                           | `camera-events/server/`     | `shared/server/favorites/`        |
| `favorites-fns.ts`                                                                             | `camera-events/server/`     | `shared/server/favorites/`        |
| `favorites-handlers.ts`                                                                        | `camera-events/server/`     | `shared/server/favorites/`        |
| Format utils (`formatRelativeTime`, `formatLabelName`, `getLabelDotColor`, `formatCameraName`) | `camera-events/utils.ts`    | `shared/utils/eventFormatting.ts` |

`camera-events/utils.ts` is deleted after its contents are migrated. All files that imported
from it update their import paths to `#/features/shared/utils/eventFormatting`.

## User-Facing Behavior

```gherkin
Feature: Extract shared foundations (structural refactor — zero behavior change)

  Scenario: Event list still loads after shared code extraction
    Given the user is authenticated
    When the user navigates to /camera-events
    Then the events list renders with thumbnails, labels, camera names, and relative timestamps
    And label and camera filter pills are functional

  Scenario: Event cards still show and toggle favorite state after shared code extraction
    Given the user is authenticated
    And the user is on the events list at /camera-events
    When the user taps the heart icon on an event card
    Then the heart icon toggles optimistically
    And the favorite state is persisted server-side

  Scenario: Event detail still loads after shared code extraction
    Given the user is authenticated
    And event "abc123" exists
    When the user navigates to /camera-events/abc123
    Then the event detail page renders with snapshot, metadata, and favorite button

  Scenario: Favorites page still loads after shared code extraction
    Given the user is authenticated
    And the user has favorited events
    When the user navigates to /favorites
    Then the favorited events appear as cards identical to the events list cards

  Scenario: Loading skeletons still render
    Given the user is authenticated
    When the events list or favorites page is loading
    Then skeleton cards appear in place of event cards
```

## Architecture Specification

**Additions to `shared/`:**

```
src/features/shared/
  components/
    EventCard.tsx            (moved from camera-events/components/)
    EventCard.test.tsx       (moved)
    EventThumbnail.tsx       (moved from camera-events/components/)
    SkeletonCard.tsx         (moved from camera-events/components/)
    FavoriteButton.tsx       (moved from camera-events/components/)
    FavoriteButton.test.tsx  (moved)
    MediaCard.tsx            (already here — unchanged)
  hooks/
    useFavoriteToggle.ts     (moved from camera-events/hooks/)
    useFavoriteToggle.test.ts (moved)
  server/
    favorites/
      favorites-store.ts     (moved from camera-events/server/)
      favorites-store.test.ts (moved)
      favorites-fns.ts       (moved from camera-events/server/)
      favorites-fns.test.ts  (moved)
      favorites-handlers.ts  (moved from camera-events/server/)
  utils/
    eventFormatting.ts       (new file; contains formatRelativeTime, formatLabelName,
                              getLabelDotColor, formatCameraName — extracted from
                              camera-events/utils.ts)
```

**Updated import paths (representative):**

- `CameraEventsListPage.tsx` → `EventCard` from `#/features/shared/components/EventCard`
- `CameraEventsListPage.tsx` → format utils from `#/features/shared/utils/eventFormatting`
- `CameraEventDetailPage.tsx` → `FavoriteButton`, `useFavoriteToggle` from shared
- `CameraEventDetailPage.tsx` → format utils from `#/features/shared/utils/eventFormatting`
- `CameraEventsLoading.tsx` → `SkeletonCard` from `#/features/shared/components/SkeletonCard`
- `FavoritesPage.tsx` → `EventCard` from `#/features/shared/components/EventCard`
- `FavoritesLoading.tsx` → `SkeletonCard` from `#/features/shared/components/SkeletonCard`
- `routes/favorites.tsx` → favorites server fns from `#/features/shared/server/favorites/favorites-fns`
- `routes/camera-events.$id.tsx` → favorites fns from `#/features/shared/server/favorites/favorites-fns`

**`camera-events/utils.ts` is deleted** after all callers update to `#/features/shared/utils/eventFormatting`.

No route file structure changes. No API endpoints change.

**Import direction (enforced):**

```
features/camera-events  →  features/shared  (allowed)
features/shared         →  features/shared  (allowed within)
features/*              →  features/*        (forbidden across non-shared features)
```

## Acceptance Criteria

1. All Vitest tests pass (`bun run test`) with no logic changes — only import paths updated.
2. TypeScript compilation is clean (`bun run build` emits no errors).
3. `src/features/camera-events/utils.ts` no longer exists.
4. `grep -r "from '../utils'" src/features/camera-events` returns zero results.
5. `grep -r "from '#/features/shared/utils/eventFormatting'"` returns results in every file
   that previously imported format utilities from `camera-events/utils.ts`.
6. All moved test files pass in their new locations.
7. All five user scenarios above pass manual smoke-test in a browser.

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
