---
tags: [decision, navigation, routing, shell, breadcrumbs]
created: 2026-11-02
---

# Origin-aware breadcrumbs via `?from=` and route `staticData`

> Detail pages show where you came from (`Favorites › Person · Front door`).
> The origin travels as an allow-listed `?from=` search param. Each route
> declares its trail in `staticData.breadcrumb`, and the shell reads it through
> `useMatches()`. That replaces `getPageTitle(pathname)`.

**Status:** accepted, implementation pending. Spec: `docs/specs/breadcrumbs.md`.
When the slices land, update this note to describe the shipped code and any
deviations.

## Context

Events and Favorites both open `/camera-events/$id` through `EventCard`. The
detail page's back link was hard-coded to `/camera-events` and only shown on
desktop, so an event opened from Favorites went back to Events. The Favorites
tab also lost its highlight, and phones had no back control (that matters most
in iOS standalone, which has no browser chrome).

## Decision

- **Origin in the URL:** `?from=events|favorites`, plus the Events list's own
  `camera`/`type` filters under the same keys. Validated in `validateSearch`;
  unknown values are dropped. No origin means Events.
- **Trail declared by routes:** `staticData.breadcrumb(match) => Crumb[]`
  (augmented `StaticDataRouteOption`). The last crumb is the page title, so
  title and trail have one source. Shared pieces live in
  `src/features/shared/navigation/`.
- **One level deep:** `BurstNav` forwards the origin with `replace: true`.
  Live view is always `Cameras › <camera>`.
- **Crumb is a link, not `history.back()`:** predictable for cold deep links.
  System back (Android, iOS swipe) still walks history. This is the up-vs-back
  split, and we accept it.
- **Active tab follows `from`.**
- **Share and push URLs stay clean** (`/camera-events/$id`).

## Alternatives

- **Router history state:** lost on reload and invisible to SSR, so it risks a
  hydration mismatch.
- **Separate `/favorites/$id` route:** two routes for one page.
- **Pure `getBackTarget(pathname, search)` in shell:** simpler, but titles
  could not use loader data (`Person · Front door`) and the pathname matching
  in `navigation.ts` would keep growing.
- **Crumbs on every page:** repeats the tab bar and costs vertical space on
  phones.

## Why it matters

URL-derived trails render the same on the server and the client, survive
reloads, and need no browser API, so they work the same on iOS, Android and
desktop. Routes own their titles, so adding a route means declaring its
`breadcrumb`, not editing pathname matching in the shell.

## Related

- [[Home]]
- [[decisions/2026-04-15-feature-sliced-architecture]]
- [[decisions/2026-04-17-cross-platform-pwa-first]]
