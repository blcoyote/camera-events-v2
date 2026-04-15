# Plan: MQTT-Driven Push Notifications with Per-Camera Opt-Out

**Created**: 2026-04-15
**Branch**: main
**Status**: implemented

## Goal

Connect the existing push notification infrastructure to Frigate MQTT events. When a new camera event arrives via MQTT, send push notifications to all subscribed users (respecting per-camera opt-out preferences). Batch events from the same camera within a 10-second window to reduce notification spam. Add per-camera notification toggles to the Settings page backed by the `push_notification_preferences` SQLite table.

## Acceptance Criteria

- [x] AC-1: New Frigate event triggers push notification with camera name, label, time, and link to event detail page
- [x] AC-2: Multiple events from same camera within 10s produce one bundled notification with count and link to event list
- [x] AC-3: Only `type: "new"` events trigger notifications; `update` and `end` are ignored
- [x] AC-4: Each camera has its own independent 10s batch window
- [x] AC-5: Disabled cameras produce no notifications for that user
- [x] AC-6: Cameras without a preference row are treated as enabled (opt-out model)
- [x] AC-7: Camera toggles appear in Settings when notifications are subscribed
- [x] AC-8: Toggle updates instantly with optimistic UI, reverts on API failure
- [x] AC-9: User A's camera preferences don't affect user B
- [x] AC-10: All notifications use `/logo192.png` icon
- [x] AC-11: Existing cache invalidation, push subscribe/unsubscribe, and test notification still work

## User-Facing Behavior

```gherkin
Feature: MQTT-driven push notifications with per-camera opt-out

  Background:
    Given the user is authenticated
    And push notifications are enabled for the user
    And VAPID keys are configured on the server
    And the MQTT subscriber is connected to the broker

  Scenario: User receives notification for a new camera event
    Given the user has not opted out of any cameras
    When Frigate publishes a "new" event for camera "front_porch" with label "person"
    And no other events arrive from "front_porch" within 10 seconds
    Then the user receives a push notification
    And the notification title is "Front Porch"
    And the notification body contains "Person detected at {time}"
    And clicking the notification navigates to "/camera-events/{event-id}"

  Scenario: Multiple events from same camera are bundled
    When Frigate publishes 3 "new" events for "front_porch" within 10 seconds
    Then the user receives a single notification
    And the body contains "3 new events" and a summary of labels
    And clicking navigates to "/camera-events"

  Scenario: Only "new" events trigger notifications
    When Frigate publishes an "update" or "end" event
    Then no push notification is sent

  Scenario: User opts out of a camera in Settings
    When the user toggles off "Driveway" in the camera notifications section
    Then future events from "driveway" do not trigger notifications for this user
    But events from other cameras still trigger notifications

  Scenario: New cameras default to enabled
    Given a camera not in the preferences table
    Then notifications for that camera are enabled by default
```

## Steps

### Step 1: Extend push store with preference queries

**Complexity**: standard
**Task**: Add prepared statements and methods to `src/server/push-store.ts` for the existing `push_notification_preferences` table: `getAllSubscribedUserIds()`, `getDisabledCameras(userId)`, `isCameraEnabledForUser(userId, camera)`, `setPreference(userId, camera, enabled)`. Add `CameraPreference` interface.
**Tests**: Preference CRUD, opt-out default = enabled, user isolation, upsert dedup.
**Files**: `src/server/push-store.ts`, `src/server/push-store.test.ts`

### Step 2: Add icon support to PushPayload and SW handlers

**Complexity**: trivial
**Task**: Add optional `icon` field to `PushPayload` in `src/server/push.ts` and `src/sw-push-handlers.ts`. Update `parsePushPayload` to extract icon. Update `buildNotificationOptions` to include `icon` with default `/logo192.png`.
**Tests**: Icon parsing, custom icon, default fallback.
**Files**: `src/server/push.ts`, `src/sw-push-handlers.ts`, `src/sw-push-handlers.test.ts`

### Step 3: Create EventBatcher with per-camera 10s windows

**Complexity**: standard
**Task**: New `src/server/event-batcher.ts` — `EventBatcher` class with per-camera `Map<string, FrigateEventInfo[]>` buffers and `Map<string, Timeout>` timers. Constructor takes a `FlushCallback` and optional `windowMs` (default 10s). `add(event)` buffers by camera and starts timer on first event per camera. `dispose()` cancels all timers.
**Tests**: Single event flush, multi-event batching, per-camera independence, dispose cancels, new window after flush, custom window duration.
**Files**: `src/server/event-batcher.ts`, `src/server/event-batcher.test.ts`

