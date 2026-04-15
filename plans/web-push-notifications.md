# Plan: Web Push Notifications

**Created**: 2026-04-15
**Branch**: feat/storybook-stories
**Status**: implemented

## Goal

Add Web Push notification infrastructure to the existing PWA — VAPID key config with graceful degradation, SQLite-backed subscription and preferences storage, `web-push` server integration, service worker push/notificationclick handlers, a `usePushSubscription` React hook, push API endpoints, and a Notifications section on the Settings page with enable/disable and test controls. This delivers the end-to-end push plumbing so that future slices can wire up real notification triggers (MQTT camera events, etc.).

## Acceptance Criteria

- [ ] AC-1: User can enable and disable push notifications from Settings; subscription is created/removed both client-side and in SQLite
- [ ] AC-2: A user with two subscribed devices receives test notifications on both
- [ ] AC-3: Re-subscribing from the same device upserts rather than duplicates
- [ ] AC-4: "Send Test Notification" delivers a visible system notification within 5 seconds
- [ ] AC-5: Clicking the test notification opens/focuses the app at the URL from the payload (`/`)
- [ ] AC-6: If the user denies the browser prompt, UI reflects the blocked state without retrying
- [ ] AC-7: On browsers without Push API, notification controls are hidden with an info message
- [ ] AC-8: Server starts without VAPID keys, logs a warning with setup instructions, push endpoints return 503, Settings shows "not available"
- [ ] AC-9: Server removes subscriptions that return 410 from the push service
- [ ] AC-10: Existing precache, runtime caching, and navigation preload work after SW changes
- [ ] AC-11: Subscriptions survive server restart (Docker volume mount)
- [ ] AC-12: `push_notification_preferences` table is created on startup with columns for category, resource_id, and enabled

## User-Facing Behavior

```gherkin
Feature: Web Push Notification Support

  Background:
    Given the user is authenticated
    And the browser supports the Push API
    And VAPID keys are configured on the server

  # --- Subscription lifecycle ---

  Scenario: User enables push notifications
    Given push notifications are not yet enabled
    When the user navigates to the Settings page
    And taps the "Enable Notifications" button
    Then the browser displays a permission prompt
    When the user grants notification permission
    Then a push subscription is created
    And the subscription is sent to the server linked to the user's identity
    And the UI shows notifications are enabled

  Scenario: User enables push on a second device
    Given the user has push notifications enabled on another device
    When the user enables push notifications on this device
    Then a new subscription is stored alongside the existing one
    And both devices can receive push notifications independently

  Scenario: Same device re-subscribes
    Given push notifications are already enabled on this device
    When the push subscription endpoint has changed (e.g. browser regenerated it)
    And the user taps "Enable Notifications"
    Then the old subscription is replaced with the new one
    And only the current subscription is stored for this device

  Scenario: User disables push notifications
    Given push notifications are enabled
    When the user taps "Disable Notifications" on the Settings page
    Then the push subscription is unsubscribed on the client
    And the subscription is removed from the server
    And the UI shows notifications are disabled

  # --- Test notification ---

  Scenario: User sends a test notification
    Given push notifications are enabled
    When the user taps "Send Test Notification" on the Settings page
    Then the server sends a push message to all subscriptions for the current user
    And the push payload includes url "/"
    And a system notification appears with the title "Test Notification"
    And the notification body reads "Push notifications are working!"

  Scenario: User taps a received notification
    Given a push notification is visible
    And the notification payload contains a url
    When the user taps the notification
    Then the app opens or focuses
    And navigates to the url from the payload

  # --- Negative / edge cases ---

  Scenario: Browser does not support Push API
    Given the browser does not support the Push API
    When the user navigates to the Settings page
    Then the notification controls are hidden
    And an informational message reads "Push notifications are not supported in this browser"

  Scenario: VAPID keys are not configured
    Given VAPID keys are not set in environment variables
    When the server starts
    Then the server logs a warning with instructions to configure VAPID keys
    And push-related API endpoints return 503 with message "Push notifications are not configured"
    When the user navigates to the Settings page
    Then the notification controls are hidden
    And a message reads "Push notifications are not available on this server"

  Scenario: User denies the notification permission prompt
    Given push notifications are not yet enabled
    When the user taps "Enable Notifications"
    And the browser displays a permission prompt
    And the user denies the permission
    Then no subscription is created
    And the UI shows that notifications are blocked
    And a hint explains how to unblock notifications in browser settings

  Scenario: Permission was previously blocked at browser level
    Given the browser notification permission is "denied"
    When the user navigates to the Settings page
    Then the enable button is disabled
    And a message explains notifications are blocked in browser settings

  Scenario: Server is unreachable when subscribing
    Given the user grants notification permission
    When the subscription cannot be sent to the server
    Then the client unsubscribes the local push subscription
    And an error message is shown: "Could not enable notifications. Please try again."

  Scenario: Push subscription expires or becomes invalid
    Given a push notification is sent to an expired subscription
    When the server receives a 410 Gone response
    Then the server removes that subscription from storage

  # --- Preferences schema ---

  Scenario: Notification preferences table exists
    Given the server has started with SQLite storage
    Then the push_notification_preferences table exists
    And it supports per-category and per-resource opt-out rows
```

