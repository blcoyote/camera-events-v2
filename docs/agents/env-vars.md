# Environment variables

| Variable                   | Required          | Purpose                                                                                                   |
| -------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`           | Yes               | Cookie encryption key (≥32 chars)                                                                         |
| `GOOGLE_CLIENT_ID`         | Yes               | Google OAuth client ID                                                                                    |
| `GOOGLE_CLIENT_SECRET`     | Yes               | Google OAuth client secret                                                                                |
| `ADMIN_EMAILS`             | No                | Comma-separated emails promoted to `users.is_admin` at sign-in; unset/empty means no admins (fail-closed) |
| `FRIGATE_URL`              | Yes (unless mock) | Base URL of Frigate instance (e.g. `http://frigate:5000`)                                                 |
| `FRIGATE_MOCK`             | No                | Set to `true` to use mock Frigate client                                                                  |
| `MQTT_URL`                 | No                | MQTT broker URL (e.g. `mqtt://rabbitmq:1883`); push/cache-invalidation disabled if unset                  |
| `VAPID_PUBLIC_KEY`         | No                | Web Push VAPID public key; push disabled if any VAPID var missing                                         |
| `VAPID_PRIVATE_KEY`        | No                | Web Push VAPID private key                                                                                |
| `VAPID_SUBJECT`            | No                | Push contact (`mailto:...`); push disabled if any VAPID var missing                                       |
| `APP_URL`                  | No                | Public app URL for OAuth redirect; falls back to request origin in dev                                    |
| `EVENT_BATCH_WINDOW_MS`    | No                | Window for follow-up (patch) pushes per camera (default 30000ms)                                          |
| `EVENT_BURST_GAP_MS`       | No                | Quiet gap before a camera alerts again instead of patching (default 600000ms)                             |
| `APPLE_UPDATE_INTERVAL_MS` | No                | Min spacing between patch pushes to one Apple endpoint; 0 disables (default 300000ms)                     |
| `CAMERA_OFFLINE_THRESHOLD` | No                | Consecutive zero-`camera_fps` `frigate/stats` readings before a camera is flagged offline (default 10)    |

Generate VAPID keys with: `npx web-push generate-vapid-keys`
