# Deployment & Environment

## Deployment

- **Runtime:** Bun (Nitro preset `bun`). Production entry: `bun run .output/server`.
- **Docker:** multi-stage `Dockerfile`. `docker-compose.yml` wires the app, RabbitMQ (MQTT + management plugins), and Traefik for TLS.
- **Persistent volumes:** `ce-v2-data` (SQLite DB), `rabbitmq-data` (broker state).
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP) are applied via Traefik middleware labels.

## Environment Variables

| Variable                | Required          | Purpose                                                                                  |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `SESSION_SECRET`        | Yes               | Cookie encryption key (≥32 chars)                                                        |
| `GOOGLE_CLIENT_ID`      | Yes               | Google OAuth client ID                                                                   |
| `GOOGLE_CLIENT_SECRET`  | Yes               | Google OAuth client secret                                                               |
| `FRIGATE_URL`           | Yes (unless mock) | Base URL of Frigate instance (e.g. `http://frigate:5000`)                                |
| `FRIGATE_MOCK`          | No                | Set to `true` to use mock Frigate client                                                 |
| `MQTT_URL`              | No                | MQTT broker URL (e.g. `mqtt://rabbitmq:1883`); push/cache-invalidation disabled if unset |
| `VAPID_PUBLIC_KEY`      | No                | Web Push VAPID public key; push disabled if any VAPID var missing                        |
| `VAPID_PRIVATE_KEY`     | No                | Web Push VAPID private key                                                               |
| `VAPID_SUBJECT`         | No                | Push contact (`mailto:...`); push disabled if any VAPID var missing                      |
| `APP_URL`               | No                | Public app URL for OAuth redirect; falls back to request origin in dev                   |
| `EVENT_BATCH_WINDOW_MS` | No                | Push notification batching window (default 30000ms)                                      |

Generate VAPID keys with: `npx web-push generate-vapid-keys`
