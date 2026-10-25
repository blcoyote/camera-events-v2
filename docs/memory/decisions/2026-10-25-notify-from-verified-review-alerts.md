---
tags: [decision, frigate, mqtt, push-notifications]
created: 2026-10-25
---

# Notify from verified Frigate review alerts, not raw detections

> Supersedes the trigger part of
> [[decisions/2026-08-29-ghost-event-notifications]]. Spec:
> `docs/specs/review-alert-notifications.md`.

## Context

After the 2026-08-29 fix, notifications for Ghost detections still alerted;
the fix only changed where they linked. The owner reported these as the main
source of false-positive notifications: alerts for things Frigate never kept.
The trigger, `"type": "new"` on `frigate/events`, fires a few frames after an
object stops being a false positive, before persistence, and ignores Frigate's
`review.alerts` labels and `required_zones`
([[gotchas/frigate-publishes-new-before-persisting]]).

## Decision

- **Trigger:** `frigate/reviews`, first `new`/`update` with `severity: "alert"`
  per Review id (`ReviewAlertGate` in `review-alert.ts`; bounded at 500 ids,
  forgotten on `end`, released on a failed check so a later update retries).
- **Check:** before alerting, `waitForPersistedEvent` (`event-verify.ts`)
  polls `getEvent` for the Review's detection ids, which must pass
  `isValidEventId`. It runs for 8 rounds 2s apart, within a hard 15s budget,
  and each request is capped at 3s or the time left. Each round re-reads the
  gate's merged detection list, so ids added by an update during the check are
  included. No saved Event means no push.
- **Batching unchanged:** the saved Event becomes one `DetectionInfo` fed to
  `EventBatcher`, so burst, patch, Apple pacing, Mute and Preferences are as
  before.
- `frigate/events` still clears the cache; `parseFrigateEvent` is removed.
- Alerts only. There is no detection-severity opt-in.

## Alternatives

- Filter `frigate/events` in-app on score, stationary and zones: duplicates
  Frigate's review config.
- Fixed delay: longer false positives still get through.
- Keep the 2026-08-29 approach (instant push, honest link): this is the
  behaviour the owner reported as broken.

## Why it matters

- The 2026-08-29 ADR rejected "verify before dispatch" because it delays alerts
  and, at `"new"` time, would drop most notifications. Both objections are
  weaker now. A review alert comes later in the object's life, when the Event
  is usually already saved or about to be. The owner explicitly accepted a few
  seconds of latency for no Ghost notifications.
- Frigate config is now where alert noise is tuned. If Frigate saves neither
  clips nor snapshots, no notification is ever sent. This is documented in the
  spec and logged.
- The detail page's `pending` state stays. It still covers older notifications
  and favourites deep-linked from elsewhere.

## Related

- [[decisions/2026-08-29-ghost-event-notifications]]
- [[decisions/2026-08-02-alert-once-per-burst-then-patch]]
- [[architecture/push-pipeline]]
