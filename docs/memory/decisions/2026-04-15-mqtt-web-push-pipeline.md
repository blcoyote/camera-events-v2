---
tags: [decision, push, mqtt]
created: 2026-04-15
---

# MQTT events drive push via a per-camera batcher, gated silently on VAPID config

> Frigate MQTT events fan out to Web Push through one in-memory per-camera
> batcher; missing VAPID keys disable push with no error, not a crash.

## Context

Push notification plumbing (subscriptions, VAPID, SQLite storage) already
existed from an earlier slice. This decision covers wiring it to live Frigate
activity: `startMqttSubscriber()` runs at server startup, connects to
`MQTT_URL`, and subscribes to `frigate/events` and `frigate/reviews`. Every
message on either topic clears the Frigate in-process cache — that's the
cache-invalidation mechanism, independent of push. Only `frigate/events`
messages feed the push path.

## Decision

- `parseFrigateEvent()` accepts only `type: "new"` messages with valid
  `id`/`camera`/`label`/`start_time` fields; anything else (malformed JSON,
  `update`/`end` types, missing fields) returns `null` and is dropped —
  silently, no error.
- Accepted events go into `EventBatcher`, keyed **per camera** (`Map<camera,
events[]>` + one `setTimeout` per camera). A camera's buffer flushes
  `EVENT_BATCH_WINDOW_MS` after its first buffered event (default `30_000`,
  parsed by `parseBatchWindowMs` — `"0"` is honored as immediate-flush, only
  `undefined`/blank/non-numeric fall back to the default).
- On flush, `notifyUsersForCamera(camera, events)` runs: bail immediately if
  `isPushEnabled()` is false or the batch is empty; otherwise load all
  subscribed user IDs from the SQLite push store, skip any user who has that
  camera disabled (`isCameraEnabledForUser` — opt-out model, no row means
  enabled), build a single-event or bundled payload, and call
  `sendPushNotification` (web-push + VAPID) for every device the user has
  registered.
- `sendPushNotification` catches 410/404 responses and deletes that
  subscription row — expired endpoints self-heal out of the store instead of
  retrying forever.
- Push is gated by `isPushEnabled()` in `push.ts`: true only if
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are all set.
  If any is missing, the module logs one warning at import time and every
  subsequent send is a silent no-op — MQTT ingestion, batching, and cache
  invalidation all keep working with push simply never firing.

## Alternatives considered

- **One push per event** — rejected: a single motion burst on one camera can
  emit a dozen Frigate events; batching per camera collapses that into one
  notification instead of spamming the device.
- **Global batch window (all cameras together)** — rejected: opt-out
  preferences are per-camera, so a shared window would force filtering logic
  to happen after bundling instead of before, and would delay a quiet
  camera's notification behind a noisy one.
- **Persisted/durable batch queue** — rejected: the buffer is an in-memory
  `Map`, not a DB table. Worst case on a server restart mid-window is one
  unbatched or dropped notification; not worth the durability machinery for a
  best-effort feature.

## Deviation from the plan

- Both specs and the plan hardcode a **10-second** batch window. Shipped code
  makes it a **runtime env var**, `EVENT_BATCH_WINDOW_MS`, defaulting to
  **30 seconds** — a wider default than planned, and configurable without a
  code change.
- Both specs/plan reference the notification icon as `/logo192.png`. Shipped
  code (`push-notify.ts`, and the actual asset in `public/manifest.json`)
  uses `/icon-192.png`. Cosmetic, but if you go looking for `logo192.png` on
  disk you won't find it.

## Why it matters

Per-camera batching is what keeps this feature from being obnoxious — without
it, a person walking past a camera fires a notification per detection frame
instead of one. The silent VAPID gate means push is genuinely optional
infrastructure: a fresh checkout or a deploy without keys configured runs the
full MQTT → cache-invalidation pipeline with zero errors, just no
notifications, which is the right failure mode for a self-hosted app where not
everyone wants push. The per-user, per-camera opt-out check happens _before_
building the payload, so a muted camera costs nothing beyond the one query.

## Related

- [[Home]]
- [[architecture/push-pipeline]]
- [[gotchas/push-subscription-desync]]
