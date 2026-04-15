# Spec: Web Push Notifications

## Intent Description

Add Web Push notification infrastructure to the existing PWA so the app can deliver push messages to subscribed users across multiple devices, even when the browser tab is closed. This iteration focuses on the **plumbing**: VAPID key management (with graceful degradation when keys are absent), client-side subscription lifecycle, server-side subscription persistence in SQLite, push delivery via the `web-push` library, and service worker push/notification-click handling. A manual "Send Test Notification" button on the Settings page verifies the end-to-end flow. Push payloads include a `url` field so future notification triggers can route to specific pages (camera events, event detail); for now test notifications route to the home page. The SQLite schema also includes a `push_notification_preferences` table to support per-category and per-resource opt-out (e.g., muting a specific camera) in a future slice — no preferences UI or filtering logic is included here. Actual notification triggers (MQTT-driven, scheduled, etc.) and preference management UI are explicitly **out of scope**.

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

## Architecture Specification

### Components

| Component | Location | Responsibility |
|---|---|---|
| VAPID key config | `.env` + `src/server/push.ts` | Load VAPID keys from env vars; export `isPushEnabled` flag; log warning+instructions if missing |
| Push subscription API | `src/routes/api/push/subscribe.ts`, `unsubscribe.ts`, `test.ts`, `vapid-public-key.ts` | REST endpoints: POST subscribe, POST unsubscribe, POST test, GET vapid-public-key |
| Subscription storage | `src/server/push-store.ts` | SQLite-backed store with two tables (see schema below). Initializes tables on first access. |
| SQLite database | `data/camera-events.db` (Docker volume-mounted) | Single SQLite file for all app persistence |
| `web-push` integration | `src/server/push.ts` | Wraps `web-push` library: `sendNotification()`, VAPID config, handles 410 cleanup |
| SW push handler | `src/sw.ts` | `push` event: parse payload, show notification. `notificationclick` event: open/focus app, navigate to payload `url` |
| Client subscription hook | `src/hooks/usePushSubscription.ts` | React hook: permission state, subscribe/unsubscribe, calls API, exposes `isPushSupported` |
| Settings UI section | `src/pages/settings/SettingsPage.tsx` | New "Notifications" section: enable/disable, test button, status messages |

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT    NOT NULL,
  endpoint      TEXT    NOT NULL,
  p256dh        TEXT    NOT NULL,
  auth          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS push_notification_preferences (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT    NOT NULL,
  category      TEXT    NOT NULL,
  resource_id   TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category, resource_id)
);
```

- `user_id` — Google OAuth subject ID (stable across sessions/devices)
- `push_subscriptions` — one row per device per user; upsert on `(user_id, endpoint)`
- `push_notification_preferences` — opt-out rows. `category` is e.g. `"camera_event"`, `"system"`. `resource_id` scopes to a specific resource (e.g. camera name `"gavl_vest"`); NULL means the entire category. `enabled = 0` means opted out.

### Interfaces

- **GET `/api/push/vapid-public-key`** — Returns `{ publicKey: string }` or 503 if not configured.
- **POST `/api/push/subscribe`** — Body: `{ endpoint, keys: { p256dh, auth } }`. Authenticated. Upserts subscription for the user.
- **POST `/api/push/unsubscribe`** — Body: `{ endpoint }`. Authenticated. Deletes matching subscription.
- **POST `/api/push/test`** — No body. Authenticated. Sends test push to all of the user's subscriptions. Returns `{ sent: number }`.

### Push Payload Format

```json
{
  "title": "Test Notification",
  "body": "Push notifications are working!",
  "url": "/"
}
```

The `url` field enables future notification types (e.g., `/camera-events/{id}`) without changing the SW handler.

### Dependencies

- **New:** `web-push` (server-side push delivery), `better-sqlite3` (SQLite driver)
- **Existing:** Serwist service worker, TanStack Start server functions, session auth (Google OAuth user ID)

### Constraints

- VAPID keys are environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), never committed
- SQLite file lives at `data/camera-events.db`; Docker Compose mounts `data/` as a named volume
- Subscriptions keyed by Google OAuth user ID, not session ID
- Push payload always includes `url` for forward compatibility
- SW push/notificationclick handlers must not interfere with existing Serwist caching
- No preferences UI or filtering logic in this slice — only the schema

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|---|---|
| AC-1 | Subscription lifecycle | User can enable and disable push notifications from Settings; subscription is created/removed both client-side and in SQLite |
| AC-2 | Multi-device | A user with two subscribed devices receives test notifications on both |
| AC-3 | Duplicate subscription | Re-subscribing from the same device upserts rather than duplicates |
| AC-4 | Test notification delivery | "Send Test Notification" delivers a visible system notification within 5 seconds |
| AC-5 | Notification click routing | Clicking the test notification opens/focuses the app at the URL from the payload (`/`) |
| AC-6 | Permission denied handling | If the user denies the browser prompt, UI reflects the blocked state without retrying |
| AC-7 | Unsupported browser | On browsers without Push API, notification controls are hidden with an info message |
| AC-8 | Missing VAPID keys | Server starts, logs a warning with setup instructions, push endpoints return 503, Settings shows "not available" |
| AC-9 | Expired subscription cleanup | Server removes subscriptions that return 410 from the push service |
| AC-10 | No SW regression | Existing precache, runtime caching, and navigation preload work after SW changes |
| AC-11 | SQLite persistence | Subscriptions survive server restart (Docker volume mount) |
| AC-12 | Preferences schema | `push_notification_preferences` table is created on startup with columns for category, resource_id, and enabled. No preferences UI or filtering logic in this slice |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
