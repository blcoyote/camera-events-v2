---
name: view-app
description: Launch the app and look at a page in a real browser (Playwright) as a signed-in user, with mock Frigate data. Use when asked to run, show, open, or screenshot the app, to verify a UI change visually, or to run the e2e tests. Works locally and in Claude Code cloud sessions.
---

# Viewing the app

No real Google login or Frigate is needed: `dev:e2e` runs the dev server with
mock Frigate data (`FRIGATE_MOCK=true`), a fallback `SESSION_SECRET`, and the
dev-only `/api/test-auth` sign-in route (`E2E_TEST=true`).

## 1. Start the server (background)

```bash
bun run dev:e2e     # run_in_background; ready when http://localhost:3000 responds
```

Wait for readiness instead of sleeping:
`until curl -so /dev/null http://localhost:3000; do sleep 1; done`

If port 3000 is already taken by a plain `bun run dev` (no `E2E_TEST`), sign-in
returns 403. Stop that server or ask the user; don't start a second server on
another port without telling them.

## 2. Screenshot a page

```bash
bun run screenshot /cameras /tmp/<scratchpad>/cameras.png            # desktop 1280×900
bun run screenshot /settings /tmp/<scratchpad>/settings.png --mobile  # iPhone viewport
```

Save screenshots in your scratchpad directory, not the repo. Then **Read the PNG**
to actually look at it. The script signs in as the test user, waits for network
idle, saves a full-page shot and prints any browser console errors (403s from
admin-only endpoints are expected; the test user is not an admin; check the rest
errors). Routes: `/`, `/cameras`, `/camera-events`, `/favorites`, `/settings`,
`/live/<camera>`, `/camera-events/<eventId>`; mock cameras are `backyard`, `driveway`,
`front_door`, `front_porch`, `garage`, `side_gate`.

For interactions (clicks, dark mode, drag) write a throwaway Playwright script
in the scratchpad modelled on `scripts/screenshot.mjs`, signing in via
`/api/test-auth?redirect=<path>` first. Wait for hydration before clicking (see
the `toPass` retry in `tests/e2e/cameras-reorder.spec.ts`).

## 3. E2E tests

`bun run test:e2e` starts `dev:e2e` itself (or reuses a running one). Specs
live in `tests/e2e/`. Tests use English accessible names, so update them when
UI copy in `messages/en.json` changes.

## Troubleshooting

- `Executable doesn't exist ... ms-playwright`: run `bunx playwright install chromium`
  (in the cloud: `bunx playwright install --with-deps chromium`). The
  SessionStart hook normally does this.
- Stop the background server when you're done.
