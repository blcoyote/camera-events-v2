# Plan: Event Favorites — Slice 2 (Favorites Page + Frigate Retention)

**Created**: 2026-05-09
**Branch**: HEAD
**Spec**: docs/specs/event-favorites-slice-2.md
**Status**: implemented

## Goal

Complete the event favorites feature by adding a `/favorites` page that lists the current user's favorited events (reusing `EventCard` with hearts pre-filled), and by adding best-effort Frigate retention side effects to the toggle handler: the first user to favorite an event retains it in Frigate; the last user to unfavorite it unretains it.

**Behavior decision:** After unfavoriting an event on the favorites page, the card disappears from the list — this is the natural result of `router.invalidate()` re-running the favorites-only loader, and is better UX than a hollow-heart card on a page explicitly scoped to favorites. The spec's original "card stays hollow" claim assumed the loader behavior was equivalent to the events list, which is incorrect.

## Acceptance Criteria

- [ ] AC1: `/favorites` renders `EventCard` for each favorited event with `initialFavorited=true`
- [ ] AC2: `/favorites` shows an empty state (no cards, no error) when the user has zero favorites; empty state includes a "Browse events" link to `/camera-events`
- [ ] AC3: Frigate non-ok events are silently filtered — page renders without error
- [ ] AC4: `getUserFavoritedEventsFn` calls `requireSession()` as its first operation; a call without a session returns Unauthorized
- [ ] AC5: "Favorites" nav link appears in the header between "Events" and "Settings" for authenticated users
- [ ] AC6: After unfavoriting on the favorites page, the card is removed from the list (loader re-runs via `router.invalidate()`, favorites-only loader excludes the event)
- [ ] AC7: `toggleFavoriteHandler` calls `retainEvent` iff `getFavoriteCount === 1` after `addFavorite`
- [ ] AC8: `toggleFavoriteHandler` calls `unretainEvent` iff `getFavoriteCount === 0` after `removeFavorite`
- [ ] AC9: A Frigate retain/unretain failure (thrown exception or non-ok result) does not throw from `toggleFavoriteHandler`; `{ favorited: boolean }` is still returned
- [ ] AC10: `FavoriteButton` uses a dynamic accessible name: "Add to favorites" when not favorited, "Remove from favorites" when favorited
- [ ] AC11: Tests for `getFavoriteCount`: zero, one, two-users-same-event (count = 2), cross-event isolation
- [ ] AC12: Tests for `toggleFavoriteHandler` retention path: first-favorite retains, non-first does not; last-unfavorite unretains, non-last does not; Frigate error does not propagate and returns correct `{ favorited }`
- [ ] AC13: Tests for `getUserFavoritedEventsHandler`: happy path, empty list, partial Frigate failure (one non-ok → filtered, rest returned), unauthenticated call throws Unauthorized

## User-Facing Behavior

```gherkin
Feature: Favorites Page

  Background:
    Given the user is authenticated

  Scenario: Favorites page shows the user's favorited events
    Given the user has favorited events A and B
    When the user navigates to /favorites
    Then event cards for A and B are shown
    And each card's heart icon is filled red

  Scenario: Favorites page shows empty state when no events are favorited
    Given the user has no favorited events
    When the user navigates to /favorites
    Then an empty state message is displayed
    And no event cards are shown
    And a link to browse events is visible

  Scenario: Favorites page omits events missing from Frigate
    Given the user has favorited event X
    And the Frigate API returns a 404 for event X
    When the user navigates to /favorites
    Then event X is not shown
    And no error is displayed to the user

  Scenario: Unfavoriting on the favorites page removes the card
    Given the user is on the /favorites page
    And event A is shown with a filled heart
    When the user taps the heart on event A
    Then the toggle completes
    And event A's card is removed from the page

  Scenario: Favorites nav link is visible in the header for authenticated users
    Given the user is authenticated
    When the user views any authenticated page
    Then a "Favorites" link is visible in the navigation between "Events" and "Settings"

  Scenario: Unauthenticated direct call to the favorites server function is rejected
    Given the request does not carry a valid session
    When getUserFavoritedEventsFn is called directly
    Then it returns an Unauthorized error
    And no database query is made

Feature: Frigate Event Retention

  Scenario: First favorite retains the event in Frigate
    Given no user has favorited event Y
    When a user favorites event Y
    Then the Frigate retain API is called for event Y

  Scenario: Second favorite does not re-retain
    Given User A has already favorited event Y
    And getFavoriteCount(Y) is 1 in the database
    When User B favorites event Y
    Then the Frigate retain API is NOT called again for event Y

  Scenario: Unfavoriting by a non-last user does not unretain
    Given event Y is favorited by both User A and User B
    When User A unfavorites event Y
    Then the Frigate unretain API is NOT called for event Y

  Scenario: Last user unfavoriting triggers unretain
    Given event Y is favorited only by User A
    And getFavoriteCount(Y) is 1 in the database
    When User A unfavorites event Y
    Then the Frigate unretain API is called for event Y

  Scenario: Frigate retain failure does not prevent the favorite from being saved
    Given the Frigate retain API returns an error
    When the user favorites event Y
    Then the favorite is stored in the database
    And toggleFavoriteHandler returns { favorited: true }

  Scenario: Frigate unretain failure does not prevent the unfavorite from completing
    Given the Frigate unretain API returns an error
    When the last user unfavorites event Y
    Then the favorite is removed from the database
    And toggleFavoriteHandler returns { favorited: false }
```

