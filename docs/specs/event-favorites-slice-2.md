# Spec: Event Favorites — Slice 2 (Favorites Page + Frigate Retention)

## Intent Description

Event Favorites Slice 2 completes the favorites feature with two additions:

**Favorites page** (`/favorites`): Authenticated users can view all their favorited events in one place. The page fetches each favorited event's details from Frigate in parallel and renders them with the existing `EventCard` component (heart pre-filled). Events that no longer exist in Frigate are silently omitted. A "Favorites" link is added to the app header. An empty state is shown when the user has no favorites.

After unfavoriting an event from the favorites page, the card is removed from the list. The favorites-only loader (`getUserFavoritedEventsFn`) returns only currently-favorited events, so `router.invalidate()` after a toggle causes the unfavorited event to disappear — no additional list-management logic is needed and this is better UX than keeping a hollow-heart card on a page explicitly scoped to favorites.

**Frigate retention side effects**: When the _first_ user favorites an event, the Frigate API is called to retain it (preventing automatic deletion by Frigate's purge rules). When the _last_ user unfavorites an event, the Frigate API is called to unretain it. Retention calls are best-effort — a Frigate API failure is caught and does not roll back the toggle or surface an error to the user.

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

  Scenario: Favorites page omits events missing from Frigate
    Given the user has favorited event X
    And event X returns a non-ok result from Frigate
    When the user navigates to /favorites
    Then event X is not shown
    And no error is displayed to the user

  Scenario: Unfavoriting on the favorites page leaves the card visible with a hollow heart
    Given the user is on the favorites page
    And event A is shown with a filled heart
    When the user taps the heart on event A
    Then event A's heart becomes hollow
    And event A's card remains visible on the page

  Scenario: Favorites nav link is visible in the header for authenticated users
    Given the user is authenticated
    When viewing any authenticated page
    Then a "Favorites" link is visible in the navigation

Feature: Frigate Event Retention

  Scenario: First favorite retains the event in Frigate
    Given no user has favorited event Y
    When a user favorites event Y
    Then the Frigate retain API is called for event Y

  Scenario: Second favorite does not re-retain
    Given User A has already favorited event Y
    When User B favorites event Y
    Then the Frigate retain API is NOT called again for event Y

  Scenario: Unfavoriting by a non-last user does not unretain
    Given event Y is favorited by both User A and User B
    When User A unfavorites event Y
    Then the Frigate unretain API is NOT called for event Y

  Scenario: Last user unfavoriting triggers unretain
    Given event Y is favorited only by User A
    When User A unfavorites event Y
    Then the Frigate unretain API is called for event Y

  Scenario: Frigate retain failure does not prevent the favorite from being saved
    Given the Frigate retain API returns an error
    When the user favorites event Y
    Then the favorite is stored in the database
    And the heart icon becomes filled red
    And no error is shown for the Frigate failure
```

## Architecture Specification

**New files:**

- `src/features/camera-events/components/FavoritesPage.tsx` — receives `FrigateEvent[]`. Renders event grid with `EventCard` (`initialFavorited=true` on each). Shows empty state when list is empty. Mirrors grid layout of `CameraEventsListPage` without filters.
- `src/routes/_authenticated/favorites.tsx` — `/favorites` route. Loader calls `getUserFavoritedEventsFn`. `pendingComponent: CameraEventsLoading`.

**Modified files:**

- `src/features/camera-events/server/favorites-store.ts` — add `getFavoriteCount(eventId): number` (`SELECT COUNT(*) FROM event_favorites WHERE event_id = ?`)
- `src/features/shared/server/frigate/client.ts` — add `retainEvent(eventId): Promise<FrigateResult<void>>` (POST `/api/events/{id}/retain`) and `unretainEvent(eventId): Promise<FrigateResult<void>>` (DELETE `/api/events/{id}/retain`). Both use `frigateFetch` directly (no caching). Mock stubs return `{ ok: true, data: undefined }`.
- `src/features/camera-events/server/favorites-fns.ts` — add `getUserFavoritedEventsHandler`: `requireSession()` → `getUserFavoritedEventIds(userId)` → `getEvent` for each in parallel → filter to `ok` results → return `FrigateEvent[]`. Wire as `getUserFavoritedEventsFn` (GET, `createServerFn`). Modify `toggleFavoriteHandler`: after `addFavorite`, if `getFavoriteCount(eventId) === 1` call `retainEvent` in try/catch; after `removeFavorite`, if `getFavoriteCount(eventId) === 0` call `unretainEvent` in try/catch.
- `src/features/shell/components/Header.tsx` — add `{ label: 'Favorites', to: '/favorites' }` to the `navLinks` array (between Events and Settings).

**Key invariants:**

- Retention is checked _after_ the DB mutation: count of 1 after `addFavorite` = this was the first; count of 0 after `removeFavorite` = this was the last.
- `retainEvent` / `unretainEvent` failures are caught — `toggleFavoriteHandler` always returns `{ favorited: boolean }` regardless.
- No cross-feature imports: `retainEvent`/`unretainEvent` live in `shared/server/frigate/client.ts`; `camera-events` calls shared code only.
- `FRIGATE_MOCK=true`: mock stubs for `retainEvent`/`unretainEvent` return `{ ok: true, data: undefined }`.

**Frigate API endpoints:**

- Retain: `POST /api/events/{event_id}/retain`
- Unretain: `DELETE /api/events/{event_id}/retain`

## Acceptance Criteria

**Favorites page:**

- AC1: `/favorites` renders `EventCard` for each of the current user's favorited events with `initialFavorited=true`
- AC2: `/favorites` shows an empty state (no cards, no error) when the user has zero favorites
- AC3: Events returning non-ok from Frigate are silently filtered — page renders without error
- AC4: `getUserFavoritedEventsFn` calls `requireSession()` as its first operation
- AC5: "Favorites" nav link is present in the header for authenticated users
- AC6: After unfavoriting on the favorites page, the card remains visible with a hollow heart (no immediate removal from list)

**Frigate retention:**

- AC7: `toggleFavoriteHandler` calls `retainEvent` iff `getFavoriteCount(eventId) === 1` after `addFavorite`
- AC8: `toggleFavoriteHandler` calls `unretainEvent` iff `getFavoriteCount(eventId) === 0` after `removeFavorite`
- AC9: A Frigate retain/unretain failure (thrown exception or non-ok result) does not throw from `toggleFavoriteHandler`; toggle response is returned normally

**Tests (TDD — written before implementation):**

- AC10: `getFavoriteCount` — tests: zero count, count of one, count of many, cross-user isolation
- AC11: `toggleFavoriteHandler` retention path — tests: first favorite calls retain, second does not; last unfavorite calls unretain, non-last does not; Frigate error does not propagate
- AC12: `getUserFavoritedEventsHandler` — tests: happy path returns events, empty list returns `[]`, partial Frigate failure (one non-ok) returns remaining events

## Consistency Gate

- [x] Intent is unambiguous — two developers would interpret it the same way
- [x] Every behavior in the intent has at least one corresponding BDD scenario
- [x] Architecture constrains without over-engineering — no new abstractions, reuses EventCard, useFavoriteToggle, CameraEventsLoading
- [x] Terminology consistent: `getFavoriteCount`, `retainEvent`, `unretainEvent`, `getUserFavoritedEventsFn`, `FavoritesPage` used uniformly across all artifacts
- [x] No contradictions between artifacts — hollow-heart-stays decision aligns with existing useFavoriteToggle behavior