## Steps

### Step 1: Install dependencies and configure VAPID environment variables

**Complexity**: trivial
**Task**: Install `web-push` and `better-sqlite3` (+ `@types/better-sqlite3`). Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to `.env.example` with generation instructions (include `npx web-push generate-vapid-keys` command). Add `data/` to `.gitignore` and `.dockerignore`.
**Files**: `package.json`, `.env.example`, `.gitignore`, `.dockerignore`
**Commit**: `feat(push): install web-push and better-sqlite3, add VAPID env vars to .env.example`

### Step 2: SQLite push store with subscription and preferences tables

**Complexity**: complex
**RED**: Write tests for `push-store.ts`:
- `saveSubscription` upserts on `(user_id, endpoint)` — inserting a new subscription, then saving again with the same endpoint updates rather than duplicates
- `getSubscriptionsByUserId` returns all subscriptions for a user (multi-device)
- `removeSubscription` deletes by user_id + endpoint
- `removeSubscriptionByEndpoint` deletes by endpoint alone (for 410 cleanup)
- Both tables are created on init
- Preferences table exists with correct columns (category, resource_id, enabled)
- **Persistence**: close and re-open the DB, verify rows survive (AC-11)
**GREEN**: Implement `src/server/push-store.ts` — lazy-init SQLite at `data/camera-events.db`, create both tables with `CREATE TABLE IF NOT EXISTS`, export CRUD functions. Use a temp directory in tests to avoid polluting the real data dir.
**REFACTOR**: Extract DB path to a constant. Ensure WAL mode is enabled for concurrent reads.
**Files**: `src/server/push-store.ts`, `src/server/push-store.test.ts`
**Commit**: `feat(push): add SQLite push subscription and preferences store`

### Step 3: VAPID config and web-push wrapper with graceful degradation

**Complexity**: standard
**RED**: Write tests for `push.ts`: `isPushEnabled` returns `false` when VAPID keys missing, returns `true` when set. `sendPushNotification` throws if push disabled. `sendPushNotification` calls `web-push` with correct payload shape. Verify warning is logged when keys missing.
**GREEN**: Implement `src/server/push.ts` — read `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` from env. Export `isPushEnabled`, `getVapidPublicKey()`, and `sendPushNotification(subscription, payload)`. On import, if keys missing, log warning with instructions. Handle 410 responses by calling `removeSubscriptionByEndpoint`.
**REFACTOR**: None needed.
**Files**: `src/server/push.ts`, `src/server/push.test.ts`
**Commit**: `feat(push): add VAPID config and web-push wrapper with graceful degradation`

### Step 4: Push API endpoints (vapid-public-key, subscribe, unsubscribe, test)

**Complexity**: complex
**RED**: Write tests for each endpoint:
- GET `/api/push/vapid-public-key` returns `{ publicKey }` when configured, 503 when not
- POST `/api/push/subscribe` upserts subscription for authenticated user, returns 401 if unauthenticated
- POST `/api/push/unsubscribe` removes subscription, returns 401 if unauthenticated
- POST `/api/push/test` sends notification to all user subscriptions, returns `{ sent: number }`, returns 401/503 appropriately
**GREEN**: Implement four route files under `src/routes/api/push/`. Follow the existing pattern from `src/routes/api/events/$id/clip.ts` — use `useSession` for auth, call push-store and push.ts functions.
**REFACTOR**: Extract shared auth check into a helper if repeated boilerplate is excessive.
**Files**: `src/routes/api/push/vapid-public-key.ts`, `src/routes/api/push/subscribe.ts`, `src/routes/api/push/unsubscribe.ts`, `src/routes/api/push/test.ts`, `src/routes/api/push/-push-endpoints.test.ts`
**Commit**: `feat(push): add push API endpoints (subscribe, unsubscribe, test, vapid-public-key)`

### Step 5: Service worker push and notificationclick handlers

