# Spec: Event Favorites — Slice 1 (Toggle Button + DB)

## Intent Description

Authenticated users can mark individual Frigate events as personal favorites. A heart button on each event card (list view) and on the event detail page toggles favorite status for the current user. The button renders filled-red when the event is in the user's favorites, hollow otherwise.

Favorite state is stored in a new `event_favorites` SQLite table keyed by `(user_id, event_id)` and is read exclusively through server functions — no database access from the frontend. The route loaders for the events list and event detail pages are enriched to also fetch the current user's favorited event IDs, seeding the heart state server-side so the initial render is correct without any client-side fetch. After a toggle, the router invalidates the affected route loader, and the heart reflects the new database truth.

This slice does not include the `/favorites` page or Frigate retention calls. Those are Slice 2.

## User-Facing Behavior

```gherkin
Feature: Event Favorite Toggle

  Background:
    Given the user is authenticated

  # --- Button Presence ---

  Scenario: Heart button appears on each event card
    Given the user is on the camera events list page
    Then each event card displays a heart icon button

  Scenario: Heart button appears on the event detail page
    Given the user navigates to an event detail page
    Then a heart icon button is visible on that page

  # --- Toggle Behavior ---

  Scenario: Favoriting an event fills the heart
    Given an event is not favorited by the current user
    When the user taps the heart button on that event
    Then the heart icon fills red
    And the favorite is stored in the database for that user and event

  Scenario: Unfavoriting an event empties the heart
    Given an event is favorited by the current user
    When the user taps the heart button on that event
    Then the heart icon becomes hollow
    And the favorite is removed from the database

  Scenario: Heart button is disabled while a toggle is in progress
    Given the user taps the heart button on an event
    When the server call is in flight
    Then the heart button is non-interactive until the call completes

  # --- State Persistence ---

  Scenario: Heart state persists across page reloads
    Given the user has favorited event X
    When the user reloads the events list page
    Then the heart icon for event X is still filled red

  Scenario: Heart state persists on the detail page after reload
    Given the user has favorited event X
    When the user navigates directly to event X's detail page
    Then the heart icon is filled red on first render (no flash of hollow state)

  # --- Per-User Isolation ---

  Scenario: Heart state is per-user
    Given User A has favorited event X
    When User B views the same event card or detail page
    Then User B sees a hollow heart for event X

  # --- Idempotency ---

  Scenario: Favoriting an already-favorited event is idempotent
    Given the user has favorited event X
    When a duplicate favorite request is submitted for event X
    Then the database still contains exactly one favorite row for that user and event
    And the heart remains filled red

  # --- Error Handling ---

  Scenario: Toggle fails gracefully when the server returns an error
    Given the server function throws an error
    When the user taps the heart button
    Then the heart icon reverts to its state before the tap
    And an error indicator is shown to the user

  # --- Authorization ---

  Scenario: Unauthenticated request to toggle is rejected
    Given the request does not carry a valid session
    When the toggle server function is called directly
    Then it returns an Unauthorized error
    And no database row is written or deleted
```

## Architecture Specification

**Feature slice:** All new code lives in `src/features/camera-events/`.

**New files:**

- `src/features/camera-events/server/favorites-store.ts` — Schema init (`CREATE TABLE IF NOT EXISTS event_favorites`), `addFavorite(userId, eventId)`, `removeFavorite(userId, eventId)`, `getUserFavoritedEventIds(userId): string[]`, `isFavorited(userId, eventId): boolean`. Uses the same `openSqlite(dbPath)` and DB file as the push store.
- `src/features/camera-events/server/favorites-fns.ts` — Two `createServerFn` handlers:
  - `toggleFavoriteFn` (POST) — accepts `{ eventId: string }`, calls `requireSession()`, validates with `isValidEventId()`, calls `addFavorite` or `removeFavorite`, returns `{ favorited: boolean }`
  - `getUserFavoritedEventIdsFn` (GET) — calls `requireSession()`, calls `getUserFavoritedEventIds(userId)`, returns `string[]`
