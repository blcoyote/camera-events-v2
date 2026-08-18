# Spec: Camera Offline/Online Push Notifications

## Intent Description

Frigate has no dedicated per-camera "online/offline" MQTT topic (confirmed against
the Frigate 0.13 docs and source). The Frigate web UI's "No frames have been
received, check error logs" message — a black tile shown when a camera's ffmpeg
process stops delivering frames — is derived client-side from `camera_fps`
dropping to zero; it is not itself pushed as an event. This feature detects the
same condition server-side and turns it into a push notification, so a user
doesn't have to have the Frigate (or this app's) UI open to notice a camera has
gone dark.

Detection reuses the MQTT connection this app already holds open for motion
events — no new external dependency, no server-side polling (which would be a
first for this codebase; everything today is MQTT push-driven). Two additional
topics are subscribed:

- **`frigate/stats`** — mirrors Frigate's `/api/stats` REST response, published
  periodically at Frigate's own configurable `stats_interval` (default 60s, set
  in the Frigate config, not by this app). Contains per-camera `camera_fps`. A
  camera reporting `camera_fps: 0` for `CAMERA_OFFLINE_THRESHOLD` consecutive
  readings (default 2, i.e. ~2 minutes at Frigate's default interval) is
  declared offline; a single subsequent reading with `camera_fps > 0` declares
  it back online.
- **`frigate/available`** — Frigate's own MQTT Last Will and Testament, a plain
  `"online"`/`"offline"` string for the whole Frigate instance. An `"offline"`
  message is a reliable, instantaneous signal (no debounce needed) that every
  camera this app knows about is now unreachable — it fires immediately if
  Frigate itself crashes or loses its broker connection, well before two
  `frigate/stats` readings could have confirmed the same thing per-camera. An
  `"online"` message triggers no notification by itself; recovery is only
  reported once a real `frigate/stats` reading confirms a camera's `camera_fps`
  is nonzero again.

Camera availability alerts are gated by a single **global, opt-in** preference
per user (`Camera Offline Alerts` in Settings → Notifications), defaulting to
**off**. This is independent of the existing per-camera motion-event opt-out
list — a user can silence a noisy camera's motion pushes while still wanting to
know if it dies, or vice versa.

## User-Facing Behavior

```gherkin
Feature: Camera offline/online push notifications

  Background:
    Given the user is authenticated and subscribed to push notifications
    And VAPID keys are configured on the server
    And the MQTT subscriber is connected to the broker

  Scenario: Alerts are off by default
    Given the user has never touched the "Camera Offline Alerts" toggle
    When a camera goes offline
    Then the user receives no push notification

  Scenario: User opts in and a camera goes offline
    Given the user has enabled "Camera Offline Alerts" in Settings
    When Frigate publishes 2 consecutive frigate/stats readings reporting
      camera_fps: 0 for camera "front_porch"
    Then the user receives a push notification
    And the notification title is "Front Porch"
    And the notification body is "Camera went offline — no frames received"
    And the notification is tagged "camera-availability-front_porch"

  Scenario: A single zero reading does not alert
    Given the user has enabled "Camera Offline Alerts"
    When Frigate publishes exactly 1 frigate/stats reading with camera_fps: 0
      for "front_porch", followed by a reading with camera_fps > 0
    Then the user receives no push notification
    # A single 0.0 reading is treated as noise, not a real outage.

  Scenario: Camera recovery alerts once
    Given "front_porch" has already been flagged offline
    When Frigate publishes a frigate/stats reading with camera_fps > 0 for it
    Then the user receives a push notification with body "Camera is back online"
    And the notification shares the same tag as the earlier offline alert

  Scenario: Whole-instance outage flags every known camera immediately
    Given "front_porch" and "driveway" have both reported at least one
      frigate/stats reading (so they're known to the tracker)
    When Frigate publishes "offline" on frigate/available
    Then the user receives an offline alert for "front_porch"
    And the user receives an offline alert for "driveway"
    And neither alert waited for 2 consecutive zero readings

  Scenario: frigate/available coming back online does not itself alert
    Given the instance was flagged offline via frigate/available
    When Frigate publishes "online" on frigate/available
    Then the user receives no notification yet
    And an online alert is only sent once a real frigate/stats reading confirms
      a camera's camera_fps is nonzero again

  Scenario: Per-camera motion mute is independent of availability alerts
    Given the user has disabled push notifications for camera "front_porch"
      (the existing per-camera motion opt-out)
    And the user has enabled "Camera Offline Alerts" (the global toggle)
    When "front_porch" goes offline
    Then the user still receives the offline alert
    # The two preferences are unrelated; muting motion events for a camera
    # does not mute its availability alerts, and vice versa.
```

## Design

### Detection: `CameraAvailabilityTracker`

`src/features/push-notifications/server/camera-availability.ts` — a small
stateful class in the same spirit as `EventBatcher`, fed one MQTT reading at a
time via `handleStats()`/`handleServiceAvailability()`, firing an
`onTransition(camera, 'online' | 'offline')` callback on state changes. It has
no knowledge of MQTT or `process.env` — the wiring code in `mqtt.ts` owns
parsing topics and resolving config, keeping this class trivially unit
testable (see `camera-availability.test.ts`).

Per-camera state: a consecutive-zero-reading counter and an offline flag,
tracked independently per camera name. `handleServiceAvailability('offline')`
walks every camera name ever seen (regardless of its fps history) and flags
each one not already offline — this is the only path that bypasses the
debounce.

`parseFrigateStatsMessage()` extracts `{ cameraName: camera_fps }` from the
`frigate/stats` JSON payload's `cameras` object (see
`src/features/shared/server/frigate/types.ts`'s `FrigateStats` type for the
authoritative shape used elsewhere in this codebase), silently excluding any
camera whose `camera_fps` isn't a finite number.

