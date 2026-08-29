---
tags: [decision, frigate, mqtt, push-notifications, camera-details]
created: 2026-08-29
---

# Ghost-event notifications: gate the deep link, don't gate the push

## Context

Users reported that a "Person detected" push would sometimes open an event
detail page reading _"The event you're looking for doesn't exist or has been
removed."_

Root cause is upstream: Frigate publishes the `"type": "new"` message on
`frigate/events` **before** it writes the event row, and for objects that never
move, never enter a required zone, or end as a false positive, it never writes
one at all. Full mechanism and source references in
[[gotchas/frigate-publishes-new-before-persisting]].

The obvious remedy — verify the event exists before pushing — is a trap. At
`"new"` time the row is normally absent by design, so an existence gate would
suppress most notifications, and polling until it appeared would delay the alert
by seconds to minutes, defeating the leading-edge flush in
[[decisions/2026-08-02-alert-once-per-burst-then-patch]].

## Decision

Keep the push instant and unconditional. Make the **deep link** honest instead,
in three layers:

1. **Carry Frigate's own persistence predicate.** `parseFrigateEvent` now keeps
   `after.has_snapshot` / `after.has_clip` on `FrigateEventInfo` as
   `hasSnapshot` / `hasClip`. These are exactly what Frigate's `should_update_db`
   tests, and they cost nothing — they are already in the MQTT payload.

2. **Deep-link only when the event will exist.** `buildCameraPayload` points at
   `/camera-events/{id}` only when the batch is a single event and
   `isDeepLinkable(event)` (`hasSnapshot || hasClip`). Otherwise it points at
   `/camera-events`. The notification still alerts identically; only its
   destination changes.

3. **Recover from the residual race on the detail page.** Frigate event IDs are
   `<start_time>-<random>`, so `parseEventStartTimeMs` reads an event's age off
   the ID with no call to Frigate. On a 404, `getDetailPageState` returns a new
   `pending` kind when the ID is younger than 2 minutes, rendering "Still being
   saved" with a 3-second auto-retry and a manual _Check again_, instead of
   "Event not found". Older IDs still say not found, which is the truth.

`nowMs` for that age comparison is stamped in the **route loader**, not read
during render, so server and client agree at first paint
([[decisions/2026-04-14-server-client-code-segmentation]]). The retry deadline is
anchored at mount so polling cannot outlive the window even if a retry never
lands.

## Alternatives considered

- **Verify via `GET /api/events/{id}` before dispatch.** Rejected: suppresses
  the majority of notifications, since the row legitimately does not exist yet.
- **Verify with a bounded retry before dispatch.** Rejected: trades the app's
  headline property (instant alert) for a deep link, and still fails for the
  permanent-ghost class where the row never appears.
- **Delay the batcher's leading-edge flush by a few seconds.** Rejected: same
  latency cost, and it contradicts the burst-alert design without fixing
  permanent ghosts.
- **Always link to `/camera-events`.** Rejected: throws away a genuinely useful
  deep link for the common case where Frigate has persisted the event.
- **Subscribe to `"update"`/`"end"` messages to learn when the row lands.**
  Rejected as over-engineering for now: it re-opens the dedup design and the
  `has_*` flags already answer the question at `"new"` time.

## Why it matters

- A push whose link 404s is worse than no link — it reads as a broken app.
- The fix adds **zero** latency and drops **zero** notifications; only the URL
  and the 404 copy change.
- `hasSnapshot`/`hasClip` are now on `FrigateEventInfo`, so any future consumer
  of the batcher can tell a persisted event from a speculative one.
- Do not "fix" the pending state by making it wait longer. Past ~2 minutes the
  row genuinely is not coming, and pretending otherwise hides real deletions.

## Related

- [[gotchas/frigate-publishes-new-before-persisting]]
- [[architecture/push-pipeline]]
- [[decisions/2026-08-02-alert-once-per-burst-then-patch]]
- [[Home]]