**Complexity**: standard
**RED**: Extract push handler logic into pure, testable functions in `src/sw-push-handlers.ts`: `parsePushPayload(data)` parses JSON with fallback defaults for malformed payloads, `buildNotificationOptions(payload)` returns the showNotification options, `getNotificationClickUrl(notification)` extracts `url` from notification data. Write tests for these pure functions (no SW globals needed).
**GREEN**: Implement `src/sw-push-handlers.ts` with the pure functions. Add `push` event listener in `src/sw.ts` that calls `parsePushPayload` + `self.registration.showNotification(...)`. Add `notificationclick` listener that calls `getNotificationClickUrl` + `clients.openWindow(url)` or focus existing client and navigate. Verify existing `serwist.addEventListeners()` call is preserved.
**REFACTOR**: None needed — keep SW file minimal, logic in testable helpers.
**Manual verification (AC-10)**: After building, confirm SW registers, precache works, and navigation preload still functions.
**Files**: `src/sw.ts`, `src/sw-push-handlers.ts`, `src/sw-push-handlers.test.ts`
**Commit**: `feat(push): add push and notificationclick handlers to service worker`

### Step 6: `usePushSubscription` React hook

**Complexity**: standard
**RED**: Write tests for the hook using `vi.stubGlobal` to mock browser APIs (`navigator.serviceWorker`, `PushManager`, `Notification.permission`) and `vi.fn()` to mock fetch calls:
- Returns `isSupported: false` when Push API unavailable
- Returns correct `permissionState` values (`default`, `granted`, `denied`)
- **Distinct test for `denied` (previously blocked)**: returns `permissionState: 'denied'` and `isSubscribed: false` when `Notification.permission === 'denied'` on page load (BDD "Permission was previously blocked")
- `subscribe()` calls PushManager and POST `/api/push/subscribe`
- `unsubscribe()` calls PushManager and POST `/api/push/unsubscribe`
- Rolls back local subscription on server error (mock fetch to reject)
- Exposes `isLoading: true` during async operations, `false` when idle
**GREEN**: Implement `src/hooks/usePushSubscription.ts` — React hook using `useState` and `useEffect`. Checks `'PushManager' in window` for support. Fetches VAPID public key from `/api/push/vapid-public-key`. Exposes: `isSupported`, `isPushEnabled` (server has VAPID), `permissionState`, `isSubscribed`, `isLoading`, `subscribe()`, `unsubscribe()`, `sendTest()`, `error`.
**REFACTOR**: None needed.
**Files**: `src/hooks/usePushSubscription.ts`, `src/hooks/usePushSubscription.test.ts`
**Commit**: `feat(push): add usePushSubscription React hook`

### Step 7: Settings page Notifications section

**Complexity**: standard
**RED**: Write tests for the Notifications section rendering:
- Shows "not supported" message when Push API absent (BDD "Browser does not support Push API")
- Shows "not available" when server returns 503 (BDD "VAPID keys are not configured")
- Shows enable button when permission is `default` (BDD "User enables push notifications")
- Shows disable + test buttons when subscribed (BDD "User sends a test notification")
- Shows blocked message with browser-specific unblock hint when permission is `denied` — **both** the "just denied" case (AC-6) and the "previously blocked" case (enable button disabled)
- Buttons are disabled with spinner during `isLoading` (prevents double-tap)
- Test button shows inline success feedback with device count ("Test sent to N device(s)") in an `aria-live="polite"` region
**GREEN**: Add a "Notifications" `<section>` to `src/pages/settings/SettingsPage.tsx` below the existing "Camera Events" section. Use `usePushSubscription` hook. Render conditionally based on `isSupported`, `isPushEnabled`, `permissionState`, `isSubscribed`, and `isLoading`. Include enable/disable button and "Send Test Notification" button. Use `aria-live="polite"` for status messages. Blocked-permission hint includes instructions for Chrome and Safari.
**REFACTOR**: Extract notification section into a `NotificationSettings` component if the SettingsPage grows too large.
**Files**: `src/pages/settings/SettingsPage.tsx`, `src/routes/_authenticated/-settings.test.ts`
**Commit**: `feat(push): add notifications section to Settings page`

### Step 8: Docker Compose volume mount and .env.example update

**Complexity**: trivial
**Task**: Add a named volume `app-data` to `docker-compose.yml` mapped to `/app/data` in the app container. Add `better-sqlite3` to `pnpm.onlyBuiltDependencies`. Verify `.env.example` has VAPID key generation instructions.
**Files**: `docker-compose.yml`, `package.json`
**Commit**: `feat(push): add Docker volume for SQLite persistence`

### Step 9: Settings page Storybook story update

**Complexity**: trivial
**Task**: Update `src/pages/settings/SettingsPage.stories.tsx` to include stories for notification states: NotificationsEnabled, NotificationsDisabled, NotificationsUnsupported, NotificationsBlocked, PushNotConfigured.
**Files**: `src/pages/settings/SettingsPage.stories.tsx`
**Commit**: `feat(storybook): add notification state stories to SettingsPage`

## Complexity Classification

| Rating | Criteria | Review depth |
|--------|----------|--------------|
| `trivial` | Single-file rename, config change, typo fix, documentation-only | Skip inline review; covered by final `/code-review` |
| `standard` | New function, test, module, or behavioral change within existing patterns | Spec-compliance + relevant quality agents |
| `complex` | Architectural change, security-sensitive, cross-cutting concern, new abstraction | Full agent suite including opus-tier agents |

