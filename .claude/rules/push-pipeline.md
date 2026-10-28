---
paths:
  - 'src/features/push-notifications/**'
  - 'src/features/shared/server/frigate/**'
  - 'src/server.ts'
---

# Frigate integration & MQTT/push pipeline

## Frigate

- All Frigate calls go through `src/features/shared/server/frigate/client.ts`. `FRIGATE_MOCK=true` uses `mock-client.ts` (randomized data).
- Successful JSON responses are memoized in-process by `cache.ts` (a `Map`), cleared on MQTT `frigate/events` or `frigate/reviews` only — `frigate/stats` and `frigate/available` are heartbeats and do not invalidate.
- Call `isValidCameraName()` / `isValidEventId()` before putting user input in Frigate URL paths.

## Pipeline

1. `src/server.ts` calls `startMqttSubscriber()`; it connects to `MQTT_URL` and subscribes to `frigate/events`, `frigate/reviews`, `frigate/stats`, `frigate/available`.
2. New `frigate/events` messages → `parseFrigateEvent()` → `EventBatcher`: a camera's first event flushes immediately (leading edge); follow-ups batch into `EVENT_BATCH_WINDOW_MS` windows. Each flush says whether it opens a new burst (quiet for `EVENT_BURST_GAP_MS`) or continues one.
3. `notifyUsersForCamera()` loads subscriptions from SQLite, checks per-user camera prefs, dispatches via `web-push`. Burst starts alert; continuations are patched into the on-screen notification by the service worker, paced for Apple endpoints by `APPLE_UPDATE_INTERVAL_MS`. Spec: `docs/specs/camera-motion-notification-dedup.md`.
4. `frigate/stats` (`camera_fps`) feeds `CameraAvailabilityTracker`: offline after `CAMERA_OFFLINE_THRESHOLD` consecutive zero-fps readings (default 10), online on the next nonzero. `frigate/available` offline flags every known camera offline immediately. Transitions dispatch via `notifyUsersForCameraAvailability()`, gated by a global per-user opt-in (default **off**, independent of per-camera motion opt-out). Spec: `docs/specs/camera-availability-notifications.md`.
5. Subscriptions and preferences live in `data/camera-events.db` (SQLite, WAL). Push is silently disabled if any `VAPID_*` var is missing.
