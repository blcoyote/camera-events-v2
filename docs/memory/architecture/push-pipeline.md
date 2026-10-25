---
tags: [architecture, push, mqtt]
created: 2026-06-29
---

# MQTT → Push Notification Pipeline

> How a Frigate motion event becomes a Web Push notification.

## The flow

1. `src/server.ts` calls `startMqttSubscriber()` at startup.
2. The subscriber connects to `MQTT_URL` and subscribes to four topics:
   `frigate/events`, `frigate/reviews`, `frigate/stats`, `frigate/available`.
3. Only `frigate/events` and `frigate/reviews` clear the Frigate in-process
   cache. `frigate/stats` and `frigate/available` are health heartbeats and do
   not.
4. `frigate/reviews` messages go through `parseFrigateReview()` and
   `ReviewAlertGate`: the first `new`/`update` with `severity: "alert"` per
   Review starts a notification. `waitForPersistedEvent()` then polls Frigate
   (8 × 2s, 15s hard budget) until one of the Review's detection Events is saved; if none is,
   nothing is sent. The saved Event goes into `EventBatcher`, which flushes a
   camera's first Detection immediately (leading edge), then batches follow-ups
   per camera into one Patch per Patch window (`EVENT_BATCH_WINDOW_MS`, default
   30s). Each flush reports whether it opens a new Burst (no Detections for
   `EVENT_BURST_GAP_MS`, default 10min) or continues one. `frigate/events` no
   longer triggers pushes. See
   [[decisions/2026-10-25-notify-from-verified-review-alerts]].
5. On flush, Delivery (see [[decisions/2026-10-14-delivery-module]]) checks Mute
   first, then each user's Preference, then sends to each of the user's Devices.
   A Burst's opening Alert that Mute swallowed is promoted on the first unmuted
   flush, so a Burst is never patched without having alerted.
6. Continuations are Patches to the notification already on screen. Apple
   endpoints are paced by `APPLE_UPDATE_INTERVAL_MS` because iOS ignores the
   silent flag.
7. `frigate/stats` feeds `CameraAvailabilityTracker`: a Camera goes Offline after
   `CAMERA_OFFLINE_THRESHOLD` consecutive zero-fps readings (default 10) and
   Online on the next nonzero reading. `frigate/available` "offline" flags every
   known Camera Offline at once. Each change is an Availability notification
   through Delivery, gated by the global opt-in Preference (default off).

Domain terms are defined in [CONTEXT.md](../../../CONTEXT.md).

## Why batching

Frigate emits many events per motion burst. Without per-camera batching, a single
person walking past would fire a dozen push notifications. Leading-edge flush
alerts at once; the Patch window then collapses the rest into quiet updates.

## Gotchas

- Push is **silently disabled** if any of `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` is missing — no error, just no pushes.
- Push delivery must work on **both** iOS (Safari standalone) and Android
  (Chrome). iOS standalone has its own cookie/SW quirks — see
  `docs/specs/cross-platform-pwa-fixes.md`.
- Browser subscriptions silently drift out of sync with the server DB (410/404
  cleanup, endpoint rotation), which stops pushes while the UI still looks
  subscribed. The always-mounted `ServiceWorkerRegistration` component
  re-syncs on app open and return-to-foreground — see
  [[gotchas/push-subscription-desync]].

## Related

- [[architecture/system-overview]]
- [[glossary]]
- [[Home]]
