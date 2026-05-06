# Backend: Frigate, MQTT & SQLite

## Frigate Integration

- All Frigate API calls go through `src/features/shared/server/frigate/client.ts`.
- **Mock mode:** set `FRIGATE_MOCK=true` to use `mock-client.ts` which returns randomized data — no live Frigate needed.
- **Caching:** successful JSON responses are memoized in-process by `cache.ts` (a `Map`). The cache is cleared whenever an MQTT event arrives (`frigate/events` or `frigate/reviews` topics).
- **Input validation:** `isValidCameraName()` and `isValidEventId()` must be called before using user-supplied values in Frigate URL paths.
- `FRIGATE_URL` must be set in production (e.g. `http://frigate:5000`).

## MQTT & Push Notification Pipeline

1. `src/server.ts` calls `startMqttSubscriber()` at server startup.
2. MQTT subscriber connects to `MQTT_URL` and subscribes to `frigate/events` and `frigate/reviews`.
3. Every incoming message clears the Frigate cache.
4. New `frigate/events` messages are parsed by `parseFrigateEvent()` and fed into `EventBatcher`.
5. `EventBatcher` accumulates events per camera and flushes after `EVENT_BATCH_WINDOW_MS` (default 30s).
6. On flush, `notifyUsersForCamera()` loads all push subscriptions from SQLite, checks per-user camera preferences, and dispatches Web Push via `web-push`.
7. Push subscriptions and per-camera opt-out preferences are stored in `data/camera-events.db` (SQLite, WAL mode).
8. Push is silently disabled if `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, or `VAPID_SUBJECT` are missing.

## SQLite (Runtime-Portable Driver)

- `src/features/shared/server/sqlite/index.ts` exposes a single `openSqlite(path)` function that branches at runtime: **Node → `better-sqlite3`** (used by Vitest), **Bun → `bun:sqlite`** (production).
- Both branches expose the same `SqliteDatabase` interface (`prepare`, `exec`, `pragmaRead`, `pragmaWrite`, `close`).
- `better-sqlite3` is a devDependency (not bundled into the production Bun image).
- Do not run a Node dev process and a Bun production server concurrently against the same DB file — WAL/SHM file ownership differs between drivers.
- Default DB path: `data/camera-events.db` (relative to the working directory).