### Dispatch: `notifyUsersForCameraAvailability`

`src/features/push-notifications/server/availability-notify.ts` — deliberately
does **not** reuse `notifyUsersForCamera`/`EventBatcher`. Availability changes
are rare, important, binary state transitions, not a rapid stream of motion
events — there's nothing to batch, and no Apple-endpoint pacing is needed since
a user gets at most two pushes per outage (down, then back up). Every
subscribed device of every opted-in user receives every transition, with no
merge/patch logic — each push is a fresh, always-alerting notification
(`silent: false`/`renotify: true`, the default when a `PushPayload` carries no
`event` field, per the existing service worker logic in
`src/sw-push-handlers.ts`).

### Storage: reusing `push_notification_preferences`

No schema change. The existing generic `category` + `resource_id` columns
already support this: `category = 'camera_availability'`,
`resource_id = 'global'` (a fixed sentinel — **not** `NULL`, since SQLite's
`UNIQUE` constraint treats every `NULL` as distinct from every other `NULL`,
which would silently break the `ON CONFLICT` upsert and create duplicate rows
instead of updating one). Default when no row exists is `false` — the inverse
default of the existing per-camera preference, which defaults to enabled
(opt-out) rather than disabled (opt-in).

### API

`GET`/`PUT /api/push/availability-preference` — mirrors the existing
`/api/push/preferences` route's session-handling and error-wrapping pattern
exactly, just for a single global boolean instead of a per-camera list.

### Settings UI

A single toggle switch, `Camera Offline Alerts`, rendered in the Notifications
section between the subscribe/test controls and the per-camera list — it's a
feature-level gate, not a per-camera setting, so it doesn't belong inside
`CameraPreferences`.

## Alternatives Considered

- **Polling `/api/stats` on an interval.** Rejected: this app has no
  server-side polling anywhere today — everything is MQTT-driven. Frigate
  already publishes the identical JSON to `frigate/stats` on the same
  connection this app holds open for events, so polling would add a second,
  redundant data path and the first interval-based background job in the
  codebase for no benefit.
- **Per-camera opt-out (mirroring the motion-event preference) instead of one
  global opt-in toggle.** Rejected for this iteration: the task calls for a
  single settings switch, default off. A per-camera variant is a natural
  follow-up if it's ever wanted, and the `category`/`resource_id` schema
  already supports it without migration.
- **Routing availability changes through `EventBatcher`/`notifyUsersForCamera`.**
  Rejected: that pipeline's entire design — burst detection, leading-edge
  flush, Apple pacing — exists to tame a _stream_ of motion events. An
  availability transition is a single, rare, binary fact with nothing to
  batch or throttle; forcing it through that pipeline would mean inventing
  fake `FrigateEventInfo`/`event` fields with no natural meaning (what "label"
  does a camera going offline have?).

## Known Limitations

- **In-memory only, like the rest of this pipeline.** `CameraAvailabilityTracker`'s
  state (which cameras are known, which are currently offline) does not survive
  a server restart — consistent with `EventBatcher`'s and `SendThrottle`'s
  existing precedent (see `docs/memory/decisions/2026-04-15-mqtt-web-push-pipeline.md`
  and `2026-08-02-alert-once-per-burst-then-patch.md`, both of which explicitly
  reasoned against durable state for the same reasons: added complexity for a
  problem bounded by "at most a few stale pushes around a restart"). A restart
  mid-outage means the tracker starts fresh and needs `CAMERA_OFFLINE_THRESHOLD`
  more zero readings before re-declaring a still-offline camera offline again.
- **Threshold is a reading count, not a duration**, because Frigate's own
  `stats_interval` (which this app doesn't control) determines how often
  `frigate/stats` actually arrives — see `CAMERA_OFFLINE_THRESHOLD` in the
  environment variable table in `CLAUDE.md`.
