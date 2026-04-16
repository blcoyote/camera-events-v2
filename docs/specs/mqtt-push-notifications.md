# Spec: MQTT-Driven Push Notifications with Per-Camera Opt-Out

## Intent Description

Connect the existing push notification infrastructure to Frigate MQTT events so users receive real-time push notifications when their cameras detect activity. When a `type: "new"` event arrives on the `frigate/events` MQTT topic, the server must push a notification to all subscribed users (respecting per-camera opt-out preferences). To reduce notification spam during camera bursts, events from the same camera are batched into a single notification using a 10-second per-camera window. The Settings page gains per-camera toggle switches so users can opt out of specific cameras. Preferences are stored in the existing `push_notification_preferences` SQLite table.

## User-Facing Behavior

```gherkin
Feature: MQTT-driven push notifications with per-camera opt-out

  Background:
    Given the user is authenticated
    And push notifications are enabled for the user
    And VAPID keys are configured on the server
    And the MQTT subscriber is connected to the broker

  # --- Single event notification ---

  Scenario: User receives notification for a new camera event
    Given the user has not opted out of any cameras
    When Frigate publishes a "new" event on frigate/events for camera "front_porch" with label "person"
    And no other events arrive from "front_porch" within 10 seconds
    Then the user receives a push notification
    And the notification title is "Front Porch"
    And the notification body contains "Person detected at" followed by the event time
    And the notification icon is "/logo192.png"
    And clicking the notification navigates to "/camera-events/{event-id}"

  # --- Batched notification ---

  Scenario: Multiple events from same camera are bundled
    Given the user has not opted out of any cameras
    When Frigate publishes 3 "new" events on frigate/events for camera "front_porch" within 10 seconds
    Then the user receives a single push notification (not 3)
    And the notification title is "Front Porch"
    And the notification body contains "3 new events" and a summary of detection labels
    And clicking the notification navigates to "/camera-events"

  Scenario: Events from different cameras are not bundled
    When Frigate publishes a "new" event for "front_porch" and a "new" event for "driveway" within 10 seconds
    Then the user receives 2 separate push notifications
    And each notification links to its respective event detail page

  # --- Per-camera batching independence ---

  Scenario: Per-camera 10-second windows are independent
    When a "new" event arrives for "front_porch" at t=0
    And a "new" event arrives for "driveway" at t=5
    Then "front_porch" flushes at t=10 and "driveway" flushes at t=15

  # --- Event type filtering ---

  Scenario: Only "new" events trigger notifications
    When Frigate publishes an "update" event on frigate/events
    Then no push notification is sent
    When Frigate publishes an "end" event on frigate/events
    Then no push notification is sent

  # --- Per-camera opt-out ---

  Scenario: User opts out of a camera
    Given the user navigates to the Settings page
    And notifications are enabled
    Then each camera appears with a toggle switch (all enabled by default)
    When the user toggles off "Driveway"
    Then the preference is saved to the database
    And future events from "driveway" do not trigger notifications for this user
    But events from other cameras still trigger notifications

  Scenario: User re-enables a camera
    Given the user has opted out of "driveway"
    When the user toggles "Driveway" back on
    Then the preference is updated in the database
    And future events from "driveway" trigger notifications again

  Scenario: New camera defaults to enabled
    Given a new camera "side_gate" is added to Frigate
    And the user has never set a preference for "side_gate"
    Then notifications for "side_gate" are enabled by default (opt-out model)

  Scenario: Per-camera preferences are per-user
    Given user A has opted out of "driveway"
    And user B has not opted out of any cameras
    When a "new" event arrives for "driveway"
    Then user B receives a notification
    But user A does not

  # --- Multi-device delivery ---

  Scenario: Notification is sent to all of a user's devices
    Given the user has push subscriptions on 2 devices
    When a new camera event arrives
    Then both devices receive the notification

  # --- Edge cases ---

  Scenario: No subscribed users
    When a "new" event arrives on frigate/events
    And no users have active push subscriptions
    Then no push notifications are sent (no error)

  Scenario: Push not configured
    Given VAPID keys are not set
    When a "new" event arrives on frigate/events
    Then no push notifications are sent (no error)

  Scenario: Malformed MQTT payload
    When a message arrives on frigate/events with invalid JSON
    Then the cache is still cleared
    But no push notification is sent (no error)
```

## Architecture Specification

### Data Flow

```
MQTT broker → frigate/events
    │
    ▼
onFrigateMessage()           ← parse payload, filter type:"new"
    │                          (cache cleared for ALL topics as before)
    ▼
EventBatcher.add(event)      ← per-camera buffer + 10s setTimeout
    │  (timer fires)
    ▼
notifyUsersForCamera()       ← for each subscribed user:
    │                          1. check per-camera preference
    │                          2. build payload (single vs bundled)
    │                          3. send to all user devices
    ▼
sendPushNotification()       ← existing web-push wrapper
```