## Steps

### Step 1: Dynamic aria-label on FavoriteButton

**Complexity**: trivial
**RED**: In `FavoriteButton.test.tsx`, add tests: when `favorited=false` button has `aria-label="Add to favorites"`; when `favorited=true` button has `aria-label="Remove from favorites"`; when `pending=true` button has `aria-label="Saving…"`
**GREEN**: In `FavoriteButton.tsx`, change `aria-label="Favorite"` to `aria-label={pending ? 'Saving…' : favorited ? 'Remove from favorites' : 'Add to favorites'}`
**REFACTOR**: None needed
**Files**: `src/features/camera-events/components/FavoriteButton.tsx`, `src/features/camera-events/components/FavoriteButton.test.tsx`
**Commit**: `fix(favorites): use dynamic aria-label on FavoriteButton for accessibility`

---

### Step 2: Add `getFavoriteCount` to favorites-store

**Complexity**: standard
**RED**: In `favorites-store.test.ts`, add tests: `getFavoriteCount(eventId)` returns 0 with no rows; returns 1 after one user favorites; returns 2 after two different users favorite the same event; returns 0 for a different event (cross-event isolation)
**GREEN**: Add `getFavoriteCount(eventId): number` to the `FavoritesStore` interface; add `count: db.prepare('SELECT COUNT(*) AS n FROM event_favorites WHERE event_id = ?')` to `stmts`; implement as `(stmts.count.get(eventId) as { n: number }).n`
**REFACTOR**: None needed — pattern matches existing statements
**Files**: `src/features/camera-events/server/favorites-store.ts`, `src/features/camera-events/server/favorites-store.test.ts`
**Commit**: `feat(favorites): add getFavoriteCount to favorites store`

---

### Step 3: Add `frigateWrite`, `retainEvent`, and `unretainEvent` to Frigate client

**Complexity**: standard
**RED**: Create `src/features/shared/server/frigate/client.retention.test.ts`. Tests: stub `globalThis.fetch`; `retainEvent` sends `POST /api/events/{id}/retain` and returns `{ ok: true, data: undefined }`; `unretainEvent` sends `DELETE /api/events/{id}/retain` and returns `{ ok: true, data: undefined }`; non-2xx returns `{ ok: false, error: 'HTTP 404' }`; `FRIGATE_MOCK=true` returns `{ ok: true, data: undefined }` without fetching
**GREEN**: Add private `frigateWrite(method: 'POST' | 'DELETE', path: string): Promise<FrigateResult<void>>` helper in `client.ts` (uses `frigateFetch`, no cache). Add `retainEvent(eventId)` and `unretainEvent(eventId)` using `frigateWrite`. Add mock stubs to `mock-client.ts` that return `{ ok: true, data: undefined }`. Export both from `client.ts`.
**REFACTOR**: None needed — the shared `frigateWrite` helper eliminates any duplication between POST and DELETE
**Files**: `src/features/shared/server/frigate/client.ts`, `src/features/shared/server/frigate/mock-client.ts`, `src/features/shared/server/frigate/client.retention.test.ts`
**Commit**: `feat(frigate): add frigateWrite helper with retainEvent and unretainEvent`

---

### Step 4: Wire Frigate retention into `toggleFavoriteHandler`

