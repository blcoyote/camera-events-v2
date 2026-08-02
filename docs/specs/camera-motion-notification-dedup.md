# Spec: Alert Once Per Activity Burst, Then Patch Silently

## Intent Description

Reduce push notification noise while someone is moving around in front of a
camera. Previously every 30-second batch window produced a push with a constant
notification tag (`camera-event`) and `renotify: true`, so the notification
_list_ collapsed to a single entry but the device re-alerted on every window —
and the very first sighting was delayed by up to a full window.

The pipeline now alerts once when a camera's activity begins and then patches
that notification in place as motion continues:

1. **Leading-edge flush.** The first event for an idle camera is dispatched
   immediately, so the user is alerted the moment a person is noticed.
2. **Silent in-place updates.** Follow-up flushes merge into the notification
   still on screen — accumulating a running count and label set — and replace it
   with `silent: true` / `renotify: false` so no second alert fires.
3. **Acknowledgement resets the cycle.** The merge state lives on the
   notification's `data`. Opening or dismissing the notification destroys it, so
   the next event alerts afresh.
4. **Quiet-gap reset.** After 10 minutes with no events on a camera, the next
   event starts a new burst and alerts, even if a stale notification is still on
   screen.
5. **Per-camera grouping.** Tags are `camera-<name>`, so cameras alert
   independently and one busy camera never clobbers another's notification.

## User-Facing Behavior

```gherkin
Feature: One alert per activity burst, then silent patching

  Background:
    Given the user is authenticated
    And push notifications are enabled for the user
    And VAPID keys are configured on the server
    And the MQTT subscriber is connected to the broker
    And the user has not opted out of any cameras

  # --- First sighting alerts immediately ---

  Scenario: The first event on an idle camera alerts without waiting
    Given no events have arrived from "front_porch" for over 10 minutes
    When Frigate publishes a "new" event for "front_porch" with label "person"
    Then the user is alerted immediately, not after the batch window
    And the notification title is "Front Porch"
    And the notification body contains "Person detected at" and the event time
    And the notification tag is "camera-front_porch"
    And clicking the notification navigates to "/camera-events/{event-id}"

  # --- Continued motion patches rather than re-alerts ---

  Scenario: Follow-up events patch the notification without re-alerting
    Given the user has been alerted for "front_porch" and has not opened it
    When 2 more events arrive from "front_porch" during the batch window
    Then the existing notification is replaced, not stacked
    And its body reads "3 new events" with the merged label summary
    And it navigates to "/camera-events" instead of a single event
    And the device does not play a sound or vibrate

  Scenario: Labels merge across pushes without duplicating
    Given the notification on screen covers a "Person" event
    When a further push covers "Person" and "Car" events
    Then the merged notification lists "Person, Car" once each

  Scenario: The running total survives several patches
    When 5 further events arrive across two batch windows
    Then the notification body reflects the total across all pushes

  # --- Acknowledgement ---

  Scenario: A new alert fires once the user has acted on the notification
    Given the user has opened or dismissed the "front_porch" notification
    When another event arrives from "front_porch"
    Then the user is alerted again
    And the count restarts from the new events only

  # --- Quiet gap ---

  Scenario: A visit after a long quiet period alerts as a new burst
    Given the last event on "front_porch" was over 10 minutes ago
    When a new event arrives from "front_porch"
    Then the user is alerted rather than the old notification being patched
    And the count restarts

  Scenario: Continued motion inside the quiet gap does not re-alert
    Given the last event on "front_porch" was 2 minutes ago
    When a new event arrives from "front_porch"
    Then the notification is patched silently

  # --- Per-camera independence ---

  Scenario: Two cameras alert independently
    Given "front_porch" has an unopened notification
    When an event arrives from "driveway"
    Then "driveway" produces its own alert with tag "camera-driveway"
    And the "front_porch" notification is left intact

  # --- iOS pacing ---

  Scenario: iOS devices are not re-alerted on every patch
    Given the user's device is subscribed via an Apple push endpoint
    And the user has been alerted for "front_porch"
    When follow-up events arrive every 30 seconds for 12 minutes
    Then at most one update push is delivered per 5 minutes to that device
    And an Android or desktop device receives every update silently
```

## Approach

### Server: leading edge + trailing batches (`event-batcher.ts`)

