# Environment variables

| Variable                      | Required          | Purpose                                                                                                                     |
| ----------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`              | Yes               | Cookie encryption key (≥32 chars)                                                                                           |
| `GOOGLE_CLIENT_ID`            | Yes               | Google OAuth client ID                                                                                                      |
| `GOOGLE_CLIENT_SECRET`        | Yes               | Google OAuth client secret                                                                                                  |
| `ADMIN_EMAILS`                | No                | Comma-separated emails promoted to `users.is_admin` at sign-in; unset/empty means no admins (fail-closed)                   |
| `FRIGATE_URL`                 | Yes (unless mock) | Base URL of Frigate instance (e.g. `http://frigate:5000`)                                                                   |
| `FRIGATE_MOCK`                | No                | Set to `true` to use mock Frigate client                                                                                    |
| `MQTT_URL`                    | No                | MQTT broker URL (e.g. `mqtt://rabbitmq:1883`); push/cache-invalidation disabled if unset                                    |
| `VAPID_PUBLIC_KEY`            | No                | Web Push VAPID public key; push disabled if any VAPID var missing                                                           |
| `VAPID_PRIVATE_KEY`           | No                | Web Push VAPID private key                                                                                                  |
| `VAPID_SUBJECT`               | No                | Push contact (`mailto:...`); push disabled if any VAPID var missing                                                         |
| `APP_URL`                     | No                | Public app URL for OAuth redirect; falls back to request origin in dev                                                      |
| `EVENT_BATCH_WINDOW_MS`       | No                | Window for follow-up (patch) pushes per camera (default 30000ms)                                                            |
| `EVENT_BURST_GAP_MS`          | No                | Quiet gap before a camera alerts again instead of patching (default 600000ms)                                               |
| `APPLE_UPDATE_INTERVAL_MS`    | No                | Min spacing between patch pushes to one Apple endpoint; 0 disables (default 300000ms)                                       |
| `CAMERA_OFFLINE_THRESHOLD`    | No                | Consecutive zero-`camera_fps` `frigate/stats` readings before a camera is flagged offline (default 10)                      |
| `LOG_LEVEL`                   | No                | `debug`\|`info`\|`warn`\|`error` (default `info`); server logs are JSON lines on stdout                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No                | OTLP collector base URL (e.g. `http://alloy:4318`); metrics are pushed every 30s, and unset means metrics are off           |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No                | OTLP wire format; compose sets `http/json` (the exporter in use sends JSON)                                                 |
| `OTEL_SERVICE_NAME`           | No                | Metrics `service.name` (`camera-events-v2` in both stacks)                                                                  |
| `OTEL_RESOURCE_ATTRIBUTES`    | No                | Resource attributes; compose sets `service.instance.id=prod,deployment.environment.name=prod` (test stack: `test` for both) |

`GITHUB_RUNNER_REGISTRATION_TOKEN` (runner Portainer stack only, not read by the app): one-hour runner registration token from `gh api -X POST repos/blcoyote/camera-events-v2/actions/runners/registration-token --jq .token`. The `github-runner` compose service uses it only on first start to register the self-hosted release runner; see README, "Release runner".

Generate VAPID keys with: `npx web-push generate-vapid-keys`
