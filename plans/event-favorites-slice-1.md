# Plan: Event Favorites — Slice 1 (Toggle Button + DB)

**Created**: 2026-05-09
**Branch**: HEAD
**Spec**: docs/specs/event-favorites-slice-1.md
**Status**: implemented

## Goal

Add per-user event favoriting to the camera events app. A heart button on each event card and on the event detail page toggles favorite status for the current user, persisted in a new `event_favorites` SQLite table accessed exclusively via server functions. Heart state is seeded server-side in the route loaders — SSR-safe, no hydration mismatch. This slice covers the toggle button, DB storage, and loader enrichment only; the `/favorites` page and Frigate retention are Slice 2.

## Key Architectural Decisions (from plan review)

**FavoriteButton is purely presentational.** A `useFavoriteToggle(eventId, initialFavorited)` hook (Step 3) encapsulates the server call and `router.invalidate()`. `FavoriteButton` receives `{ favorited, pending, error, onToggle }` as props, with zero server imports. This keeps `FavoriteButton` testable without any module mocking.

**Button lives in the card's content area, not the image overlay.** Placing a `<button>` inside the image overlay (which is inside a `<Link>`) creates nested interactive content (`<a>` > `<button>`) — invalid HTML that may cause VoiceOver to silently swallow the button role. The heart button will be placed at the trailing end of the camera name / timestamp row in the card's text content area. `e.stopPropagation()` + `e.preventDefault()` prevent link navigation on heart click;

**`aria-pressed` conveys state.** The filled vs. hollow visual distinction provides a shape cue, but screen readers need a semantic state signal. The button uses `aria-pressed="true"/"false"` with a stable label of `"Favorite"`. This satisfies WCAG 1.4.1 (state not conveyed by color alone) without toggling the aria-label on every render.

**Error state is concretely specified.** On toggle failure: (a) `favorited` reverts to pre-click value, (b) an `aria-live="assertive"` region (visually hidden) announces `"Could not save favorite. Please try again."`, (c) an `AlertCircle` icon appears adjacent to the heart for 4 seconds then auto-dismisses, (d) `router.invalidate()` is NOT called.

**`getUserFavoritedEventIds` returns `string[]`; callers convert to `Set<string>`.** Array.includes() on hundreds of IDs per render is O(n). The route components convert to a Set before passing down so `EventCard` lookups are O(1).

## Acceptance Criteria

- [ ] AC1: Toggling hollow → filled persists a row in `event_favorites`; toggling filled → hollow removes it; `toggleFavoriteFn` returns `{ favorited: true }` / `{ favorited: false }` correspondingly
- [ ] AC2: Duplicate `addFavorite` calls for the same `(userId, eventId)` are idempotent (enforced by UNIQUE DB constraint, not application logic)
- [ ] AC3: Heart state on initial render matches database truth (no flash of wrong state)
- [ ] AC4: After a successful toggle, `favorited` state updates from the server response immediately; `router.invalidate()` is called exactly once to background-refresh the loader
- [ ] AC5: Heart button has the HTML `disabled` attribute while the server call is in flight; button re-enables after completion whether the call succeeded or failed
- [ ] AC6: `toggleFavoriteFn` calls `requireSession()` as its first operation; direct calls without session receive `'Unauthorized'`
- [ ] AC7: `isValidEventId()` is called before using the event ID in any query; invalid IDs throw without writing to the DB
- [ ] AC8: `userId` for all DB operations comes from `requireSession()`, never from the request body
- [ ] AC9: No hydration mismatch — heart state resolved in SSR loader, same value on server and client
- [ ] AC10: Heart button touch target ≥ 44×44 px; verified by a mobile viewport Storybook story that triggers WCAG 2.5.5 automated checks
- [ ] AC11: On toggle failure, `favorited` state reverts to its pre-click value; `aria-live="assertive"` announces the error; `router.invalidate()` is NOT called
- [ ] AC12: `favorites-store.ts` unit tests: insert, duplicate insert no-op (DB constraint fires), delete, `getUserFavoritedEventIds` returns correct IDs for the right user only, `isFavorited` returns correct boolean, table existence verified via `tableNames()`
- [ ] AC13: `useFavoriteToggle` hook tests: success path returns `{ favorited: true/false }` and calls `router.invalidate()`; error path reverts `favorited` and does NOT call `router.invalidate()`
- [ ] AC14: `FavoriteButton` Storybook stories for favorited, unfavorited, pending, and error states; includes a mobile viewport story; a11y addon must pass
- [ ] AC15: Route loader tests confirm both loader calls run in parallel and the return shape is `{ result, favoritedEventIds }`; also confirms that if `getUserFavoritedEventIdsFn` fails the loader handles it gracefully (returns `favoritedEventIds: []`)

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
    Given an event with a heart button that has not yet been tapped
    When the user taps the heart button and the server call has not yet resolved
    Then the heart button is non-interactive (disabled attribute present)
    And the heart button re-enables after the server call completes

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
    And an error message is announced to screen readers
    And an error indicator is visible for approximately 4 seconds

  # --- Authorization ---

  Scenario: Unauthenticated request to toggle is rejected
    Given the request does not carry a valid session
    When the toggle server function is called directly
    Then it returns an Unauthorized error
    And no database row is written or deleted
