# Spec: Origin-Aware Breadcrumbs

## Intent Description

Cameras, Events and Favorites are top-level tabs. Only the detail routes sit
deeper: `/camera-events/$id` (event detail) and `/live/$name` (live view).
Today the event detail page has a hard-coded desktop-only `← Back` link to
`/camera-events`, and phones get no back control at all. Both Events and
Favorites open events through `EventCard`, so an event opened from Favorites
"goes back" to Events, and the Favorites tab loses its highlight because
`getActiveTab` maps every `/camera-events/*` path to Events.

Breadcrumbs fix that by showing **where you came from**: `Favorites › Person ·
Front door`. The parent crumb links back to the origin list with its filters
intact. Top-level pages do not get a crumb row; it would only repeat the tab
bar.

## Decisions (from the design grilling, 2026-11-02)

| Topic                                  | Decision                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Goal                                   | Trail by origin on detail pages only; top-level pages keep `PageHeader`                                                                |
| Origin transport                       | Search param `?from=events\|favorites` validated against an allow-list in `validateSearch`                                             |
| No origin (push, share link, bookmark) | Fall back to `Events`                                                                                                                  |
| Filters                                | Same keys pass through: `/camera-events/$id?from=events&camera=front&type=person`; detail `validateSearch` reuses the list's validator |
| Depth                                  | One level. `BurstNav` forwards `from`/`camera`/`type` and navigates with `replace: true`. Live view always shows `Cameras › <camera>`  |
| Plumbing                               | Route `staticData.breadcrumb(match)` + `useMatches()`; replaces `getPageTitle(pathname)` as the single source of truth for titles      |
| Event crumb label                      | `<label> · <camera>` via `translateLabel` / `formatCameraName`; generic `Event` title for pending/ghost/gone/unreachable               |
| Placement of shared code               | `src/features/shared/navigation/` (types, `StaticDataRouteOption` augmentation, `useBreadcrumbs()`, `<Breadcrumbs>`)                   |
| Back action                            | Always a real `<Link>` to the origin URL (no `history.back()`)                                                                         |
| Phones                                 | Back control `‹ Favorites` in the sticky top bar, followed by the truncated title; back crumb never shrinks                            |
| Desktop                                | Accessible crumb row replaces the `← Back` link on detail pages                                                                        |
| Active tab                             | Follows `from`: Favorites when `from=favorites`, otherwise Events                                                                      |
| Share/push URLs                        | Stay clean `/camera-events/$id`; pinned by tests                                                                                       |
| System back                            | Accepted split: crumb = "up to the list", Android back / iOS swipe = "previous screen"                                                 |

## Design

### Search params

```ts
type EventOrigin = 'events' | 'favorites'
// /camera-events/$id
validateSearch: (s) => ({
  from: s.from === 'events' || s.from === 'favorites' ? s.from : undefined,
  ...validateCameraEventsSearch(s), // camera?, type? (≤64 chars, list-only filters)
})
```

`camera` and `type` are only used to rebuild the back link. They are never sent
to Frigate and never used to load the event, so they add no SSRF surface. An
unknown `from` is dropped, not trusted.

### Route breadcrumb contract

```ts
// src/features/shared/navigation/types.ts
interface Crumb {
  label: string
  to?: string // absent on the current (last) crumb
  search?: Record<string, string>
}
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    breadcrumb?: (match: { search: unknown; loaderData: unknown }) => Crumb[]
  }
}
```

- `useBreadcrumbs()` reads `useMatches()`, takes the deepest match that has
  `staticData.breadcrumb`, and returns its trail. The last crumb is the page
  title.
- Labels are resolved via `m.*()` when the function runs (per render), not at
  import, the same way `TABS` labels work today.
- The function runs on the server and the client with the same match data, so
  SSR and hydration produce the same HTML. It must not read browser globals or
  the clock.

Trails per route:

| Route                                                   | Trail                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/cameras`, `/camera-events`, `/favorites`, `/settings` | `[{ label: <tab title> }]`                                                               |
| `/camera-events/$id`                                    | `[{ label: Events\|Favorites, to, search }, { label: '<label> · <camera>' \| 'Event' }]` |
| `/live/$name`                                           | `[{ label: Cameras, to: '/cameras' }, { label: '<camera>' }]`                            |

The fallback title (`Camera Events`) applies when no match declares a trail
(e.g. not-found).

### Active tab

`getActiveTab(pathname, search)`: when `pathname` starts with
`/camera-events/` and `search.from === 'favorites'`, return `/favorites`.
Otherwise keep the current behaviour (live view → Cameras).

### Rendering

- **Phones (`< sm`)**, in `Header`: when the trail has a parent crumb, render a
  `<Link>` with a `ChevronLeft` icon and the parent label (`shrink-0`, ≥ 44px
  hit target), then the current label (`min-w-0 truncate`). Otherwise just the
  title, as today.
- **Desktop (`sm+`)**, in the detail pages: `<Breadcrumbs>` renders
  `<nav aria-label={m.shell_breadcrumb()}><ol>…</ol></nav>`; the last item has
  `aria-current="page"`; separators are `aria-hidden`. It replaces the
  `← Back` link in `CameraEventDetailPage` and sits in the same spot in
  `LiveViewPage`.
- The non-event state cards (pending/ghost/gone/unreachable) keep their
  primary button, but it now links to the origin URL instead of `/camera-events`.
- Styling follows `.claude/rules/styling.md` (tokens only, no raw colours).

### Links that must carry the origin

- `EventCard` takes an optional `origin` prop (`{ from, camera?, type? }`) and
  passes it as `search`. `CameraEventsListPage` passes `from: 'events'` plus its
  active filters; `FavoritesPage` passes `from: 'favorites'`.
- `BurstNav` forwards the current detail search and uses `replace: true`.
- The event detail page's link to `/live/$name` does **not** carry the origin.

### Links that must stay clean

- Push notification URLs (`push-notify.ts`, `share-handlers.ts`) and the
  ShareSheet URL stay `/camera-events/$id`. Add tests that pin this.

## Cross-Platform Considerations

- **iOS standalone** has no browser chrome or back button, which is why the
  top-bar back control matters most there. Edge-swipe still walks history.
- **Android** hardware/gesture back walks history. After the change it can
  differ from the crumb (e.g. back from an event opened through a push goes
  to whatever was open before, while the crumb goes to Events). This is the
  normal up-vs-back model and we accept it.
- No new browser APIs. Everything renders during SSR from URL state.

## User-Facing Behavior

```gherkin
Feature: Origin-aware breadcrumbs

  Background:
    Given the user is authenticated

  Scenario: Event opened from Favorites
    Given the user is on /favorites
    When they open the "Person" event on "front_door"
    Then the URL is /camera-events/<id>?from=favorites
    And the trail reads "Favorites › Person · Front Door"
    And the Favorites tab is highlighted
    When they tap the "Favorites" crumb
    Then they are on /favorites

  Scenario: Event opened from a filtered Events list
    Given the user is on /camera-events?camera=front_door&type=person
    When they open an event
    Then the trail's parent crumb links to /camera-events?camera=front_door&type=person

  Scenario: Burst navigation keeps the origin
    Given the user opened an event from Favorites
    When they tap "Next" in the burst navigation
    Then the URL keeps ?from=favorites
    And the browser history did not grow

  Scenario: Cold deep link (push notification, shared link)
    When the user opens /camera-events/<id> with no search params
    Then the trail reads "Events › <label> · <camera>"

  Scenario: Tampered origin
    When the user opens /camera-events/<id>?from=settings
    Then the trail falls back to "Events"

  Scenario: Event not available yet
    When the event is pending, ghost, gone or unreachable
    Then the current crumb reads "Event"
    And the state card's back button links to the origin

  Scenario: Live view
    When the user opens /live/front_door
    Then the trail reads "Cameras › Front Door"

  Scenario: Phone top bar
    Given a phone-sized viewport on an event detail page opened from Favorites
    Then the top bar shows a "‹ Favorites" link and the truncated event title
```

## Implementation Slices (TDD, one bd issue each)

1. **Shared crumb contract.** `src/features/shared/navigation/`: `Crumb` type,
   `StaticDataRouteOption` augmentation, `useBreadcrumbs()`, `<Breadcrumbs>`
   (accessible markup) + i18n key `shell_breadcrumb` (en + da).
2. **Event origin search + trail.** `validateSearch` on
   `camera-events.$id.tsx` (allow-listed `from`, reused filter validator);
   `staticData.breadcrumb` with loader-derived label and generic fallback.
3. **Remaining route trails.** Static trails on the four tab routes and
   `/live/$name`.
4. **Shell header uses the trail.** `Header` renders the title/back from
   `useBreadcrumbs()`; delete `getPageTitle` and its tests;
   `getActiveTab(pathname, search)`.
5. **Origin-carrying links.** `EventCard` `origin` prop; list and favorites
   pages pass it; `BurstNav` forwards search with `replace: true`; tests that
   pin clean share/push URLs.
6. **Desktop crumb row.** Replace `← Back` in `CameraEventDetailPage` and its
   state cards; add the row to `LiveViewPage`.
7. **E2E + visual check.** Playwright scenarios above, phone and desktop
   screenshots.