### Step 4: Create notification dispatcher

**Complexity**: standard
**Task**: New `src/server/push-notify.ts` — `notifyUsersForCamera(camera, events[])` as the batcher's flush callback. Queries all subscribed user IDs, filters by per-camera prefs, builds single or bundled `PushPayload`, sends to all user devices. Exports pure helpers: `formatCameraName`, `formatLabel`, `formatTime`, `buildSinglePayload`, `buildBundledPayload`.
**Tests**: Payload formatting, single vs bundled, label deduplication, label truncation (+N more), latest timestamp selection.
**Files**: `src/server/push-notify.ts`, `src/server/push-notify.test.ts`

### Step 5: Wire MQTT handler to parse events and feed batcher

**Complexity**: standard
**Task**: Modify `src/server/mqtt.ts` — add `parseFrigateEvent(payload)` that parses JSON, filters `type: "new"`, validates required fields, returns `FrigateEventInfo | null`. Instantiate singleton `EventBatcher` wired to `notifyUsersForCamera`. In `onFrigateMessage`, for `frigate/events` topic, parse and feed batcher. Cache clearing continues for all topics.
**Tests**: Valid "new" event parsing, "update"/"end" filtered, invalid JSON, missing fields.
**Files**: `src/server/mqtt.ts`, `src/server/mqtt.test.ts`

### Step 6: Create preferences API routes

**Complexity**: standard
**Task**: New `src/routes/api/push/preferences.ts` with GET and PUT handlers. Add `handleGetPreferences(userId)` and `handleSetPreference(userId, body)` to `src/routes/api/push/-push-handlers.ts`. GET merges `getCameras()` with user's disabled cameras. PUT validates `{ camera, enabled }` and upserts preference.
**Tests**: Auth checks, camera list merge, 502 on Frigate failure, validation, upsert call.
**Files**: `src/routes/api/push/preferences.ts`, `src/routes/api/push/-push-handlers.ts`, `src/routes/api/push/-push-endpoints.test.ts`

### Step 7: Add per-camera toggles to NotificationSettings UI

**Complexity**: standard
**Task**: Extend `src/pages/settings/NotificationSettings.tsx` — when subscribed, fetch `GET /api/push/preferences` on mount, render `CameraPreferences` component with toggle switches per camera. Optimistic UI: toggle updates state immediately, calls `PUT /api/push/preferences`, reverts on failure. Helper `formatCameraName` for display. Only shown when notifications are subscribed.
**Files**: `src/pages/settings/NotificationSettings.tsx`

## Files Changed / Created

| File | Action | Step |
|---|---|---|
| `src/server/push-store.ts` | Modified — preference queries | 1 |
| `src/server/push-store.test.ts` | Modified — preference tests | 1 |
| `src/server/push.ts` | Modified — icon field | 2 |
| `src/sw-push-handlers.ts` | Modified — icon support | 2 |
| `src/sw-push-handlers.test.ts` | Modified — icon tests | 2 |
| `src/server/event-batcher.ts` | **New** — per-camera batcher | 3 |
| `src/server/event-batcher.test.ts` | **New** — batcher tests | 3 |
| `src/server/push-notify.ts` | **New** — notification dispatcher | 4 |
| `src/server/push-notify.test.ts` | **New** — dispatcher tests | 4 |
| `src/server/mqtt.ts` | Modified — event parsing + batcher wiring | 5 |
| `src/server/mqtt.test.ts` | Modified — parseFrigateEvent tests | 5 |
| `src/routes/api/push/preferences.ts` | **New** — GET + PUT routes | 6 |
| `src/routes/api/push/-push-handlers.ts` | Modified — preference handlers | 6 |
| `src/routes/api/push/-push-endpoints.test.ts` | Modified — preference endpoint tests | 6 |
| `src/pages/settings/NotificationSettings.tsx` | Modified — camera toggles | 7 |

## Pre-PR Quality Gate

- [x] All tests pass (366 tests, 41 files)
- [x] Type check passes (`tsc --noEmit`)
- [x] Linter passes (no new errors)
- [ ] Manual verification: enable notifications, trigger MQTT event, receive notification, click to navigate
- [ ] Manual verification: toggle off a camera, verify no notification for that camera
- [ ] Manual verification: multiple rapid events from same camera produce single bundled notification