### Components

| Component               | Location                                                 | Responsibility                                                                             |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| MQTT event parser       | `src/server/mqtt.ts` — `parseFrigateEvent()`             | Parse MQTT payload, filter `type: "new"`, extract event info                               |
| Event batcher           | `src/server/event-batcher.ts` — `EventBatcher`           | Per-camera in-memory buffer with configurable timer window                                 |
| Notification dispatcher | `src/server/push-notify.ts` — `notifyUsersForCamera()`   | Query subscribed users, filter by preferences, build payloads, send                        |
| Preference store        | `src/server/push-store.ts` (extended)                    | `getAllSubscribedUserIds`, `getDisabledCameras`, `isCameraEnabledForUser`, `setPreference` |
| Preferences API         | `src/routes/api/push/preferences.ts`                     | GET: camera list + prefs merged. PUT: update single preference                             |
| Settings UI             | `src/pages/settings/NotificationSettings.tsx` (extended) | Per-camera toggle switches below existing enable/disable section                           |

### Frigate MQTT Event Payload

```json
{
  "before": {
    /* previous state */
  },
  "after": {
    "id": "1713182400.123456-abc123",
    "camera": "front_porch",
    "label": "person",
    "sub_label": null,
    "start_time": 1713182400.123,
    "end_time": null,
    "score": 0.87,
    "top_score": 0.92,
    "zones": ["yard"],
    "has_clip": false,
    "has_snapshot": true
  },
  "type": "new"
}
```

Extracted to `FrigateEventInfo`: `{ id, camera, label, startTime }`.

### Interfaces

- **GET `/api/push/preferences`** — Authenticated. Returns `{ cameras: [{ name: string, enabled: boolean }, ...] }`. Merges `getCameras()` with user's disabled cameras from DB. Cameras without a preference row default to `enabled: true`.
- **PUT `/api/push/preferences`** — Authenticated. Body: `{ camera: string, enabled: boolean }`. Upserts into `push_notification_preferences` with `category = 'camera'`.

### Push Payload Format

**Single event:**

```json
{
  "title": "Front Porch",
  "body": "Person detected at 14:32",
  "url": "/camera-events/1713182400.123-abc",
  "icon": "/logo192.png"
}
```

**Bundled (3 events from same camera):**

```json
{
  "title": "Front Porch",
  "body": "3 new events — Person, Car, Dog at 14:32",
  "url": "/camera-events",
  "icon": "/logo192.png"
}
```

### Design Decisions

| Decision           | Resolution                                | Rationale                                                                                 |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Event types        | Only `type: "new"` triggers notifications | Prevents repeat notifications for the same event                                          |
| Batching scope     | Per-camera 10-second windows              | Users can opt out of individual cameras; cross-camera bundling would complicate filtering |
| Batching state     | In-memory `Map` + `setTimeout`            | Simple, no persistence needed — worst case on restart is one unbatched notification       |
| Default preference | All cameras enabled (opt-out model)       | Zero setup required for new cameras                                                       |
| Notification icon  | `/logo192.png` (PWA icon)                 | Consistent branding                                                                       |
| Bundled URL        | `/camera-events` (list page)              | No single event to link to                                                                |

### Constraints

- `parseFrigateEvent` must not throw — malformed payloads return `null`
- Cache clearing continues for all MQTT topics regardless of push logic
- Preference absence = enabled (no row means opt-in)
- Only `icon` field added to existing `PushPayload` — no breaking changes

## Acceptance Criteria

| #     | Criterion                 | Pass condition                                                                                              |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| AC-1  | Single event notification | New Frigate event triggers a push notification with camera name, label, time, and link to event detail page |
| AC-2  | Batched notification      | Multiple events from same camera within 10s produce one notification with count and link to event list      |
| AC-3  | Event type filter         | Only `type: "new"` events trigger notifications; `update` and `end` are ignored                             |
| AC-4  | Per-camera independence   | Each camera has its own 10s batch window                                                                    |
| AC-5  | Per-camera opt-out        | Disabled cameras produce no notifications for that user                                                     |
| AC-6  | Opt-out default           | Cameras without a preference row are treated as enabled                                                     |
| AC-7  | Settings UI               | Camera toggles appear when notifications are subscribed; toggles call preferences API                       |
| AC-8  | Optimistic UI             | Toggle updates instantly, reverts on API failure                                                            |
| AC-9  | Multi-user isolation      | User A's preferences don't affect user B                                                                    |
| AC-10 | Notification icon         | All notifications use `/logo192.png`                                                                        |
| AC-11 | No regression             | Existing cache invalidation, push subscribe/unsubscribe, test notification all still work                   |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
