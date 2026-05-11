# Plan: Feature Split 1 — Extract Shared Foundations

**Created**: 2026-05-11
**Branch**: main
**Spec**: docs/specs/feature-split-1-extract-shared-foundations.md
**Status**: implemented

## Goal

Move all code that will be shared across the three upcoming features (`camera-events`,
`camera-details`, `favorites`) into `src/features/shared/` before the features are split.
This is a pure structural relocation — no logic changes, no behavior changes, no new
abstractions. Every test passes before and after each step. The result is a `shared/`
directory that contains format utilities, the favorites server stack, the favorite toggle
hook/button, and the reusable event display components (`EventCard`, `EventThumbnail`,
`SkeletonCard`).

## Acceptance Criteria

- [x] `bun run test` exits 0 with the same number of passing tests as the pre-move baseline.
- [x] `bun run build` exits 0 with no TypeScript errors.
- [x] `src/features/camera-events/utils.ts` no longer exists.
- [x] `grep -r "camera-events/utils" src/` returns zero results (covers both relative and
      absolute-alias import forms).
- [x] `grep -r "camera-events/server/favorites" src/` returns zero results.
- [x] `grep -r "camera-events/hooks/useFavoriteToggle" src/` returns zero results.
- [x] `grep -r "camera-events/components/EventCard\|camera-events/components/FavoriteButton\|camera-events/components/EventThumbnail\|camera-events/components/SkeletonCard" src/` returns zero results.
- [ ] Browser smoke-test (see Step 8 checklist) passes on all three routes. (manual — run dev server to verify)

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

## Steps

### Step 1: Create `shared/utils/eventFormatting.ts` and migrate all callers

**Complexity**: standard

**RED**: Run `bun run test` — baseline green. Then create `shared/utils/eventFormatting.ts`
as an empty module and update `EventCard.tsx` to import `formatRelativeTime` from the new
path (breaking its own import temporarily). Confirm at least one test fails for the right
reason (import resolution error).

**GREEN**:

1. Create `src/features/shared/utils/eventFormatting.ts` containing all four functions
   moved verbatim from `camera-events/utils.ts`:
   `formatRelativeTime`, `formatLabelName`, `getLabelDotColor`, `formatCameraName`.
2. Update every caller to use `#/features/shared/utils/eventFormatting`:
   - `src/features/camera-events/components/EventCard.tsx`
   - `src/features/camera-events/components/EventSnapshot.tsx`
   - `src/features/camera-events/components/CameraEventsListPage.tsx`
     (also remove the re-export of format utils from this file)
   - `src/features/camera-events/components/CameraEventDetailPage.tsx`
   - `src/routes/_authenticated/-camera-events-detail.test.ts`
     (imports `formatCameraName` directly from `camera-events/utils`)
   - `src/routes/_authenticated/-camera-events.test.ts`
     (imports `formatRelativeTime`, `formatLabelName`, `getLabelDotColor` via
     re-exports from `CameraEventsListPage` — update to import from shared directly)
3. Delete `src/features/camera-events/utils.ts`.
4. Run `bun run test` — all tests pass.

**REFACTOR**: None needed — pure relocation.

**Files**:

- `src/features/shared/utils/eventFormatting.ts` (new)
- `src/features/camera-events/components/EventCard.tsx`
- `src/features/camera-events/components/EventSnapshot.tsx`
- `src/features/camera-events/components/CameraEventsListPage.tsx`
- `src/features/camera-events/components/CameraEventDetailPage.tsx`
- `src/routes/_authenticated/-camera-events-detail.test.ts`
- `src/routes/_authenticated/-camera-events.test.ts`
- `src/features/camera-events/utils.ts` (deleted)

**Commit**: `refactor: move event format utilities to shared/utils/eventFormatting`

---

### Step 2: Move favorites server code to `shared/server/favorites/`

**Complexity**: standard

**RED**: Move `favorites-store.ts` to `shared/server/favorites/favorites-store.ts` without
updating any imports. Confirm that `bun run test` fails with import resolution errors for
`favorites-handlers.ts` and any test that imports `favorites-store`.

**GREEN**:

1. Move (copy + delete) the following files:
   - `camera-events/server/favorites-store.ts` → `shared/server/favorites/favorites-store.ts`
   - `camera-events/server/favorites-store.test.ts` → `shared/server/favorites/favorites-store.test.ts`
   - `camera-events/server/favorites-handlers.ts` → `shared/server/favorites/favorites-handlers.ts`
     (no test file exists for favorites-handlers — note in commit message for follow-up)
   - `camera-events/server/favorites-fns.ts` → `shared/server/favorites/favorites-fns.ts`
   - `camera-events/server/favorites-fns.test.ts` → `shared/server/favorites/favorites-fns.test.ts`
