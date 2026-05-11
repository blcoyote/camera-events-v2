# Plan: Feature Split 2 — Extract `favorites` Feature

**Created**: 2026-05-11
**Branch**: main
**Spec**: docs/specs/feature-split-2-extract-favorites-feature.md
**Depends on**: plans/feature-split-1-extract-shared-foundations.md
**Status**: implemented

## Goal

Create `src/features/favorites/` as a new vertical feature slice and move the
favorites-specific UI (`FavoritesPage.tsx`, `FavoritesPage.test.tsx`,
`FavoritesLoading.tsx`) out of `src/features/camera-events/components/` into
the new directory. Update the route file to import from the new location and
remove the originals. This is a pure structural relocation — zero behavior change.

After Plan 1 completes, the source files already import `EventCard` and
`SkeletonCard` from `#/features/shared/components/...`, so the moved files
will have **zero `camera-events` imports** after relocation.

## Acceptance Criteria

(Mirrors the spec's Acceptance Criteria section.)

1. `bun run test` passes with no logic changes — every assertion that passed
   before the move still passes after.
2. `bun run build` (and `tsc` via lint/build) reports no TypeScript errors.
3. `grep -r "FavoritesPage\|FavoritesLoading" src/features/camera-events`
   returns zero results.
4. `src/features/favorites/components/FavoritesPage.tsx`,
   `src/features/favorites/components/FavoritesPage.test.tsx`, and
   `src/features/favorites/components/FavoritesLoading.tsx` all exist.
5. `src/routes/_authenticated/favorites.tsx` imports both components from
   `#/features/favorites/components/...`.
6. No file inside `src/features/favorites/` imports anything from
   `src/features/camera-events/` (verified via `grep -r "features/camera-events"
src/features/favorites`).
7. `CLAUDE.md` feature map table includes a `favorites` row pointing to
   `src/features/favorites/` with the description: "Saved-events list page;
   server logic lives in shared/server/favorites/".

## User-Facing Behavior

The following Gherkin is copied verbatim from
`docs/specs/feature-split-2-extract-favorites-feature.md`:

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

The existing `FavoritesPage.test.tsx` already covers scenarios 1–3 at the
unit level (cards rendered, empty state headline + link, accessible region
label). Scenario 4 is an integration concern verified by the unchanged
`getUserFavoritedEventsFn` server logic, which lives in shared and is not
touched by this plan.

---

## Steps

Each step leaves the repo with `bun run test` green. There are three steps:
(1) move and adjust the test, (2) move the two components and update the
route, (3) update CLAUDE.md.

---

### Step 1 — Move `FavoritesPage.test.tsx` to the new feature directory (RED scaffold)

**Complexity:** standard

**Goal:** Create `src/features/favorites/components/` and place the test file
there with its mock paths adjusted so that the test resolves correctly from
its new location. The test will compile and **fail to load `./FavoritesPage`**
(the dynamic import target does not yet exist at the new location) — this is
the deliberate RED state proving the test now lives at the new path.

**Files:**

- `src/features/favorites/components/FavoritesPage.test.tsx` — **created**
  by copying `src/features/camera-events/components/FavoritesPage.test.tsx`
  with the following adjustments:
  - The mock `vi.mock('./EventCard', ...)` becomes
    `vi.mock('#/features/shared/components/EventCard', ...)` because after
    Plan 1, `FavoritesPage.tsx` imports `EventCard` from the shared module
    (and `vi.mock` paths must match the importer's resolved specifier).
  - The mock `vi.mock('../hooks/useFavoriteToggle', ...)` is **removed**.
    That mock existed only as a transitive safety net for the real
    `EventCard`; since `EventCard` is now fully mocked at its shared path,
    no internal hook resolution happens. Additionally, after the move the
    relative path `'../hooks/useFavoriteToggle'` would point to a
    non-existent `src/features/favorites/hooks/` directory, so leaving it
    would be misleading dead code.
  - The dynamic import `await import('./FavoritesPage')` stays as-is — it
    will resolve to the sibling file in the new directory in Step 2.
  - All other imports (`vitest`, `@testing-library/react`,
    `#/features/shared/server/frigate/types`) remain unchanged because
    they already use absolute aliases.

- `src/features/camera-events/components/FavoritesPage.test.tsx` —
  **deleted** (its content has been moved). Removing it now prevents two
  test files from racing for the same `./FavoritesPage` import target during
  the transition.

**RED:** Run `bun run test -- src/features/favorites`. Expect failure because
`./FavoritesPage` cannot be resolved from the new test file — the production
component hasn't been moved yet.

**GREEN (deferred to Step 2):** This step intentionally leaves the test red;
Step 2 makes it green by moving the production file.

Because `bun run test` (all-suite) must stay green at every step boundary, we
need to keep the existing `FavoritesPage.tsx` reachable by **deleting the
camera-events test** in the same step so that no test in the repo references
the moved component by its old test path. The remaining test suites
(`EventCard.test.tsx`, `CameraEventDetailPage.test.tsx`, etc.) do not import
`FavoritesPage`, so the full suite continues to pass.

To keep the step atomic and the full suite green: bundle the production-file
move into this same step (see "Files" addendum below).

**Files (revised — atomic move):**

- `src/features/favorites/components/FavoritesPage.test.tsx` — created
  (copy of original with mock path updates above)
- `src/features/favorites/components/FavoritesPage.tsx` — created (verbatim
  copy of `src/features/camera-events/components/FavoritesPage.tsx`; after
  Plan 1, its imports are already `@tanstack/react-router`,
  `#/features/shared/server/frigate/types`, and
  `#/features/shared/components/EventCard` — none require editing on move)
- `src/features/camera-events/components/FavoritesPage.test.tsx` — deleted
- `src/features/camera-events/components/FavoritesPage.tsx` — deleted

**Note on RED/GREEN:** Because the test simply asserts unchanged rendering
behavior of an already-implemented component, the meaningful RED/GREEN
signal for this refactor is "tests still pass after the structural move."
The test acts as a regression guard rather than a driver of new behavior;
this is consistent with the spec's stated zero-behavior-change intent.

**Verification:**

```bash
bun run test -- src/features/favorites
bun run test                              # full suite stays green
grep -rn "FavoritesPage" src/features/camera-events     # expect zero hits
grep -rn "features/camera-events" src/features/favorites # expect zero hits
```

**Commit message:**

> refactor(favorites): move FavoritesPage and its test to src/features/favorites
>
> Step 1 of feature-split 2 — relocate favorites page component and unit test
> out of camera-events into the new favorites feature slice. Mock paths in
> the test updated to point at the shared EventCard module. Route file still
> imports from camera-events and is fixed in step 2.

> Wait — the route file still imports `FavoritesPage` from the old path at
> the end of this step, which would break the build. Therefore Step 1 **must
> also update the route import** for `FavoritesPage`, or Steps 1+2 must be
> merged. See Step 2 for the merged approach.

---

### Step 1 (final form) — Move both component files and update the route in one atomic commit

**Complexity:** standard

The above analysis shows that the move cannot be split across two commits
while keeping `bun run build` and `bun run test` green at every step,
because:

- `src/routes/_authenticated/favorites.tsx` imports both `FavoritesPage` and
  `FavoritesLoading` directly. If either component moves without the route
  updating, TypeScript / the Vite build breaks.
- The Vitest suite includes `FavoritesPage.test.tsx`, which must resolve
  its sibling production file.

Therefore Step 1 performs all three moves in a single atomic commit.

**Files:**

- **Create** `src/features/favorites/components/FavoritesPage.tsx` — verbatim
  copy of `src/features/camera-events/components/FavoritesPage.tsx`. Its
  imports after Plan 1 are:

  ```ts
  import { Link } from '@tanstack/react-router'
  import type { FrigateEvent } from '#/features/shared/server/frigate/types'
  import { EventCard } from '#/features/shared/components/EventCard'
  ```

  No edits required on copy.

- **Create** `src/features/favorites/components/FavoritesLoading.tsx` —
  verbatim copy of `src/features/camera-events/components/FavoritesLoading.tsx`.
  Its import after Plan 1 is:

  ```ts
  import { SkeletonCard } from '#/features/shared/components/SkeletonCard'
  ```

  No edits required on copy.

- **Create** `src/features/favorites/components/FavoritesPage.test.tsx` —
  copy of the existing test with these edits:
  - Replace `vi.mock('./EventCard', ...)` with
    `vi.mock('#/features/shared/components/EventCard', ...)` (matches the
    new specifier used by the moved `FavoritesPage.tsx`).
  - Remove the `vi.mock('../hooks/useFavoriteToggle', ...)` block — it was
    a transitive safety net for the real EventCard which is now fully
    mocked; and its relative path would not resolve from the new location.
  - Keep `const { FavoritesPage } = await import('./FavoritesPage')` —
    resolves to the sibling file at the new path.

- **Update** `src/routes/_authenticated/favorites.tsx` — change the two
  imports:

  ```diff
  - import { FavoritesPage } from '#/features/camera-events/components/FavoritesPage'
  - import { FavoritesLoading } from '#/features/camera-events/components/FavoritesLoading'
  + import { FavoritesPage } from '#/features/favorites/components/FavoritesPage'
  + import { FavoritesLoading } from '#/features/favorites/components/FavoritesLoading'
  ```

  The `getUserFavoritedEventsFn` import from
  `#/features/camera-events/server/favorites-fns` is **not** changed by
  this plan — Plan 1 owns the server-side relocation; this plan is UI-only.
  (Cross-check: confirm with Plan 1's final state whether
  `favorites-fns` lives at `camera-events/server/` or has already been
  moved to `shared/server/favorites/`. If Plan 1 moved it, that import
  must also be updated here — note for the implementer to verify when
  Step 1 begins.)

- **Delete** `src/features/camera-events/components/FavoritesPage.tsx`
- **Delete** `src/features/camera-events/components/FavoritesPage.test.tsx`
- **Delete** `src/features/camera-events/components/FavoritesLoading.tsx`

**RED:** Before the move, run
`bun run test -- src/features/camera-events/components/FavoritesPage`
and confirm the existing test passes. This baseline ensures no behavioral
regression after the move. (We are not writing a new test; we are relocating
an existing one. The "RED" equivalent for a pure-move refactor is the
pre-move passing baseline, which would fail if we accidentally broke
something during the move.)

**GREEN:** After the move:

```bash
bun run test                              # full suite must pass
bun run test -- src/features/favorites    # the moved test passes at its new path
bun run lint                              # no unused imports, no path errors
bun run build                             # TypeScript + Vite build clean
```

**REFACTOR:** None. This is a structural relocation with no logic changes.
If the implementer notices any obvious dead code adjacent to the moves
(e.g., an orphaned barrel `index.ts`), they should flag it but not change
it in this commit — keep the diff purely a move.

**Cross-feature import check:**

```bash
grep -rn "features/camera-events" src/features/favorites   # expect zero results
grep -rn "FavoritesPage\|FavoritesLoading" src/features/camera-events  # expect zero results
```

**Commit message:**

> refactor(favorites): extract favorites feature from camera-events
>
> Move FavoritesPage, FavoritesPage.test, and FavoritesLoading from
> src/features/camera-events/components/ into the new
> src/features/favorites/components/ directory. Update the route file
> \_authenticated/favorites.tsx to import from the new location. Adjust
> mock paths in FavoritesPage.test.tsx to reference
> #/features/shared/components/EventCard, and remove the now-defunct
> useFavoriteToggle transitive mock. Pure structural relocation — zero
> behavior change. See docs/specs/feature-split-2-extract-favorites-feature.md.

---

### Step 2 — Update CLAUDE.md feature map

**Complexity:** trivial

**Goal:** Register the new `favorites` feature in the architecture
documentation so future contributors see it in the canonical feature map.

**Files:**

- **Update** `/Users/blc/Documents/camera-events-v2/CLAUDE.md` — add a
  `favorites` row to the Feature Map table. Insert it alphabetically between
  `cameras` and `home`:

  ```diff
   | `cameras`            | `src/features/cameras/`            | Camera grid page, sortable tiles, camera order persistence, snapshot proxy                         |
  +| `favorites`          | `src/features/favorites/`          | Saved-events list page; server logic lives in shared/server/favorites/                             |
   | `home`               | `src/features/home/`               | Home/landing page component                                                                        |
  ```

  Also update the `camera-events` row's description if Plan 1 has not
  already removed the "favorites" reference from it. Current text:
  "Event list/detail pages, snapshot lightbox, clip/snapshot/thumbnail
  proxies, mock data" — already does not mention favorites, so no edit
  needed.

**RED/GREEN:** N/A — this is a documentation-only change. The verification
is human-readable accuracy:

```bash
grep -n "favorites" CLAUDE.md      # expect the new row to appear
```

**Commit message:**

> docs(claude): add favorites feature to feature map
>
> Register src/features/favorites/ in CLAUDE.md's feature-slice table so
> the architecture documentation reflects the new vertical slice created
> in the prior commit.

---

## Pre-PR Quality Gate

Before opening the PR, run from the repo root:

```bash
bun run test                       # all unit tests green
bun run lint                       # eslint clean (no unused imports left in camera-events)
bun run format                     # prettier check clean
bun run build                      # production build succeeds, no TS errors
bun run knip                       # no new dead-code findings introduced by the move
```

Manual smoke check (optional but recommended given this is a route-affecting
move):

1. `bun run dev`
2. Authenticate via Google OAuth.
3. Navigate to `/favorites`.
4. Confirm the page renders the "Your Favorites" heading and either the
   empty state (no favorites) or favorited event cards.
5. Confirm the pending state renders skeleton cards during reload.

Cross-platform PWA reminder (per project rules): no UI behavior is changed
by this refactor, so iOS/Android parity is preserved automatically. No
additional device testing is required.

## Risks & Open Questions

1. **Dependency on Plan 1 completion.** This plan assumes `FavoritesPage.tsx`
   already imports `EventCard` and `SkeletonCard` from `#/features/shared/...`
   when Step 1 begins. If Plan 1 is not merged first, the move will leave
   `FavoritesPage.tsx` with `./EventCard` and `./SkeletonCard` relative
   imports that will not resolve from the new location. **Mitigation:**
   verify `git log` shows Plan 1 merged before beginning Step 1; if not,
   abort and fix forward.

2. **Server-fn import path drift.** `src/routes/_authenticated/favorites.tsx`
   also imports `getUserFavoritedEventsFn` from
   `#/features/camera-events/server/favorites-fns`. Plan 1 may have moved
   this to `#/features/shared/server/favorites/...`. **Action:** before
   editing the route file, grep for the current canonical location of
   `getUserFavoritedEventsFn` and update the import if Plan 1 relocated it.
   If unchanged, leave it alone — that import is outside the scope of
   this plan.

3. **Defunct `useFavoriteToggle` mock removal.** Removing the
   `vi.mock('../hooks/useFavoriteToggle', ...)` block in the test is safe
   because `EventCard` is fully mocked at the module boundary, so the real
   `EventCard`'s internal hook import is never resolved. **Verification:**
   run the test in isolation after the change — if it fails, the
   transitive hook resolution is happening; in that case, re-add the mock
   using the absolute path `#/features/camera-events/hooks/useFavoriteToggle`
   (which still exists, since the hook itself is not moved by this plan).

4. **`grep` false negatives via dynamic strings.** The acceptance grep
   commands look for static identifiers (`FavoritesPage`, `FavoritesLoading`).
   No code in this repo constructs these names dynamically (e.g., via
   string concatenation), so the greps are reliable.

5. **No new `index.ts` barrel.** The plan does not add a barrel
   (`src/features/favorites/index.ts`). The route imports directly from
   `components/...` paths, mirroring the convention used by other feature
   slices in this codebase (`cameras`, `settings`). If a future contributor
   wants a barrel they can add one in a separate refactor.

6. **No new tests written.** This refactor introduces no new behavior, so
   no new tests are added. The relocated `FavoritesPage.test.tsx` is the
   only test that exercises this feature's UI; per project TDD rules, new
   tests accompany new behavior — moves do not.
