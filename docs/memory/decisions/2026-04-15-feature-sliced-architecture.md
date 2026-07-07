---
tags: [decision, architecture]
created: 2026-04-15
---

# Codebase is organized as vertical feature slices under `src/features/`

> Each feature owns its own components/hooks/utils/server logic end to end;
> features never import each other; shared code lives only in
> `src/features/shared/`.

## Context

The codebase used to be organized by technical role (`components/`, `hooks/`,
`pages/`, `server/`, `data/`). That layout created implicit cross-cutting
dependencies — the settings page reached into a generic `hooks/` folder also
used by camera-events, page components imported server types directly, and
API proxy handlers imported straight from `server/frigate/`. Nothing marked
which code was safe to change without checking every consumer.

## Decision

Restructure into vertical feature slices under `src/features/`. Current
slices:

`auth`, `camera-details`, `camera-events`, `cameras`, `favorites`, `home`,
`push-notifications`, `settings`, `shared`, `shell` — ten folders, verified
directly against `src/features/`.

- Each feature folder owns all of its own components, hooks, utils, types,
  and server logic (co-located tests included).
- **Features must never import from other features.** The only shared home is
  `src/features/shared/` (Frigate client/cache/validation, session, SQLite
  driver, `EventCard`/`MediaCard`/`FavoriteButton`, `eventFormatting` utils,
  favorites server logic). Code moves to `shared/` only once ≥2 features (or
  route files) need it — it does not become a dumping ground for "might be
  reused."
- Route files under `src/routes/` are the one place allowed to import from
  any feature — they're the composition/wiring layer, not business logic.
- The `#/*` import alias maps to `./src/*` (`package.json` → `imports`,
  `tsconfig.json` → `compilerOptions.paths`), so feature imports are absolute:
  `#/features/shared/server/frigate/client`, not deep relative paths.
- The split happened in four passes: the base restructure (this spec), then
  `feature-split-1` pulled `EventCard`/`FavoriteButton`/`useFavoriteToggle`/
  favorites server code/`eventFormatting` out of `camera-events` into
  `shared` (they were needed by favorites and camera-details too), then
  `feature-split-2` and `-3` carved `favorites` and `camera-details` out of
  what had been a monolithic `camera-events`.

## Alternatives considered

- **Keep the technical-role layout** — rejected: it was the status quo being
  fixed; every change to a "domain" required touching several unrelated
  top-level folders.
- **Duplicate favorites/detail UI inside `camera-events` instead of
  extracting `favorites`/`camera-details`** — implicitly rejected by
  feature-split 2/3: once `FavoritesPage` and `CameraEventDetailPage` had no
  remaining camera-events-only dependents, leaving them inside
  `camera-events` would have made that folder a second dumping ground instead
  of a real "events list" slice.

## Deviation from the plan

The plan's dependency rule was absolute: "No feature may import from another
feature." In the current code, two features violate it in one direction only:

- `src/features/shell/components/Header.tsx` imports `useStandaloneAuth` and
  `useSessionRefresh` from `#/features/auth/hooks/...`.
- `src/features/home/pages/HomePage.tsx` imports `useStandaloneAuth` from the
  same place.

Verified by grepping every feature folder for `#/features/` imports outside
`shared/` and outside the importing feature itself — `shell` and `home` are
the only two hits, both reaching into `auth`. Every other feature (`auth`,
`camera-details`, `camera-events`, `cameras`, `favorites`,
`push-notifications`, `settings`) has zero cross-feature imports, so the rule
holds everywhere except this one pattern: UI outside `auth` reads
client-side auth state directly from `auth`'s hooks rather than that state
being lifted into `shared/`. Treat this as the accepted shape, not an
oversight to silently "fix" by moving the hooks — if it gets revisited, do it
as a deliberate move of `useStandaloneAuth`/`useSessionRefresh` into `shared/`
with its own review, not a drive-by.

## Why it matters

The no-cross-import rule is what makes "prefer duplication over coupling"
enforceable instead of aspirational — without it, the same pressure that
built the original tangled `hooks/`/`components/` layout reappears one
feature at a time. Grepping `#/features/<other-feature>/` outside `shared/`
is the cheap way to check the rule still holds; it's how the `shell`/`home`
exception above was found. When adding code, the default is to duplicate a
few lines inside the feature that needs them; only promote to `shared/` once
a second real consumer shows up.

## Related

- [[Home]]
- [[architecture/system-overview]]