2. Update internal imports within the moved files:
   - `favorites-handlers.ts`: `from './favorites-store'` — path unchanged (same directory)
   - `favorites-fns.ts`: `from './favorites-handlers'` — path unchanged (same directory)
3. Update callers outside `shared/`:
   - `src/features/camera-events/hooks/useFavoriteToggle.ts`:
     `from '../server/favorites-fns'` → `from '#/features/shared/server/favorites/favorites-fns'`
   - `src/features/camera-events/hooks/useFavoriteToggle.test.ts`:
     `vi.mock('../server/favorites-fns', ...)` → `vi.mock('#/features/shared/server/favorites/favorites-fns', ...)`
   - `src/routes/_authenticated/favorites.tsx`:
     import `getUserFavoritedEventsFn` from `#/features/shared/server/favorites/favorites-fns`
   - `src/routes/_authenticated/camera-events.$id.tsx`:
     import `getUserFavoritedEventIdsFn` from `#/features/shared/server/favorites/favorites-fns`
   - `src/routes/_authenticated/camera-events.index.tsx`:
     import `getUserFavoritedEventIdsFn` from `#/features/shared/server/favorites/favorites-fns`
4. Run `bun run test` — all tests pass.

**REFACTOR**: None needed.

**Files**:

- `src/features/shared/server/favorites/favorites-store.ts` (new location)
- `src/features/shared/server/favorites/favorites-store.test.ts` (new location)
- `src/features/shared/server/favorites/favorites-handlers.ts` (new location)
- `src/features/shared/server/favorites/favorites-fns.ts` (new location)
- `src/features/shared/server/favorites/favorites-fns.test.ts` (new location)
- `src/features/camera-events/server/favorites-store.ts` (deleted)
- `src/features/camera-events/server/favorites-store.test.ts` (deleted)
- `src/features/camera-events/server/favorites-handlers.ts` (deleted)
- `src/features/camera-events/server/favorites-fns.ts` (deleted)
- `src/features/camera-events/server/favorites-fns.test.ts` (deleted)
- `src/features/camera-events/hooks/useFavoriteToggle.ts` (import path update)
- `src/features/camera-events/hooks/useFavoriteToggle.test.ts` (vi.mock path update)
- `src/routes/_authenticated/favorites.tsx` (import path update)
- `src/routes/_authenticated/camera-events.$id.tsx` (import path update)
- `src/routes/_authenticated/camera-events.index.tsx` (import path update)

**Commit**: `refactor: move favorites server code to shared/server/favorites/`

---

### Step 3: Move `useFavoriteToggle` to `shared/hooks/`

**Complexity**: standard

**RED**: Move `useFavoriteToggle.ts` to `shared/hooks/` without updating callers. Confirm
`EventCard.tsx` and `CameraEventDetailPage.tsx` fail to compile (broken relative import).

**GREEN**:

1. Move:
   - `camera-events/hooks/useFavoriteToggle.ts` → `shared/hooks/useFavoriteToggle.ts`
   - `camera-events/hooks/useFavoriteToggle.test.ts` → `shared/hooks/useFavoriteToggle.test.ts`
2. The moved test's `vi.mock` already uses the absolute path
   `'#/features/shared/server/favorites/favorites-fns'` (updated in Step 2) — no change needed.
3. Update callers:
   - `src/features/camera-events/components/EventCard.tsx`:
     `from '../hooks/useFavoriteToggle'` → `from '#/features/shared/hooks/useFavoriteToggle'`
   - `src/features/camera-events/components/CameraEventDetailPage.tsx`:
     `from '../hooks/useFavoriteToggle'` → `from '#/features/shared/hooks/useFavoriteToggle'`
4. Run `bun run test` — all tests pass.

**REFACTOR**: None needed.

**Files**:

- `src/features/shared/hooks/useFavoriteToggle.ts` (new location)
- `src/features/shared/hooks/useFavoriteToggle.test.ts` (new location)
- `src/features/camera-events/hooks/useFavoriteToggle.ts` (deleted)
- `src/features/camera-events/hooks/useFavoriteToggle.test.ts` (deleted)
- `src/features/camera-events/components/EventCard.tsx` (import path update)
- `src/features/camera-events/components/CameraEventDetailPage.tsx` (import path update)

**Commit**: `refactor: move useFavoriteToggle hook to shared/hooks/`

---

### Step 4: Move `FavoriteButton` to `shared/components/`

**Complexity**: standard

**RED**: Move `FavoriteButton.tsx` to `shared/components/` without updating callers. Confirm
`EventCard.tsx` and `CameraEventDetailPage.tsx` fail (broken relative import).

**GREEN**:

1. Move:
   - `camera-events/components/FavoriteButton.tsx` → `shared/components/FavoriteButton.tsx`
   - `camera-events/components/FavoriteButton.test.tsx` → `shared/components/FavoriteButton.test.tsx`
