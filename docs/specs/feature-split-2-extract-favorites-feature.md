# Spec: Feature Split 2 — Extract `favorites` Feature

## Intent Description

With shared foundations in place (see `feature-split-1-extract-shared-foundations.md`),
`FavoritesPage` and `FavoritesLoading` are the only favorites-specific UI components still
living in `camera-events`. This spec creates `src/features/favorites/` and moves those two
components there. The favorites route updates its import paths. The two moved files are deleted
from `camera-events/`.

After this step, `camera-events/` contains no favorites-related UI code. The `favorites` feature
owns its page components; its server logic already lives in `shared/server/favorites/` from
the previous spec.

This is a pure structural relocation — zero behavior change.

**Depends on:** `feature-split-1-extract-shared-foundations.md` must be complete before
this spec is implemented.

## User-Facing Behavior

```gherkin
Feature: Extract favorites feature (structural refactor — zero behavior change)

  Scenario: Favorites page loads after feature extraction
    Given the user is authenticated
    And the user has favorited one or more events
    When the user navigates to /favorites
    Then the page heading "Your Favorites" is visible
    And all favorited events are displayed as cards
    And each card shows a filled heart icon

  Scenario: Empty favorites state renders correctly
    Given the user is authenticated
    And the user has no favorited events
    When the user navigates to /favorites
    Then an empty state with "No favorites yet" is shown
    And a link to /camera-events is present

  Scenario: Favorites loading skeleton renders
    Given the user is authenticated
    When the favorites page is pending data
    Then skeleton cards appear in the loading state

  Scenario: Favoriting from the events list persists to the favorites page
    Given the user is authenticated
    When the user favorites an event on the events list at /camera-events
    And the user navigates to /favorites
    Then the newly favorited event appears in the favorites list
```

## Architecture Specification

**New feature directory:**

```
src/features/favorites/
  components/
    FavoritesPage.tsx        (moved from camera-events/components/)
    FavoritesPage.test.tsx   (moved)
    FavoritesLoading.tsx     (moved from camera-events/components/)
```

**Deleted from `camera-events/`:**

```
src/features/camera-events/components/FavoritesPage.tsx     ← deleted
src/features/camera-events/components/FavoritesPage.test.tsx ← deleted
src/features/camera-events/components/FavoritesLoading.tsx  ← deleted
```

**Route update** (`src/routes/_authenticated/favorites.tsx`):

```ts
// Before:
import { FavoritesPage } from '#/features/camera-events/components/FavoritesPage'
import { FavoritesLoading } from '#/features/camera-events/components/FavoritesLoading'

// After:
import { FavoritesPage } from '#/features/favorites/components/FavoritesPage'
import { FavoritesLoading } from '#/features/favorites/components/FavoritesLoading'
```

**`FavoritesPage` and `FavoritesLoading`** continue to import `EventCard` and `SkeletonCard`
from `#/features/shared/` (established in Spec 1). No intra-feature logic changes.

**Import direction (enforced):**

```
features/favorites  →  features/shared  (allowed)
features/favorites  →  features/camera-events  (forbidden)
features/favorites  →  features/camera-details  (forbidden)
```

**CLAUDE.md feature map** gains a `favorites` row pointing to `src/features/favorites/`
with description: "Saved-events list page; server logic lives in shared/server/favorites/".

## Acceptance Criteria

1. All Vitest tests pass with no logic changes.
2. TypeScript compilation is clean.
3. `grep -r "FavoritesPage\|FavoritesLoading" src/features/camera-events` returns zero results.
4. `src/features/favorites/components/FavoritesPage.tsx` and `FavoritesLoading.tsx` exist.
5. `src/routes/_authenticated/favorites.tsx` imports both components from `#/features/favorites/`.
6. No file in `src/features/favorites/` imports from `src/features/camera-events/`.
7. CLAUDE.md feature map includes a `favorites` entry.

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
