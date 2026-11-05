# Camera Events

A self-hosted PWA for browsing and monitoring [Frigate NVR](https://frigate.video/) events. Receives live motion events from Frigate over MQTT and pushes notifications to subscribed devices (iOS, Android, desktop). Built as a TanStack Start SSR app with offline-capable service worker caching.

## Features

- **Live event feed** — paginated browsing of Frigate events, with label/camera filters and thumbnail previews.
- **Event detail view** — clip playback, snapshot, and one-tap download of the clip/snapshot for sharing.
- **Camera overview** — per-camera status and livestream access.
- **Web Push notifications** — subscribe from any device; MQTT events are batched per camera and delivered as push notifications with deep links straight to the event. Per-camera opt-in controls.
- **Google SSO login** with session cookies; route-level and server-function-level authentication.
- **PWA-first** — installable on iOS (Safari standalone) and Android (Chrome), with a Serwist-backed service worker for offline assets and push handling.
- **Mock Frigate backend** for local development without a live NVR.

## Tech Stack

- **Runtime:** Bun, TanStack Start (SSR), React 19, Vite 8
- **Routing:** TanStack Router (file-based)
- **Styling:** Tailwind CSS v4
- **Data:** better-sqlite3 (push subscriptions + preferences), MQTT (Frigate event stream)
- **Auth:** Google OAuth via Arctic, encrypted session cookies
- **Push:** web-push (VAPID), Serwist service worker
- **Testing:** Vitest, Testing Library, Playwright browser mode
- **Package manager:** Bun (enforced via the `preinstall: npx only-allow bun` script)

## Architecture

- **Feature-sliced** — each feature owns its own folder under [src/features/](src/features/) with its components, hooks, server logic, and types. Features never import from each other; genuinely shared code lives in [src/features/shared/](src/features/shared/).
- **Server functions & API routes** — TanStack Start `createServerFn` handlers and file-based API routes under [src/routes/api/](src/routes/api/). All protected server functions call `requireSession()` — route guards don't protect direct HTTP access to the function hash.
- **Event pipeline** — Frigate publishes events to RabbitMQ (MQTT), the app subscribes via [src/features/push-notifications/server/mqtt.ts](src/features/push-notifications/server/mqtt.ts), batches per camera, and dispatches web push notifications through the stored subscriptions.
- **Feature specs** live in [docs/specs/](docs/specs/) — each significant feature has a design doc documenting intent, approach, and trade-offs.

## Getting Started

### Prerequisites

- Bun (see [bun.sh](https://bun.sh) — `npm`/`pnpm` are blocked via `only-allow bun`)
- A Frigate instance reachable from the server (or use `FRIGATE_MOCK=true` for development)
- RabbitMQ with MQTT plugin (official `rabbitmq:4-management-alpine` image; config is inline in [docker-compose.yml](docker-compose.yml) `configs`)
- Google OAuth client (for login)
- VAPID keys (for push notifications — `npx web-push generate-vapid-keys`)

### Local Development

```bash
bun install
cp .env.example .env   # then fill in the values below
bun run dev
```

The dev server runs on http://localhost:3000. Route tree (`src/routeTree.gen.ts`) is regenerated automatically by the `tanstackStart()` Vite plugin — never run `npx tsr generate`, that's an unrelated destructive tool.

### Environment Variables

| Variable                                    | Purpose                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `APP_URL`                                   | Public URL of the app, used for OAuth redirect and cookie scope.        |
| `SESSION_SECRET`                            | Secret for encrypting the session cookie (32+ chars).                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials for `/api/auth/google/callback`.               |
| `FRIGATE_URL`                               | Base URL of the Frigate backend (e.g. `http://frigate:5000`).           |
| `FRIGATE_MOCK`                              | Set to `true` to use the in-memory mock Frigate client for development. |
| `MQTT_URL`                                  | MQTT broker URL (e.g. `mqtt://user:pass@rabbitmq:1883`).                |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`    | Web Push VAPID key pair.                                                |
| `VAPID_SUBJECT`                             | Contact URL or `mailto:` for push provider (e.g. `mailto:you@x.dk`).    |

Push notifications are silently disabled at startup if any VAPID variable is missing — a warning is logged.

## Scripts

```bash
bun run dev           # Start dev server on :3000
bun run build         # Production build (also generates routeTree + service worker)
bun run preview       # Serve the production build locally
bun run test          # Run Vitest once
bun run lint          # Biome lint
bun run format        # Biome format check
bun run check         # Biome format + lint --fix
bun run knip          # Unused-code report
```

## Testing

- Unit + integration tests with Vitest live alongside the code they test (`*.test.ts`).
- Tests run in jsdom by default; Playwright browser mode is available via `@vitest/browser`.

## Deployment

A multi-stage [Dockerfile](Dockerfile) produces a small runtime image that runs as a non-root user. [docker-compose.yml](docker-compose.yml) wires the app, RabbitMQ (with MQTT + management plugins), and Traefik for TLS via Let's Encrypt. App-specific security headers (CSP, Permissions-Policy, COOP/CORP) are applied via Traefik middleware labels. HSTS, X-Content-Type-Options, X-Frame-Options and Referrer-Policy come from the shared `secure-headers` middleware on Traefik's `websecure` entrypoint (portainer-traefik repo).

```bash
docker compose up -d --build
```

Persistent state:

- `ce-v2-data` — SQLite database (push subscriptions + per-camera preferences).
- `rabbitmq-data` — RabbitMQ broker state.

### Release runner

The release workflow ([promote-release.yml](.github/workflows/promote-release.yml)) runs on a self-hosted GitHub Actions runner: the `github-runner` service in [docker-compose.yml](docker-compose.yml). It is only in the prod compose file, so the test and prod stacks share one runner. It uses GitHub's official runner image and registers once, with a registration token that expires after one hour:

1. Run `gh api -X POST repos/blcoyote/camera-events-v2/actions/runners/registration-token --jq .token`.
2. Set the result as `GITHUB_RUNNER_REGISTRATION_TOKEN` on the prod stack and redeploy within the hour.
3. Check that the runner shows as idle under _Settings → Actions → Runners_.

The runner calls Portainer's stack webhooks over a dedicated Docker network, `portainer-webhooks`, which it shares only with the Portainer container. Create it once on the host before deploying the prod stack:

```bash
docker network create portainer-webhooks
docker network connect portainer-webhooks portainer
```

A container that is recreated (for example on a Portainer upgrade) loses networks added with `docker network connect`, so also add `portainer-webhooks` wherever Portainer's own container is defined. Set the repository secrets `TEST_WEBHOOK_URL` and `RELEASE_WEBHOOK_URL` to `http://portainer:9000/api/stacks/webhooks/<webhook-id>`, taking each ID from the stack's webhook URL in Portainer. Port 9000 is Portainer's plain-HTTP port; the request stays on the Docker network. If Portainer runs with `--http-disabled`, use port 9443 with a certificate the runner trusts instead.

The registration is kept on the `ce-v2-runner` volume, so restarts and redeploys don't need a new token. To register again (volume lost, runner removed in GitHub, or a new image tag), remove the volume and repeat the steps. The repository is public, so keep _Settings → Actions → General → "Require approval for all external contributors"_ on. Otherwise a pull request from a fork could run code on the runner. Rationale: [docs/memory/decisions/2026-11-05-self-hosted-release-runner.md](docs/memory/decisions/2026-11-05-self-hosted-release-runner.md).

## Conventions

Project-wide rules are in [CLAUDE.md](CLAUDE.md). Highlights:

- **Cross-platform first** — every feature must work on both iOS Safari and Android Chrome. Flag platform-specific quirks before silently working around them.
- **SSR-safe rendering** — never read `window` / `navigator` / `Notification` during render; defer to `useEffect` with safe defaults to avoid hydration mismatches.
- **Server function auth** — every `createServerFn` handler that touches protected data must `await requireSession()` as its first operation.
- **Tailwind canonical classes** — use built-in utilities (`text-(--var)`, `min-h-11`, `rounded-4xl`) over arbitrary-value syntax when an equivalent exists.