## Pre-PR Quality Gate

- [ ] All tests pass (unit + storybook)
- [ ] Type check passes
- [ ] Linter passes
- [ ] `/code-review` passes
- [ ] `pnpm build` succeeds
- [ ] Manual verification: enable notifications, send test, receive notification, click to open app
- [ ] Manual verification (AC-10): after SW changes, confirm precache, runtime caching, and navigation preload still work
- [ ] Manual verification (AC-2): test notification received on two devices (if available; otherwise note as tested on single device)

## Risks & Open Questions

- **`better-sqlite3` native addon**: Requires native compilation. In Docker, the multi-stage build must include build tools (python3, make, g++) or use a prebuilt binary. If native compilation proves problematic, `sql.js` (pure WASM) is the fallback — same API surface, no native deps, slightly slower.
- **Service worker update propagation**: After deploying SW changes, existing clients need to pick up the new SW with push handlers. The existing `skipWaiting: true` + `clientsClaim: true` config handles this — new SW activates immediately. However, the first push after deploy may arrive before the new SW is active. This is an acceptable edge case for a test notification feature.
- **PushManager.subscribe in tests**: Unit tests for `usePushSubscription` will need to mock `navigator.serviceWorker`, `PushManager`, and `Notification.permission`. These are browser APIs not available in jsdom/vitest by default. Tests will use `vi.stubGlobal` to provide mocks.
- **SQLite in serverless**: The current architecture (TanStack Start on Node.js) runs as a long-lived server process, so SQLite is appropriate. If the deployment model changes to serverless/edge, the SQLite store would need to be swapped for a remote database. The store interface is simple enough that this swap would be localized to `push-store.ts`.
- **VAPID key generation**: Users need to generate VAPID keys before push works. The `.env.example` will include the `npx web-push generate-vapid-keys` command. A future improvement could auto-generate and persist keys on first startup, but that's out of scope for this slice.
- **TanStack Start route POST bodies**: Existing API routes only handle GET. POST routes need to verify the handler signature exposes the raw `Request` object for `request.json()` body parsing. Step 4 should validate this during implementation and document the pattern.
- **Route tree regeneration**: Adding files under `src/routes/api/push/` will trigger TanStack route tree regeneration. Per CLAUDE.md, run `pnpm dev` after creating route files — do not run `npx tsr generate`.

## Plan Review Summary

Four review perspectives were consulted. Two approved; two flagged revisions.

**Addressed blockers (Architect):**
- **Device identity for upsert (AC-3)**: The architect flagged that `(user_id, endpoint)` upsert doesn't handle endpoint regeneration on the same device. After analysis: when a browser regenerates an endpoint, the old endpoint becomes invalid and will 410 on next push attempt, triggering cleanup (AC-9). The new endpoint is saved as a new row. The net effect is correct — only valid subscriptions remain. A `device_id` adds complexity without material benefit since 410 cleanup is already specified. No change needed.
- **SW handler testability**: Resolved by extracting push handler logic into pure functions in `src/sw-push-handlers.ts` (Step 5 revised). SW file stays thin; logic is testable in Node/Vitest.

**Addressed blockers (Acceptance Test Critic):**
- **AC-10 no automated test**: Added explicit manual verification step inside Step 5 and Pre-PR Quality Gate. SW caching behavior is inherently integration/manual — no unit test can verify Serwist precache works.
- **AC-11 no persistence test**: Added close-and-reopen DB test to Step 2 RED phase.
- **"Previously blocked" vs "just denied" distinction**: Added explicit separate test case in Step 7 and Step 6 RED for `Notification.permission === 'denied'` on page load.

**Addressed warnings (UX Critic):**
- **Loading state / double-tap prevention**: Added `isLoading` flag to hook (Step 6) and button disabled state (Step 7).
- **Inline success feedback for test**: Added "Test sent to N device(s)" inline message using `{ sent }` response (Step 7).
- **Blocked-permission hint specificity**: Step 7 now specifies browser-specific instructions for Chrome and Safari.

**Addressed warnings (Strategic Critic):**
- **POST body parsing pattern**: Added to Risks & Open Questions — must verify TanStack Start handler signature for POST.
- **Dockerfile update for `better-sqlite3`**: Noted — if native compilation is problematic during implementation, switch to `sql.js`. Decision deferred to Step 1 implementation.
- **`GET /api/push/vapid-public-key` intentionally unauthenticated**: Confirmed correct — VAPID public key is public by design.

**Noted for future consideration:**
- `sql.js` (WASM) as default over `better-sqlite3` (native) to avoid build complexity — evaluate during Step 1
- `aria-live="polite"` regions for all notification status messages — consistent with existing SettingsPage pattern