2. The test uses `await import('./FavoriteButton')` — relative path still resolves
   correctly since the test lives next to the source.
3. Update callers:
   - `src/features/camera-events/components/EventCard.tsx`:
     `from './FavoriteButton'` → `from '#/features/shared/components/FavoriteButton'`
   - `src/features/camera-events/components/CameraEventDetailPage.tsx`:
     `from './FavoriteButton'` → `from '#/features/shared/components/FavoriteButton'`
4. Run `bun run test` — all tests pass.

**REFACTOR**: None needed.

**Files**:

- `src/features/shared/components/FavoriteButton.tsx` (new location)
- `src/features/shared/components/FavoriteButton.test.tsx` (new location)
- `src/features/camera-events/components/FavoriteButton.tsx` (deleted)
- `src/features/camera-events/components/FavoriteButton.test.tsx` (deleted)
- `src/features/camera-events/components/EventCard.tsx` (import path update)
- `src/features/camera-events/components/CameraEventDetailPage.tsx` (import path update)

**Commit**: `refactor: move FavoriteButton component to shared/components/`

---

### Step 5: Move `EventThumbnail` to `shared/components/`

**Complexity**: trivial

**RED**: Move `EventThumbnail.tsx` without updating `EventCard.tsx`. Confirm compile fails.

**GREEN**:

1. Move `camera-events/components/EventThumbnail.tsx` → `shared/components/EventThumbnail.tsx`.
2. Update `src/features/camera-events/components/EventCard.tsx`:
   `from './EventThumbnail'` → `from '#/features/shared/components/EventThumbnail'`
3. Run `bun run test` — all tests pass.

**REFACTOR**: None needed.

**Files**:

- `src/features/shared/components/EventThumbnail.tsx` (new location)
- `src/features/camera-events/components/EventThumbnail.tsx` (deleted)
- `src/features/camera-events/components/EventCard.tsx` (import path update)

**Commit**: `refactor: move EventThumbnail component to shared/components/`

---

### Step 6: Move `EventCard` to `shared/components/`

**Complexity**: standard

**RED**: Move `EventCard.tsx` without updating callers. Confirm `CameraEventsListPage.tsx`
and `FavoritesPage.tsx` fail to compile.

**GREEN**:

1. Move:
   - `camera-events/components/EventCard.tsx` → `shared/components/EventCard.tsx`
   - `camera-events/components/EventCard.test.tsx` → `shared/components/EventCard.test.tsx`
2. In `EventCard.tsx`, update its own internal imports to use absolute paths since the
   relative paths from `shared/components/` now resolve differently for format utils:
   - `from '../utils'` was already updated in Step 1 to `#/features/shared/utils/eventFormatting`
   - `from './EventThumbnail'` — still correct (both in `shared/components/`)
   - `from './FavoriteButton'` — still correct (both in `shared/components/`)
   - `from '#/features/shared/hooks/useFavoriteToggle'` — absolute, still correct
3. In `EventCard.test.tsx`, verify both mock paths resolve correctly after the move:
   - `vi.mock('../hooks/useFavoriteToggle', ...)` — relative `../hooks/` from
     `shared/components/` resolves to `shared/hooks/useFavoriteToggle` ✓.
   - Run `bun run test -- EventCard` immediately after the move and confirm the mock
     intercepts `useFavoriteToggle` (the test returns mock values, not real hook state).
     If any test unexpectedly calls the real hook, update both mocks to use absolute
     `#/features/shared/hooks/useFavoriteToggle` and `#/features/shared/components/FavoriteButton`.
4. Update callers:
   - `src/features/camera-events/components/CameraEventsListPage.tsx`:
     `from './EventCard'` → `from '#/features/shared/components/EventCard'`
   - `src/features/camera-events/components/FavoritesPage.tsx`:
     `from './EventCard'` → `from '#/features/shared/components/EventCard'`
5. Run `bun run test` — all tests pass.

**REFACTOR**: None needed.

**Files**:

- `src/features/shared/components/EventCard.tsx` (new location)
- `src/features/shared/components/EventCard.test.tsx` (new location)
- `src/features/camera-events/components/EventCard.tsx` (deleted)
- `src/features/camera-events/components/EventCard.test.tsx` (deleted)
- `src/features/camera-events/components/CameraEventsListPage.tsx` (import path update)
- `src/features/camera-events/components/FavoritesPage.tsx` (import path update)

**Commit**: `refactor: move EventCard component to shared/components/`

---

### Step 7: Move `SkeletonCard` to `shared/components/`

**Complexity**: trivial

**RED**: Move `SkeletonCard.tsx` without updating callers. Confirm `CameraEventsLoading.tsx`
and `FavoritesLoading.tsx` fail to compile.