**Complexity**: standard
**RED**: Extend `favorites-fns.test.ts` with retention tests. Mock `getFavoritesStore` to return a store with `getFavoriteCount`, `addFavorite`, `removeFavorite`, `isFavorited`. Mock `retainEvent` and `unretainEvent` from `#/features/shared/server/frigate/client`. Tests: first add (count returns 1) → `retainEvent` called; second add (count returns 2) → `retainEvent` NOT called; last remove (count returns 0) → `unretainEvent` called; non-last remove (count returns 1) → `unretainEvent` NOT called; `retainEvent` throws → handler still returns `{ favorited: true }` and does not re-throw; `unretainEvent` returns `{ ok: false }` → handler still returns `{ favorited: false }`
**GREEN**: In `toggleFavoriteHandler`: after `addFavorite`, call `store.getFavoriteCount(eventId)`; if count === 1, call `retainEvent(eventId)` inside `try { const r = await retainEvent(eventId); if (!r.ok) console.warn('retain failed', r) } catch (e) { console.warn('retain error', e) }`. After `removeFavorite`, same pattern with `unretainEvent` when count === 0.
**REFACTOR**: Extract the best-effort-call pattern into a small inline helper `bestEffort(fn)` if it appears more than twice; otherwise leave inline
**Files**: `src/features/camera-events/server/favorites-fns.ts`, `src/features/camera-events/server/favorites-fns.test.ts`
**Commit**: `feat(favorites): call Frigate retain/unretain on first/last toggle`

> **Race note**: Two concurrent first-favorites may both see count=1 and both call `retainEvent`. Frigate retain is idempotent — safe. The inverse race (unretain + re-favorite) is extremely unlikely in a ≤5-user household and is also safe since both calls are best-effort.

---

### Step 5: Add `getUserFavoritedEventsHandler` and `getUserFavoritedEventsFn`

**Complexity**: standard
**RED**: Extend `favorites-fns.test.ts`: mock `requireSession` and `getFavoritesStore`; mock `getEvent` from `#/features/shared/server/frigate/client`. Tests: returns `FrigateEvent[]` for favorited IDs; returns `[]` when user has no favorites; when one `getEvent` call returns `{ ok: false }`, that event is omitted and the rest are returned; unauthenticated call — mock `requireSession` to throw — handler throws before any store access; `getEvent` is called for each ID in parallel (all IDs appear in calls, not sequentially)
**GREEN**: Add `getUserFavoritedEventsHandler`: `const userId = await requireSession()` → `const store = await getFavoritesStore()` → `const ids = store.getUserFavoritedEventIds(userId)` → `const results = await Promise.all(ids.map(id => getEvent(id)))` → `return results.filter(r => r.ok).map(r => r.data)`. Wire as `getUserFavoritedEventsFn = createServerFn({ method: 'GET' }).handler(() => getUserFavoritedEventsHandler())`
**REFACTOR**: None needed
**Files**: `src/features/camera-events/server/favorites-fns.ts`, `src/features/camera-events/server/favorites-fns.test.ts`
**Commit**: `feat(favorites): add getUserFavoritedEventsFn server function`

> **N+1 note**: `Promise.all` fan-out is acceptable for a ≤5-user household with ≤100 favorites. `getEvent` responses are cached by `frigateGet` between MQTT invalidations. No concurrency cap needed at this scale.

---

### Step 6: `FavoritesLoading` and `FavoritesPage` components

**Complexity**: standard
**RED**: Create `src/features/camera-events/components/FavoritesPage.test.tsx`. Tests: with a list of mock events → renders one card per event; each `EventCard` receives `initialFavorited={true}`; with empty list → renders empty state text and a link to `/camera-events`; with events → no error message visible. Use `vi.mock` to stub `EventCard` and `useFavoriteToggle`.
**GREEN**:

- Create `FavoritesLoading.tsx`: identical skeleton structure to `CameraEventsLoading` but with kicker "Favorites" and h1 "Loading favorites…"
- Create `FavoritesPage.tsx`: accepts `events: FrigateEvent[]`. If empty, render empty state with headline "No favorites yet", copy "Tap the heart on any event to save it here", and a `<Link to="/camera-events">Browse events</Link>` button. Otherwise render `<section aria-label="Favorited events">` grid with one `<EventCard event={e} initialFavorited={true} />` per event. Use same `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` grid classes as `CameraEventsListPage`.
  **REFACTOR**: None needed
  **Files**: `src/features/camera-events/components/FavoritesLoading.tsx`, `src/features/camera-events/components/FavoritesPage.tsx`, `src/features/camera-events/components/FavoritesPage.test.tsx`
  **Commit**: `feat(favorites): add FavoritesLoading and FavoritesPage components`

---

### Step 7: `/favorites` route

