---
tags: [decision, push-notifications, ios, pwa, service-worker]
created: 2026-08-02
---

# Alert once per activity burst, then patch the notification silently

> A camera's **first** event flushes on the leading edge and alerts. Follow-ups
> merge into the notification still on screen and replace it with
> `silent: true`, so continued motion patches a running count instead of
> re-alerting. The notification's own existence is the "user hasn't seen it yet"
> signal.

## Context

The pipeline batched every camera's events into 30-second windows and pushed one
notification per window, all sharing the constant tag `camera-event` with
`renotify: true`. Two consequences:

- The notification **list** collapsed to one entry (same tag), so the visible
  clutter was already low — but `renotify: true` meant the device re-alerted on
  **every** window. Ten minutes of someone moving around produced ~20 alerts.
- The **first** sighting was delayed by up to a full window, which is the one
  notification that actually wants to be instant.

So the problem was never the notification count; it was the alert count, and the
latency on the one alert that matters.

## Decision

Split "alert" from "update" and let the notification itself carry the state.

- **`EventBatcher` flushes on the leading edge.** An idle camera's first event
  dispatches immediately; events inside the window buffer and flush on close,
  and the window re-chains while flushes stay non-empty. Each flush reports
  `FlushMeta { burstStart }`, true when the camera has been quiet for
  `burstGapMs` (**10 min**) — tracked separately from the 30-second window,
  which dies far sooner than a burst does.
- **One payload shape.** `PushEventInfo { camera, count, labels[], timestamp,
burstStart }` replaces the old `single | bundled` union. The SW derives the
  body from it, which is what lets `count` become a running total. The
  server-rendered `body` stays as a fallback for not-yet-updated SWs.
- **Tags are per camera** (`camera-<name>`), replacing the global tag, so
  cameras alert independently and never clobber each other.
- **The SW merges against what's on screen.** `registration.getNotifications({
tag })` → recover `NotificationState` from `data` → `planNotification()`:
  burst start alerts with a fresh count; a continuation with a notification
  present patches silently with the merged count; a continuation with nothing
  present alerts afresh.
- **Apple endpoints are paced.** Update pushes to `web.push.apple.com` are
  limited to one per 5 min per camera-and-device (`SendThrottle`); every other
  platform gets updates immediately. Burst starts bypass the throttle but are
  recorded, so the first follow-up waits a full interval.

The load-bearing insight: **the browser destroys a notification when the user
opens or dismisses it, and the state stashed on its `data` goes with it.** So
"is there a notification for this tag?" _is_ "has the user not acknowledged this
burst yet?" — no server-side read-tracking needed.

## Alternatives

- **Just lengthen the batch window.** Makes the first sighting later — backwards.
  The first alert wants to be instant; only the repeats need damping.
- **Track acknowledgement server-side.** Needs the client to report clicks and
  dismissals, a new table, a new endpoint, and a race window — to reconstruct
  what `getNotifications()` already tells the SW for free.
- **One global notification across cameras.** Fewest entries, but a busy camera
  masks the others and the title can no longer name the camera.
- **Throttle updates uniformly on all platforms.** Simpler, but pointlessly
  staleness-inducing on Android and desktop, where patching is free.
- **Send no updates at all until acknowledged.** Quietest, but drops the running
  count the user explicitly asked to see.

## Why it matters

- **`silent: true` is the whole mechanism on Android/desktop, and a no-op on
  iOS.** See [[gotchas/ios-ignores-silent-and-renotify]]. Any future change to
  notification pacing has to reason about the two platforms separately; that is
  the only reason `SendThrottle` and endpoint sniffing exist.
- **`renotify` must be the inverse of `silent`.** Setting both true is
  contradictory; `buildNotificationOptions` derives one from the other so they
  cannot drift.
- **The written and read `data` shapes are a contract.**
  `buildNotificationOptions` writes `{ url, state }` and
  `readNotificationState` reads `data.state`. If those drift, merging silently
  stops working forever — every push would just alert. A round-trip test in
  `sw-push-handlers.test.ts` guards it.
- **`burstStart` defaults to `true` when absent** in `parseEvent`. An absent or
  malformed flag must never downgrade an alert into a silent patch — failing
  loud is the safe direction for a security camera.
- **Payload changes must stay backwards compatible** with SWs already installed
  on users' devices. An old SW ignores the event shape it does not recognise and
  renders the server's `body`, which is why that field is still populated.

## See also

- [[decisions/2026-04-15-mqtt-web-push-pipeline]] — the batcher and VAPID gate
  this builds on
- [[decisions/2026-04-17-cross-platform-pwa-first]] — why the iOS divergence got
  its own code path instead of being ignored
- `docs/specs/camera-motion-notification-dedup.md` — Gherkin behaviour and
  trade-offs
