# Spec: Notify From Frigate Review Alerts, Verified

## Intent Description

Users were getting push notifications for detections that never became Events
in Frigate. Tapping one opened the events list, or a "Still being saved" page
that never resolved, because Frigate had dropped the object.

The cause was the trigger. Pushes fired on the `"type": "new"` message on
`frigate/events`. Frigate publishes that message a few frames after an object
stops being a false positive, before it decides whether to keep the object (see
`docs/memory/gotchas/frigate-publishes-new-before-persisting.md`). It also
ignores Frigate's own alert configuration (`review.alerts.labels`,
`required_zones`).

The pipeline now:

1. **Triggers on review alerts.** It listens on `frigate/reviews` and starts a
   notification the first time a Review is seen with `severity: "alert"` on a
   `new` or `update` message. A Review that is upgraded from `detection` to
   `alert` notifies at the upgrade. Each Review notifies at most once.
2. **Checks the Event exists before alerting.** Before anything goes to the
   batcher, the server polls `GET /api/events/{id}` for the Review's detection
   ids, in order, up to `VERIFY_ATTEMPTS` (8) rounds `VERIFY_INTERVAL_MS` (2s)
   apart. The whole check has a hard 15s budget (`VERIFY_BUDGET_MS`). Each
   request times out after at most 3s (`VERIFY_LOOKUP_TIMEOUT_MS`), or sooner
   if less of the budget is left, so a hung Frigate can't stall it. Alert
   updates that arrive during the check add their detection ids to the list,
   and every round re-reads it. The first saved Event becomes the
   notification's subject and deep link. If none appears, no push is sent, and
   a later alert `update` for the same Review may retry.
3. **Keeps the burst and patch behaviour.** A checked Review is fed to the
   existing `EventBatcher` as one `DetectionInfo` built from the saved Event,
   so the leading-edge flush, silent patching, Apple pacing, Mute and
   Preferences are unchanged
   (`docs/specs/camera-motion-notification-dedup.md`).

`frigate/events` still clears the Frigate cache but no longer triggers pushes.

## User-Facing Behavior

```gherkin
Feature: Push notifications follow Frigate review alerts

  Background:
    Given the user is subscribed to push notifications
    And the MQTT subscriber is connected

  Scenario: A review alert with a saved event notifies once
    When Frigate publishes a "new" review with severity "alert" for "front_porch"
    And Frigate has saved the review's first detection event
    Then the user is alerted for "front_porch"
    And tapping the notification opens "/camera-events/{event-id}"

  Scenario: Detection-severity reviews do not notify
    When Frigate publishes a review with severity "detection"
    Then no notification is sent

  Scenario: A review upgraded to alert notifies at the upgrade
    Given a review for "driveway" started with severity "detection"
    When Frigate publishes an "update" with severity "alert" for that review
    Then the user is alerted once

  Scenario: Repeated updates of the same alert do not re-notify
    Given the user was notified for a review
    When further "update" messages arrive for that review
    Then no further notification is started for that review

  Scenario: A review whose events never get saved does not notify
    When a review alert arrives
    And none of its detection events can be fetched from Frigate within 15s
    Then no notification is sent

  Scenario: Raw tracked-object messages do not notify
    When Frigate publishes a "new" message on frigate/events
    Then the Frigate cache is cleared
    And no notification is sent
```

## Tuning Frigate to cut noise further

What counts as an alert is now configured in Frigate. With the defaults,
every `person` and `car` anywhere in the frame is an alert. To keep alerts to
what matters, set the labels and the zones an object must enter, per camera:

```yaml
cameras:
  front_porch:
    zones:
      porch:
        coordinates: 0.1,0.9,0.6,0.9,0.6,0.4,0.1,0.4
        inertia: 3 # frames an object must be inside before it counts
        loitering_time: 0
    review:
      alerts:
        labels:
          - person
        required_zones:
          - porch # street/sidewalk traffic no longer alerts
      detections:
        labels:
          - person
          - car
    objects:
      filters:
        person:
          min_score: 0.6 # drop weak single-frame hits
          threshold: 0.8 # median score needed to stop being a false positive
```

Frigate must also save something for each alert. With neither
`record.enabled` (clips) nor `snapshots.enabled` on, Events are never written,
and the existence check suppresses every notification. The server logs
`[mqtt] Review … alert skipped — no saved event` when this happens.

## Alternatives Considered

- **Filter `frigate/events` ourselves** (`has_snapshot`, not `stationary`,
  `top_score`, `entered_zones`). Rejected: it duplicates rules Frigate already
  has for reviews and would need new settings in the app.
- **Delay the first alert by a fixed time.** Rejected: false positives that
  last longer than the delay still get through.
- **Link to the events list instead of checking.** Rejected: the push still
  fires for something that doesn't exist.
- **A per-user "also notify for detections" toggle.** Not built. The owner
  chose alerts only.

## Trade-offs

- Alerts arrive later than before: once the Review becomes an alert (for
  example, when the object enters a required zone) plus the time Frigate takes
  to save the Event. That is usually a second or two with recording on.
  The 2026-08-29 decision traded accuracy for speed; this one trades speed for
  accuracy.
- Each alert costs up to 8 extra Frigate API calls. 404s are not cached, and
  saved Events are cached until the next MQTT event.
- The gate's memory of seen Review ids is capped (500, oldest dropped) and
  cleared on each Review's `end`. After a server restart, a Review already in
  progress may notify once.