- `src/features/camera-events/components/FavoriteButton.tsx` — Client component. Accepts `eventId: string`, `initialFavorited: boolean`. Maintains local `favorited` state seeded from prop. On click: sets button to disabled, calls `toggleFavoriteFn`, updates local state from response, calls `router.invalidate()` to sync loader, re-enables button. On error: reverts state, shows error. Used in both `EventCard` and `CameraEventDetailPage`.

**Modified files:**

- `src/routes/_authenticated/camera-events.index.tsx` — loader runs `loadEvents()` and `getUserFavoritedEventIdsFn()` in parallel; returns `{ result, favoritedEventIds }`. `CameraEventsListPage` receives `favoritedEventIds: string[]` alongside events and passes `favorited={favoritedEventIds.includes(event.id)}` to each `EventCard`.
- `src/routes/_authenticated/camera-events.$id.tsx` — loader runs `loadEvent(id)` and `getUserFavoritedEventIdsFn()` in parallel; `CameraEventDetailPage` receives `favorited: boolean`.
- `src/features/camera-events/components/EventCard.tsx` — accepts optional `favorited?: boolean` prop; renders `<FavoriteButton eventId={event.id} initialFavorited={favorited ?? false} />`.
- `src/features/camera-events/components/CameraEventDetailPage.tsx` — accepts `favorited: boolean`; renders `<FavoriteButton eventId={event.id} initialFavorited={favorited} />`.

**SQLite schema:**

```sql
CREATE TABLE IF NOT EXISTS event_favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, event_id)
);
```

**State model:** Heart state is seeded from the SSR loader (no hydration mismatch). After a toggle, local React state updates immediately from the server response, and `router.invalidate()` re-syncs the loader in the background. No `window`, `navigator`, or `localStorage` reads during render.

**No changes to:** Frigate client, push store, auth layer.

## Acceptance Criteria

**Functional:**

- AC1: Toggling from hollow → filled persists a row in `event_favorites`; toggling from filled → hollow removes it
- AC2: Duplicate favorite inserts (UNIQUE conflict) are silently ignored — idempotent
- AC3: Heart state on initial render matches database truth (no flash of wrong state)
- AC4: After toggle, the heart reflects the server's returned `{ favorited }` value immediately, with loader revalidation in the background
- AC5: Heart button is visually disabled (non-interactive) while the server call is in flight

**Security:**

- AC6: `toggleFavoriteFn` calls `requireSession()` as its first operation; direct HTTP calls without a session receive `Unauthorized`
- AC7: `isValidEventId()` is called before using the event ID in any query
- AC8: `userId` for all DB operations comes from `requireSession()`, never from the request body

**SSR / Hydration:**

- AC9: No hydration mismatch — heart state resolved in SSR loader, same value on server and client

**Cross-platform:**

- AC10: Heart button touch target ≥ 44×44 px on mobile (WCAG 2.5.5)

**Tests (TDD — tests written before implementation):**

- AC11: `favorites-store.ts` — unit tests: insert, duplicate-insert no-op (UNIQUE), delete, `getUserFavoritedEventIds` returns correct IDs, `isFavorited` returns correct boolean
- AC12: `toggleFavoriteFn` handler — tests: first toggle adds row + returns `{ favorited: true }`, second toggle removes row + returns `{ favorited: false }`, unauthorized call throws, invalid event ID throws
- AC13: `FavoriteButton` — Storybook stories for `favorited=true`, `favorited=false`, and `pending` states
- AC14: Events list loader — test that `favoritedEventIds` is included in loader return and passed to `EventCard`

## Consistency Gate

- [x] Intent is unambiguous — two developers would interpret it the same way
- [x] Every behavior in the intent has at least one corresponding BDD scenario
- [x] Architecture constrains without over-engineering — no Frigate changes, no cross-feature imports, no premature abstractions
- [x] Terminology consistent: `event_favorites`, `favoritedEventIds`, `toggleFavoriteFn`, `FavoriteButton` used uniformly
- [x] No contradictions between artifacts
