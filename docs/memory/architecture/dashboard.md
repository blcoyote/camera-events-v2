---
tags: [architecture, frigate]
created: 2026-06-30
---

# Activity Dashboard

> The `/dashboard` feature: aggregate activity + Frigate system health, built
> entirely on endpoints the client already wrapped.

## Context

The app surfaced individual events but no aggregate view — no sense of volume,
busiest cameras/types, day-over-day trend, or backend health. The
`getStats` / `getEventSummary` / `getReviewSummary` client functions were already
wrapped and mocked but unused (see [[architecture/frigate-http-api]]), making a
dashboard the lowest-cost high-value addition: no new Frigate endpoints, no new
config, no charting dependency.

## What we know / decided

- **Feature slice** `src/features/dashboard/` (route
  `src/routes/_authenticated/dashboard.tsx`). One server function,
  `loadDashboardFn` → `loadDashboardHandler` (handlers/fns split mirrors
  `favorites`), fetches the three endpoints in parallel.
- **Partial-failure tolerant** — each sub-call is independent: `stats`/`review`
  become `null` and `summary` defaults to `[]` when their call fails; the load
  only errors when **all three** fail. The page renders whatever is present
  (tiles show `—` for missing pieces).
- **No charting library.** Breakdowns are CSS bar lists (`BarList`,
  width % from `computeBarPercents`). Keeps the bundle lean and the math
  pure/unit-testable.
- **Pure, tested helpers** carry the logic: `aggregate.ts` (by camera/label/day +
  total), `systemHealth.ts` (`summarizeSystemHealth`), `format.ts`
  (uptime/storage-MB/pct/day-label), `getDashboardPageState.ts`
  (ready|empty|error, mirrors `getCamerasPageState`). Components stay thin.
- Reuses shared `eventFormatting` (`formatCameraName`, `formatLabelName`,
  `getLabelDotColor`) and the shared `FilterPill` (moved out of `camera-events`
  when the dashboard became its second consumer — features can't import each
  other) so labels/colors/pills match the events list.

## Scoping — why the counts aren't "all events"

`GET /api/events/summary` is **all-time and all-label** (its only params are
`timezone`/`has_clip`/`has_snapshot`), so the raw numbers are huge and dominated
by cars/motion. We scope in our own code, two ways:

- **Time:** windowed to `DASHBOARD_WINDOW_DAYS` (30) **server-side in the
  handler** via `dateWindow.ts` (`recentDayCutoff` + `filterSummaryToRecentDays`,
  UTC, lexicographic `YYYY-MM-DD` compare). Done server-side so it's computed
  once and dehydrated — no `new Date()` during render (SSR-safe).
- **Label:** the page has type filter pills **defaulting to `person`** (the app's
  primary signal). Headline + by-camera + by-day follow the selection
  (`filterSummaryByLabel`); the "Events by type" chart always shows the full
  split so the distribution stays visible. Client-side + interactive.

The "Alerts/Detections 24h" tiles are separate — they come from the review
summary and are already 24h + severity-scoped, so they're left as-is.

## Why it matters

- **SSR safety:** day keys (`YYYY-MM-DD`) are formatted by `formatDayLabel` with a
  manual month table, _not_ `Date.toLocaleDateString`, so server and client
  produce identical output regardless of locale/timezone (avoids hydration
  mismatch — see [[gotchas/ssr-hydration-browser-globals]]).
- **Staleness:** `getStats` passes through the in-process Frigate cache (10-min
  TTL, cleared on MQTT events), so "system health" can lag up to ~10 min.
  Refetch-on-focus + pull-to-refresh (`clearCacheFn` + `router.invalidate`)
  mitigate. If truly-live stats are ever needed, bypass the cache for `getStats`.
- **Units gotcha:** stats storage is in MB; `latest_version` may be `"unknown"`.
  Both handled in `systemHealth.ts` / `formatStorageMb`.

## Related

- [[architecture/frigate-http-api]]
- [[architecture/system-overview]]
- [[gotchas/ssr-hydration-browser-globals]]
- [[Home]]