```

## Steps

### Step 1: favorites-store — SQLite schema and CRUD helpers

**Complexity**: standard
**RED**: Write `src/features/camera-events/server/favorites-store.test.ts`. Tests: `addFavorite(userId, eventId)` inserts a row; calling `addFavorite` twice with the same pair results in exactly one row (DB constraint fires, not application-level guard — use `countRows` to assert); `removeFavorite(userId, eventId)` deletes the row; `getUserFavoritedEventIds('userA')` returns only userA's IDs when both userA and userB have favorites (cross-user isolation); `isFavorited` returns `true` when row exists and `false` when absent; `tableNames()` includes `'event_favorites'`; data persists after `close()` + `createFavoritesStore(samePath)` reopen (persistence test).
**GREEN**: Implement `src/features/camera-events/server/favorites-store.ts`. Mirror `push-store.ts` exactly: `createFavoritesStore(dbPath)` opens DB, enables WAL, runs `CREATE TABLE IF NOT EXISTS event_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, event_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, event_id))`, prepares statements using `INSERT OR IGNORE` for `addFavorite`, returns `FavoritesStore` interface. Include `tableNames()`, `countRows()`, `close()` inspection helpers (same pattern as push-store). Export `getFavoritesStore()` lazy singleton.
**REFACTOR**: None — the push-store pattern is sufficient.
**Files**: `src/features/camera-events/server/favorites-store.ts`, `src/features/camera-events/server/favorites-store.test.ts`
**Commit**: `feat(camera-events): add event_favorites SQLite store`

### Step 2: server functions — toggleFavoriteFn and getUserFavoritedEventIdsFn

**Complexity**: complex (security-sensitive: auth guard, input validation, direct DB write)
**RED**: Write `src/features/camera-events/server/favorites-fns.test.ts`. Tests: `toggleFavoriteFn` without session throws `'Unauthorized'`; `toggleFavoriteFn` with `'../etc/passwd'` as eventId throws (without writing to DB — assert via countRows); first call for `(userId, eventId)` returns `{ favorited: true }`; second call returns `{ favorited: false }`; `getUserFavoritedEventIdsFn` without session throws; `getUserFavoritedEventIdsFn` returns `[]` for a user with no favorites; `getUserFavoritedEventIdsFn` returns only the calling user's IDs when another user has favorites (cross-user isolation test: seed userA favorites, call as userB, assert empty). Mock `requireSession` and `getFavoritesStore` for isolation.
**GREEN**: Implement `src/features/camera-events/server/favorites-fns.ts`. `toggleFavoriteFn` (POST): `requireSession()` first, validate `eventId` with `isValidEventId()` (throw on failure), check `isFavorited`, call `addFavorite` or `removeFavorite`, return `{ favorited: boolean }`. `getUserFavoritedEventIdsFn` (GET): `requireSession()`, return `getUserFavoritedEventIds(userId)` as `string[]`.
**REFACTOR**: None.
**Files**: `src/features/camera-events/server/favorites-fns.ts`, `src/features/camera-events/server/favorites-fns.test.ts`
**Commit**: `feat(camera-events): add toggleFavoriteFn and getUserFavoritedEventIdsFn`

### Step 3: useFavoriteToggle hook

**Complexity**: standard
**RED**: Write `src/features/camera-events/hooks/useFavoriteToggle.test.ts` using `renderHook` from `@testing-library/react`. Mock `toggleFavoriteFn` and `useRouter`. Tests: initial state is `{ favorited: initialFavorited, pending: false, error: null }`; calling `toggle()` sets `pending: true` then calls `toggleFavoriteFn`; on success, `favorited` updates to the response value, `pending` returns to `false`, `router.invalidate()` is called exactly once; on server error, `favorited` reverts to its pre-toggle value, `pending` returns to `false`, `error` is set to a non-null string, `router.invalidate()` is NOT called; calling `toggle()` while `pending` is `true` is a no-op (debounce).
**GREEN**: Implement `src/features/camera-events/hooks/useFavoriteToggle.ts`. Manages `favorited` (seeded from `initialFavorited`), `pending`, and `error` state. `toggle()`: guard on `pending`, set `pending = true`, call `toggleFavoriteFn({ data: { eventId } })`, on success set `favorited = result.favorited` + `router.invalidate()`, on error revert `favorited` + set `error` message, always set `pending = false`. Returns `{ favorited, pending, error, toggle }`.
**REFACTOR**: Extract the error message constant; ensure the guard on `pending` is the first line of `toggle()`.
**Files**: `src/features/camera-events/hooks/useFavoriteToggle.ts`, `src/features/camera-events/hooks/useFavoriteToggle.test.ts`
**Commit**: `feat(camera-events): add useFavoriteToggle hook`

### Step 4: FavoriteButton — purely presentational component

**Complexity**: standard
**RED**: Write `src/features/camera-events/components/FavoriteButton.test.tsx` and `FavoriteButton.stories.tsx`. Unit tests (no server mocks needed): renders a `<button aria-pressed="false">` when `favorited=false`; renders `<button aria-pressed="true">` when `favorited=true`; button has `disabled` attribute when `pending=true`; clicking the button calls `onToggle`; clicking while `pending=true` is blocked (button is disabled, click does not fire `onToggle`); when `error` is non-null, an alert element is visible. Stories: `Unfavorited`, `Favorited`, `Pending`, `Error`, and `FavoritedMobileViewport` (parameters: `{ viewport: { defaultViewport: 'mobile1' } }`) — the mobile story triggers WCAG 2.5.5 automated check.
**GREEN**: Implement `src/features/camera-events/components/FavoriteButton.tsx`. Props: `{ eventId: string, favorited: boolean, pending: boolean, error: string | null, onToggle: () => void }`. Render: `<button aria-pressed={favorited} disabled={pending} onClick={e => { e.stopPropagation(); e.preventDefault(); onToggle() }}>`. Use `Heart` icon from lucide-react with `fill="currentColor"` when favorited. Button must have min touch target 44×44 px via `p-2.5` or equivalent padding (do not use explicit h-/w-). Error state: render a `role="alert"` element (or `aria-live="assertive"` region) showing `error` message alongside an `AlertCircle` icon; the error element auto-dismisses via `useEffect` with a 4-second timeout. No server imports.
**REFACTOR**: Extract the 4-second auto-dismiss into a named `useAutoExpire(value, ms)` utility if it aids readability, otherwise leave inline.
**Files**: `src/features/camera-events/components/FavoriteButton.tsx`, `src/features/camera-events/components/FavoriteButton.test.tsx`, `src/features/camera-events/components/FavoriteButton.stories.tsx`
**Commit**: `feat(camera-events): add FavoriteButton presentational component`

### Step 5: EventCard — integrate FavoriteButton using useFavoriteToggle

**Complexity**: standard
**RED**: Write `src/features/camera-events/components/EventCard.test.tsx`. Mock `FavoriteButton` and `useFavoriteToggle`. Tests: renders a `FavoriteButton`; when `initialFavorited={true}`, `useFavoriteToggle` is called with `(event.id, true)`; when `initialFavorited` is omitted, `useFavoriteToggle` is called with `(event.id, false)`; the `onToggle` prop passed to `FavoriteButton` is the `toggle` function returned by the hook; clicking elsewhere on the card (the link area) navigates without toggling.
**GREEN**: Add `initialFavorited?: boolean` prop to `EventCard`. Call `useFavoriteToggle(event.id, initialFavorited ?? false)` inside the component. Place `<FavoriteButton>` at the **trailing end of the camera name / timestamp row** in the card's content section (below the thumbnail), not in the image overlay. The content row `div` should use `flex items-center justify-between` with the camera name + time group on the left and `FavoriteButton` on the right. This keeps all interactive elements out of the image overlay (which remains read-only indicators only: live-pulse, clip badge).
**REFACTOR**: Confirm the overlay remains semantically non-interactive (both `live-pulse` and clip badge use `role="img"`, not `role="button"`). Adjust spacing in the content row if needed.
**Files**: `src/features/camera-events/components/EventCard.tsx`, `src/features/camera-events/components/EventCard.test.tsx`
**Commit**: `feat(camera-events): integrate FavoriteButton into EventCard`

### Step 6: CameraEventDetailPage — integrate FavoriteButton

**Complexity**: standard
**RED**: Write (or update) `src/features/camera-events/components/CameraEventDetailPage.test.tsx`. Mock `FavoriteButton` and `useFavoriteToggle`. Tests: `CameraEventDetailPage` with `initialFavorited={true}` calls `useFavoriteToggle(event.id, true)` and renders `FavoriteButton` with the hook's state; `FavoriteButton` receives the correct `eventId` (i.e., `result.data.id`); the error state (`result.ok === false`) renders without a `FavoriteButton`.
**GREEN**: Add `initialFavorited?: boolean` prop to `CameraEventDetailPage`. Call `useFavoriteToggle(event.id, initialFavorited ?? false)`. Place `<FavoriteButton>` in the metadata line below the event heading (after the relative-time / timestamp text, before the snapshot). Default to `initialFavorited={false}` in the error branch so no conditional hook call is needed.
**REFACTOR**: None.
**Files**: `src/features/camera-events/components/CameraEventDetailPage.tsx`, `src/features/camera-events/components/CameraEventDetailPage.test.tsx`
**Commit**: `feat(camera-events): integrate FavoriteButton into event detail page`

### Step 7: Route loaders + CameraEventsListPage thread-through

**Complexity**: standard
**RED**: (a) Write loader-level tests for each route file by exporting the loader function and testing it directly: mock `loadEvents` and `getUserFavoritedEventIdsFn`; assert both are called; assert return shape is `{ result, favoritedEventIds: string[] }`; assert that when `getUserFavoritedEventIdsFn` rejects, the loader still returns `{ result, favoritedEventIds: [] }` (graceful degradation). (b) Write/update `CameraEventsListPage.test.tsx`: mock `EventCard`; when `favoritedIds` is a `Set(['evt-1'])` and events include `evt-1` and `evt-2`, the card for `evt-1` receives `initialFavorited={true}` and `evt-2` receives `initialFavorited={false}`; when `favoritedIds` is an empty Set all cards receive `initialFavorited={false}`.
**GREEN**: Update `camera-events.index.tsx` loader: `Promise.all([loadEvents(), getUserFavoritedEventIdsFn().catch(() => [])])` then return `{ result, favoritedEventIds }`. In `CameraEventsRoute`, convert `favoritedEventIds` to `new Set<string>(favoritedEventIds)` and pass to `CameraEventsListPage`. Update `CameraEventsListPage` to accept `favoritedIds: Set<string>` and pass `initialFavorited={favoritedIds.has(event.id)}` to each `EventCard`. Update `camera-events.$id.tsx` similarly: parallel load with graceful degradation; pass `initialFavorited={favoritedEventIds.includes(params.id)}` to `CameraEventDetailPage`.
**REFACTOR**: If the parallel-with-fallback pattern is used in both routes, extract a small `parallelWithFallback<T>(primary: Promise<T>, fallback: T): Promise<[..., T]>` helper only if it's used in 2+ places. Otherwise leave inline.
**Files**: `src/routes/_authenticated/camera-events.index.tsx`, `src/routes/_authenticated/camera-events.$id.tsx`, `src/features/camera-events/components/CameraEventsListPage.tsx`, `src/features/camera-events/components/CameraEventsListPage.test.tsx`
**Commit**: `feat(camera-events): enrich route loaders with favorites data and thread to components`

## Pre-PR Quality Gate

- [ ] All tests pass (`bun run test`)
- [ ] Type check passes (`bun run build`)
- [ ] Linter passes (`bun run lint`)
- [ ] `/code-review` passes
- [ ] Manual smoke test: dev server started, heart toggles on event card and detail page, state persists on reload, error state reverts on simulated failure
- [ ] Storybook a11y addon passes on `FavoriteButton` stories including mobile viewport story

## Risks & Open Questions

- **`<button>` inside `<Link>` HTML validity**: The heart button in EventCard's content area is still inside the `<Link>` rendered by `MediaCard`. This is technically `<a>` > `<button>` (invalid HTML). The Storybook a11y addon must confirm VoiceOver/TalkBack can reach the button as a separate interactive element. If the a11y addon flags this, the fix is to refactor `MediaCard` to support an "actions" slot rendered as a sibling of (not child of) the `<a>` element using the CSS stretch-link pattern.
- **Two SQLite singletons on same file**: `getFavoritesStore()` and `getPushStore()` both open `data/camera-events.db`. WAL mode + single-threaded Bun event loop makes this safe in production. Document the invariant in `favorites-store.ts`. If a third store is added, extract a shared `openAppDb()` singleton.
- **router.invalidate() refetches all events**: Every heart tap on the list page re-fetches Frigate events + favorites. Acceptable for a home NVR with 1-3 users. If this proves slow, the optimistic path (skip invalidate, trust the toggle response) can be adopted in a follow-up.
- **Revert history**: `git log` shows a prior "add favorite event" PR was reverted (`e391532`). Review that PR before implementing to understand what caused the revert and avoid repeating the same issue.

## Plan Review Summary

### Acceptance Test Critic — `needs-revision` (3 blockers addressed)

**Addressed:**

- Added explicit test for `router.invalidate()` call in `useFavoriteToggle` tests (AC4, Step 3)
- Specified error-revert test contract: assert `favorited` reverts, `role="alert"` element is visible, `router.invalidate()` is NOT called (AC11, Step 3)
- Added loader-level parallelism tests including graceful degradation when `getUserFavoritedEventIdsFn` fails (AC15, Step 7)

**Retained warnings (noted):** Schema-constraint test added (AC12 updated); cross-user isolation test in server function tests (Step 2 RED enhanced); `aria-pressed` instead of color-alone (AC14); `disabled` attribute specified explicitly (AC5 updated); mobile viewport story (AC14 updated).

### Design & Architecture Critic — `needs-revision` (1 blocker addressed)

**Addressed:**

- `FavoriteButton` is now purely presentational — no server imports. `useFavoriteToggle` hook (Step 3) encapsulates `toggleFavoriteFn` and `router.invalidate()`.

**Retained warnings (noted):** Two SQLite singletons documented in Risks. `toggleFavoriteFn` return type explicitly specified as `{ favorited: boolean }`. Prop-threading depth documented as deliberate (max 2 levels: ListPage → EventCard). Server function placement note: `getUserFavoritedEventIdsFn` imported into route files — this is consistent with how `clearCacheFn` is already imported from a shared feature module into route files.

### UX Critic — `needs-revision` (4 blockers addressed)

**Addressed:**

- Button placement moved to card content row (below thumbnail), not overlay — avoids nested `<button>` in overlay `<Link>`, avoids overlay crowding, gives button more tap space
- Error indicator fully specified: `role="alert"`, `aria-live="assertive"`, specific message, `AlertCircle` icon, 4-second auto-dismiss (AC11, Step 4)
- `aria-pressed` for screen reader state, supplementing fill/hollow visual cue (Step 4 GREEN)
- Touch target: explicit 44×44 via padding; mobile viewport Storybook story required (AC14)

**Retained warnings (noted):** Overlay pointer-events documented as non-interactive (read-only). Discoverability of favorites without /favorites page accepted as a known limitation of Slice 1; Slice 2 ships the page. Dark mode heart color should be verified in Storybook. Rapid-tap debounce handled by `pending` guard in hook.

### Strategic Critic — `approve` (4 warnings addressed)

**Addressed:**

- `getUserFavoritedEventIds` returns `string[]`; route component converts to `Set<string>` for O(1) lookups (Step 7)
- Steps 6+7 merged into one step (Step 7)
- Dual-singleton SQLite documented in Risks
- router.invalidate() behavior documented in Risks with acknowledged tradeoff

**Prior revert**: `git log` shows `e391532` reverted a prior "add favorite event" attempt. Review that PR diff before starting Step 1 to understand what failed.