**Complexity**: standard
**RED**: Create `src/routes/_authenticated/favorites.test.ts`. Tests: `favoritesLoader` calls `getUserFavoritedEventsFn` and returns the array; returns `[]` when server fn throws (`.catch(() => [])`)
**GREEN**: Create `src/routes/_authenticated/favorites.tsx`:

```
export async function favoritesLoader() {
  return getUserFavoritedEventsFn().catch((): FrigateEvent[] => [])
}
export const Route = createFileRoute('/_authenticated/favorites')({
  loader: favoritesLoader,
  pendingComponent: FavoritesLoading,
  component: FavoritesRoute,
})
function FavoritesRoute() {
  const events = Route.useLoaderData()
  return <FavoritesPage events={events} />
}
```

After creating this file, run `bun run dev` to trigger `routeTree.gen.ts` regeneration.
**REFACTOR**: None needed
**Files**: `src/routes/_authenticated/favorites.tsx`, `src/routes/_authenticated/favorites.test.ts`
**Commit**: `feat(favorites): add /favorites route`

---

### Step 8: "Favorites" nav link in Header

**Complexity**: trivial
**RED**: In `Header.test.tsx` (or `Header.test.ts`), extend `getHeaderAuthState` tests: when user is present, `navLinks` contains `{ label: 'Favorites', to: '/favorites' }` at index 2 (between 'Events' at index 1 and 'Settings' at index 3)
**GREEN**: In `Header.tsx`, add `{ label: 'Favorites', to: '/favorites' }` after `{ label: 'Events', to: '/camera-events' }` in the `navLinks` array
**REFACTOR**: None needed
**Files**: `src/features/shell/components/Header.tsx`, `src/features/shell/components/Header.test.tsx`
**Commit**: `feat(shell): add Favorites nav link to header`

---

## Complexity Classification

| Rating   | Criteria                                                         | Review depth                                     |
| -------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| trivial  | Single-file change, no new behavior, config or copy change       | Skip inline review; covered by final code-review |
| standard | New function, test, module, or behavioral change within patterns | Spec-compliance + relevant quality agents        |
| complex  | Architectural change, security-sensitive, new abstraction        | Full agent suite including opus-tier agents      |

Steps 1, 8: trivial. Steps 2–7: standard. No complex steps.

## Pre-PR Quality Gate

- [ ] All tests pass
- [ ] Type check passes (`bun run build`)
- [ ] Linter passes (`bun run lint`)
- [ ] `/code-review` passes
- [ ] Route tree regenerated after adding `favorites.tsx` (`bun run dev`)

## Risks & Open Questions

- **Frigate retain/unretain API**: Endpoints are `POST /api/events/{id}/retain` and `DELETE /api/events/{id}/retain`. If the deployed Frigate version does not support these, calls fail silently — no user impact.
- **getFavoriteCount race**: Two concurrent first-favorites may both call `retainEvent`. Safe — Frigate retain is idempotent. The unretain+re-favorite race is extremely unlikely for ≤5 users and is also safe (best-effort).
- **N+1 fan-out**: `Promise.all(ids.map(getEvent))` is acceptable for a ≤5-user household with a small favorites list. `frigateGet` caches responses between MQTT invalidations.
- **Route tree**: TanStack Start auto-generates `routeTree.gen.ts` on `bun run dev`. Must run dev server after creating `favorites.tsx` before type-check passes.
- **Existing favorites migration**: Events already in `event_favorites` before this slice ships will not have `retainEvent` called retroactively. On first deploy, Frigate may still auto-delete them. Out of scope — document as known limitation.

## Plan Review Summary

All four reviewers (Acceptance Test Critic, Design & Architecture Critic, UX Critic, Strategic Critic) returned `needs-revision` on the first pass. The shared blocker — that AC6 ("card stays hollow") was architecturally unachievable with the stated loader approach — was resolved by changing AC6 to match the natural behavior: cards disappear after unfavoriting. This is strictly better UX for a page scoped to favorites.

Additional revisions made:

- Added `FavoritesLoading` component (Step 6) to avoid wrong page title during skeleton load
- Added dynamic `aria-label` fix for `FavoriteButton` as Step 1 (WCAG 4.1.2 compliance)
- Added unauthenticated-call scenario and test for `getUserFavoritedEventsFn` (AC13)
- Added unretain failure scenario to BDD (mirrors retain failure)
- Added `frigateWrite` helper in Step 3 to keep POST/DELETE calls consistent
- Added empty state CTA ("Browse events" link) to AC2 and Step 6
- Documented race and N+1 decisions inline with explicit rationale
- Added `getFavoriteCount` to `FavoritesStore` interface explicitly
