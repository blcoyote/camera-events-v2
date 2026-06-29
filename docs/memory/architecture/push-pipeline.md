---
tags: [architecture, push, mqtt]
created: 2026-06-29
---

# MQTT → Push Notification Pipeline

> How a Frigate motion event becomes a Web Push notification.

## The flow

1. `src/server.ts` calls `startMqttSubscriber()` at startup.
2. Subscriber connects to `MQTT_URL`, subscribes to `frigate/events` and
   `frigate/reviews`.
3. **Every** incoming message clears the Frigate in-process cache (this is the
   cache-invalidation mechanism, not just a push trigger).
4. `frigate/events` messages → `parseFrigateEvent()` → fed into `EventBatcher`.
5. `EventBatcher` accumulates events **per camera**, flushes after
   `EVENT_BATCH_WINDOW_MS` (default 30s).
6. On flush, `notifyUsersForCamera()` loads push subscriptions from SQLite,
   checks each user's per-camera opt-out preferences, dispatches via `web-push`.

## Why batching

Frigate emits many events per motion burst. Without per-camera batching, a single
person walking past would fire a dozen push notifications. The 30s window
collapses a burst into one notification.

## Gotchas

- Push is **silently disabled** if any of `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` is missing — no error, just no pushes.
- Push delivery must work on **both** iOS (Safari standalone) and Android
  (Chrome). iOS standalone has its own cookie/SW quirks — see
  `docs/specs/cross-platform-pwa-fixes.md`.

## Related

- [[architecture/system-overview]]
- [[glossary]]
- [[Home]]