**GREEN**:

1. Move `camera-events/components/SkeletonCard.tsx` → `shared/components/SkeletonCard.tsx`.
2. Update callers:
   - `src/features/camera-events/components/CameraEventsLoading.tsx`:
     `from './SkeletonCard'` → `from '#/features/shared/components/SkeletonCard'`
   - `src/features/camera-events/components/FavoritesLoading.tsx`:
     `from './SkeletonCard'` → `from '#/features/shared/components/SkeletonCard'`
3. Run `bun run test` — all tests pass.

**REFACTOR**: None needed.

**Files**:

- `src/features/shared/components/SkeletonCard.tsx` (new location)
- `src/features/camera-events/components/SkeletonCard.tsx` (deleted)
- `src/features/camera-events/components/CameraEventsLoading.tsx` (import path update)
- `src/features/camera-events/components/FavoritesLoading.tsx` (import path update)

**Commit**: `refactor: move SkeletonCard component to shared/components/`

---

### Step 8: Final verification

**Complexity**: trivial

**RED**: N/A — verification only.

**GREEN**:

1. Run `bun run test` — all tests pass; count matches pre-move baseline.
2. Run `bun run build` — no TypeScript errors.
3. Run `bun run lint` — no errors.
4. Run acceptance-criteria grep checks (see Acceptance Criteria section) — all return zero.
5. Browser smoke-test checklist:
   - Navigate to `/camera-events`: at least one event card visible with thumbnail, label,
     camera name, and relative timestamp. No JS console errors.
   - Tap the heart icon on an event card: icon toggles immediately (filled ↔ outline).
     Icon re-enables after the network call completes.
   - Click an event card: `/camera-events/:id` loads with snapshot image and favorite button.
   - Navigate to `/favorites`: favorited event(s) appear as cards with filled heart icons.
   - Open DevTools Network tab: no 404s for JS chunks on any of the three routes.

**REFACTOR**: None.

**Files**: None changed.

**Commit**: none (verification only)

---

## Pre-PR Quality Gate

- [ ] All tests pass (`bun run test`)
- [ ] Type check passes (`bun run build`)
- [ ] Linter passes (`bun run lint`)
- [ ] `/code-review` passes
- [ ] Browser smoke-test: all three routes render correctly
- [ ] No file in `camera-events/` imports format utils from a local `utils` module

## Risks & Open Questions

- **`EventCard.test.tsx` mock path after move** (Step 6): The relative mock
  `vi.mock('../hooks/useFavoriteToggle', ...)` from `shared/components/` resolves to
  `shared/hooks/useFavoriteToggle` — verified by tracing the directory structure. If Vitest
  resolves mocks from the original module path rather than the test file path, the mock may
  need to be updated to the absolute `#/features/shared/hooks/useFavoriteToggle`. Verify
  during Step 6.
- **`-camera-events.test.ts` re-export removal** (Step 1): The route test imports format
  utils via `CameraEventsListPage`'s re-exports. These re-exports are removed in Step 1 and
  the test updated to import directly from shared. If there are other unknown callers of
  these re-exports, the build will catch them — treat as a compile-time check.
- **`FavoriteButton.test.tsx` dynamic import** (Step 4): Uses `await import('./FavoriteButton')`.
  After the file moves to `shared/components/`, the relative import still resolves correctly
  since the test lives next to the source. Verify during Step 4.
- **`favorites-handlers.ts` has no test file**: Promoted to shared infrastructure without
  test coverage. File a follow-up issue to add tests after this plan lands.
- **Steps must execute in order**: Steps 3–6 have implicit ordering dependencies (server code
  before hook, hook before button, button before card). Do not pick up steps out of sequence.

## Plan Review Summary

**Reviewers**: Acceptance Test Critic · Design & Architecture Critic · UX Critic · Strategic Critic

**Final verdict**: APPROVED (after revision)

**Blockers addressed**:

1. _(Strategic)_ `camera-events.index.tsx` imports `getUserFavoritedEventIdsFn` and was missing
   from Step 2's caller update list — added.
2. _(Acceptance)_ Vague acceptance criteria replaced with exhaustive grep commands and a
   specific browser smoke-test checklist.

**Warnings noted (non-blocking)**:

- Design: Clarify that RED states are not commit points; commits taken only after GREEN passes.
- Design: `FavoritesPage.tsx` stays in `camera-events/` — its destination is decided in Split 2.
- UX: Explicit `vi.mock` path verification added to Step 6 GREEN phase.
- UX: Favorite-toggle smoke-test added to Step 8 checklist.
- Strategic: Step ordering made an explicit prerequisite in Step 6.
- Strategic: `favorites-handlers.ts` missing test noted as follow-up item.