`EventBatcher` flushes on the **leading** edge. `add()` on an idle camera
dispatches `[event]` immediately and opens a window; events arriving inside the
window are buffered and flushed when it closes, and the window re-opens as long
as flushes keep being non-empty. A window that closes empty lets the camera go
idle so its next event flushes on the leading edge again.

Each flush carries `FlushMeta { burstStart }`. `burstStart` is true when no
event has been seen on that camera within `burstGapMs` (10 min) — tracked in a
separate `lastEventAt` map, because the 30-second window chain dies long before
the 10-minute burst does.

### Server: payload (`push.ts`, `push-notify.ts`)

The old `single | bundled` payload union is replaced by one `PushEventInfo`
carrying `camera`, `count`, `labels[]`, `timestamp`, and `burstStart`. The
service worker derives the body from these, which is what allows the count to
become a running total. `body` is still rendered server-side as a fallback for
any service worker that predates merging, and `tag` is set to
`camera-<name>`.

### Client: merging (`sw-push-handlers.ts`, `sw.ts`)

The `push` handler is now async. It reads any notification currently displayed
for the payload's tag via `registration.getNotifications({ tag })` and recovers
the accumulated `NotificationState` from its `data`. `planNotification()` then
decides:

| Situation                                  | Result                         |
| ------------------------------------------ | ------------------------------ |
| `burstStart`                               | Alert, fresh count             |
| Continuation, notification still on screen | **Silent patch, merged count** |
| Continuation, nothing on screen            | Alert, fresh count             |
| No structured event (e.g. the test push)   | Alert, no mergeable state      |

Using the presence of the notification as the "has the user seen it?" signal is
what makes acknowledgement work without any server round-trip: the browser
discards the notification — and the state stashed on it — when the user opens or
dismisses it.

### Cross-platform: Apple endpoints are paced (`send-throttle.ts`)

Android, Chrome, and desktop honour `silent: true`, so patches there are
genuinely quiet. **iOS Safari ignores both `silent` and `renotify`:** re-showing
with the same tag replaces the entry (the list still stays at one per camera and
the count still patches correctly) but the device alerts anyway.

Apple endpoints are identifiable server-side by host (`web.push.apple.com`), so
update pushes to them are rate-limited to one per 5 minutes per
camera-and-device by `SendThrottle`, while other platforms receive every update
immediately. Burst starts are never throttled — they are the alert the user
actually wants — but they are recorded, so the first follow-up waits a full
interval rather than arriving right behind the alert.

`readExistingState()` also degrades to `null` if `getNotifications` is missing
or throws, which on an older Safari build means pushes simply behave as fresh
alerts rather than crashing the handler.

## Alternatives Considered

**Keep the trailing-edge-only batcher and just lengthen the window.** Rejected:
it makes the first sighting _later_, which is the opposite of what matters. The
first alert should be as fast as possible; it is the repeats that need damping.

**Track "has the user opened it?" server-side.** Would need the client to report
notification clicks and dismissals back, plus per-device state in SQLite. The
service worker already has this information for free in
`getNotifications()`; a server round-trip would add a table, a new endpoint, and
a race window for no behavioural gain.

**One global notification for all cameras.** Fewest entries, but a busy camera
would mask another camera's activity and the title could no longer name the
camera. Per-camera tags were chosen for that reason.

**Throttle updates on every platform equally.** Simpler (no endpoint sniffing)
but it would make Android and desktop counts needlessly stale, since patching
costs nothing there.

**Never send updates until the notification is acknowledged.** The quietest
option, but the user explicitly wanted the list patched with the running count
as motion continues.

## Trade-offs and Known Limitations

- **iOS still alerts on each patch it receives.** The 5-minute pacing reduces
  this from ~20 alerts per 10 minutes of motion to ~2, but cannot eliminate it —
  no web API lets a page update an iOS notification silently.
- **A user who taps notifications away gets alerted again** on the next window,
  by design (the chosen re-alert rule). During sustained motion that means at
  most one alert per 30-second window for the taps that follow.
- **Merge state is per-notification, not durable.** A browser that drops the
  notification for its own reasons (shade cleared, OS restart) loses the running
  total and the next push alerts with a fresh count.
- **The batch window, burst gap, and Apple interval are code constants** (30 s
  via `EVENT_BATCH_WINDOW_MS`, 10 min, 5 min). Only the first is env-tunable
  today.
- **Service workers update lazily.** Until a client picks up the new SW, it will
  ignore the structured event it does not understand and fall back to the
  server-rendered `body` — correct, just without merging.
