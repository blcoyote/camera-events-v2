---
tags: [architecture, frigate]
created: 2026-06-30
---

# Frigate HTTP API — Surface & What We Use

> The full Frigate API surface, which slice of it our client wraps, and what's
> still untapped for future features.

## Context

All Frigate calls funnel through `src/features/shared/server/frigate/client.ts`
(see [[architecture/system-overview]]). The client wraps more endpoints than the
UI actually uses, and Frigate exposes far more than the client wraps. This note
maps the territory so future features don't re-research it from scratch. Base
URL is `FRIGATE_URL`; docs at https://docs.frigate.video/integrations/api/.

## What our client wraps

`client.ts` (mirrored in `mock-client.ts`, toggled by `FRIGATE_MOCK=true`):

| Function                        | Endpoint                           | Used by UI?        |
| ------------------------------- | ---------------------------------- | ------------------ |
| `getEvents`                     | `GET /api/events`                  | ✅ events list     |
| `getEvent`                      | `GET /api/events/{id}`             | ✅ event detail    |
| `getEventThumbnail`/`Snapshot`  | `…/thumbnail.jpg` / `snapshot.jpg` | ✅ via proxies     |
| `getEventClipStream`            | `…/clip.mp4` (Range-aware)         | ✅ via proxy       |
| `retainEvent`/`unretainEvent`   | `POST`/`DELETE …/retain`           | ✅ favorites only  |
| `getLatestSnapshot`             | `GET /api/{camera}/latest.jpg`     | ✅ cameras grid    |
| `getConfig` / `getCameras`      | `GET /api/config`                  | ✅ camera list     |
| `getEventSummary`               | `GET /api/events/summary`          | ❌ wrapped, unused |
| `getStats`                      | `GET /api/stats`                   | ❌ wrapped, unused |
| `getReviewSummary`              | `GET /api/review/summary`          | ❌ wrapped, unused |
| `getReviews`/`getReviewByEvent` | `GET /api/review[/event/{id}]`     | ❌ wrapped, unused |
| `getTimeline`                   | `GET /api/timeline`                | ❌ wrapped, unused |

The summary/stats/review-summary/review/timeline functions are wrapped but no UI
consumes them — cheap starting points for new features. (An activity dashboard
built on the first three was tried and reverted; notably
`/api/events/summary` is **all-time + all-label**, and `/api/review/summary`
returned nothing on our instance — see "gotchas" below.)

## Untapped Frigate capabilities (not wrapped at all)

Notable endpoints the client doesn't touch yet, by value to this app:

- **Review system as a feed** — `GET /api/review` distinguishes `alert` vs
  `detection` severity and supports `set_reviewed`. A far better signal-to-noise
  feed than raw events for a monitoring app. (Caveat: `/api/review/summary`
  returned empty on our test instance — confirm the review/alert pipeline is
  actually producing data before building on it.)
- **Semantic / AI search** — `GET /api/events/search` (text or image embeddings;
  requires Semantic Search enabled in Frigate config / Jina models). Detect
  availability and degrade gracefully — it's config-gated.
- **GenAI** — `POST …/{id}/description`, `POST /api/review/summarize/...` for
  AI event descriptions and review summaries.
- **Live streaming** — go2rtc (`GET /api/go2rtc/streams`) for WebRTC/HLS live
  view. High value, but cross-platform playback (iOS Safari) is the hard part.
- **Recordings & export** — `GET /api/{camera}/recordings`,
  `POST /api/export/{camera}/start/{ts}/end/{ts}`, recording clips by time range.
- **Sub-labels / enrichments** — face recognition, license-plate recognition,
  `GET /api/sub-labels`; `preview.gif` per event; PTZ (`…/ptz/info`).

## Why it matters

- Several "new features" are mostly route + UI work because the data layer
  already exists — check `client.ts` before assuming an endpoint needs wrapping.
- `mock-client.ts` must stay in parity with `client.ts`, so any new endpoint
  works under `FRIGATE_MOCK=true` with no live Frigate. It already returns data
  for stats/summary/review-summary — but **mock parity hid that
  `/api/review/summary` is empty on the real instance**, which is why a dashboard
  built against it looked fine in mock and showed no 24h data in production.
- `GET /api/events/summary` is **all-time and all-label** (its only params are
  `timezone`/`has_clip`/`has_snapshot`) — any "recent" or per-label scoping must
  be done in our own code.
- Storage values in `GET /api/stats` `service.storage` are in **MB**, not bytes.
  `service.latest_version` can be `"unknown"` when Frigate's version check is
  disabled — don't treat that as "update available".

## Related

- [[architecture/system-overview]]
- [[glossary]]
- [[Home]]
