# Spec: Admin Global Notification Mute

## Intent Description

An admin needs a way to stop every push notification going to every user for a
short, fixed window — the case that motivated it is physical work in front of a
camera (deliveries, gardening, a party in the driveway) that would otherwise
spray motion alerts at every subscribed device for as long as it lasts. Today
the only mitigations are per-user and per-camera: each user can opt a camera out
of motion alerts in Settings, and each user can unsubscribe their own device.
Neither helps an admin who wants to spare _everyone_ for the next ten minutes
without touching anyone's stored preferences.

The control is a single button on the Settings page, visible only to users whose
`users.is_admin` row is set (see
`docs/specs/user-table-admin-flag.md`): **Silence all notifications for 10
minutes**. While the window is open, motion alerts and camera offline/online
alerts are not delivered to anyone. When it lapses, notifications resume with no
further action.

## Scope

**In scope**

- A global mute deadline, stored server-side, shared by all users.
- Suppression of the two _automatic_ push dispatchers: motion events
  (`notifyUsersForCamera`) and camera availability transitions
  (`notifyUsersForCameraAvailability`).
- An admin-gated `GET`/`POST /api/push/mute` endpoint.
- An admin-only Settings section with the button and a live countdown.

**Out of scope**

- Cancelling an active mute early. Ten minutes is short enough that waiting it
  out is acceptable, and a cancel button doubles the state machine (and the
  audit questions) for a case that resolves itself.
- Per-camera or per-user scoping of the mute. This is deliberately the blunt
  instrument; the fine-grained controls already exist next to it.
- An audit log of who muted when. Nothing else in this app is audited, and
  adding a first audit trail for one action is a bigger decision than this
  feature warrants.
- The **Send Test Notification** button, which stays live during a mute — see
  "Trade-offs" below.

## Approach

### Where the mute lives

A single row in a new `push_global_settings` key/value table in the existing
SQLite database, under the key `notification_mute_until`, holding an epoch-
millisecond deadline as text.

It is stored rather than held in a module-level variable because the deadline
must survive a process restart. A deploy, a crash-restart, or a `docker compose
up` in the middle of the window would otherwise silently un-mute and let the
alert storm the admin just suppressed through — the exact failure the feature
exists to prevent, at the exact moment it is least visible.

Reads are fail-closed in the _safe_ direction: a missing row, an empty string,
or an unparseable value reads as **not muted**. A corrupt value must never be
able to wedge the system into permanent silence; the worst outcome of a bad read
is a notification the admin wanted suppressed, not a notification that never
arrives.

Expiry is not stored as a flag and never swept. `getNotificationMuteUntil()`
returns the raw deadline and callers compare it against their own clock, so a
lapsed mute needs no cleanup job and no write on the read path.

### Where the mute is enforced

At the two dispatchers, immediately after the existing `isPushEnabled()` guard
and before any subscription is loaded:

```
notifyUsersForCamera()            → return early when muted
notifyUsersForCameraAvailability() → return early when muted
```

Enforcing at dispatch rather than upstream is deliberate. Everything before the
dispatcher keeps running: MQTT stays subscribed, `frigate/events` still clears
the Frigate cache, the `EventBatcher` still batches and still tracks burst
boundaries, and `CameraAvailabilityTracker` still counts zero-fps readings and
still flips its internal state. Only the outbound push is dropped. So a camera
that goes offline during a mute and is still offline when it lapses does not
re-announce itself (the transition already happened), and the events themselves
are all present in the app the moment anyone opens it — the mute silences
notifications, it does not create a gap in the record.

"Silent" is implemented as _not sent_, not as `silent: true` on the payload.
iOS re-alerts on a silent push anyway — see
`docs/memory/gotchas/ios-ignores-silent-and-renotify.md` — so a silent-flag
implementation would work on Android and desktop and fail on exactly the
platform the app treats as a first-class target.

### Authorization

`POST /api/push/mute` resolves the session `sub`, then re-reads
`userStore.isAdmin(sub)` on every call: `401` with no session, `403` for a
signed-in non-admin. The client-side gate — the section renders `null` unless
`GET /api/push/mute` reported `isAdmin: true` — is presentation only. Admin
status is never carried in the session cookie or in router context, so
demoting a user takes effect on their next request rather than their next login.

### Client

`AdminNotificationMute` fetches its own state on mount and renders nothing until
it does, which keeps the SSR and first-client renders identical (`isAdmin`
starts `false`) and keeps admin status out of the server-rendered HTML. While a
mute is active the button is disabled and a one-second interval ticks a `M:SS`
countdown in an `aria-live="polite"` region.

## Alternatives Considered

**In-memory module state.** Simplest possible implementation and a natural fit
for a single-process Bun server. Rejected because a restart inside the window
un-mutes silently, and the window is exactly when that matters.

**Reuse `push_notification_preferences` with a synthetic user.** Would have
avoided a new table, at the cost of a row whose `user_id` is not a user and
whose `enabled` column encodes a timestamp. A three-column key/value table is
smaller than the explanation that hack needs.

**A per-user snooze instead of a global one.** Genuinely useful, and probably
worth having eventually, but it solves a different problem: it needs each user
to act, which is precisely what the admin is trying to avoid.

**Suppress at the `EventBatcher` instead of the dispatcher.** Would drop events
earlier and save a little work, but it also loses burst tracking across the
window, so the first event after a mute would be misclassified as a
continuation and silently patch a notification that was never shown.

**Send with `silent: true` and let the device decide.** Rejected on iOS
behaviour, as above.

## Trade-offs

- **Test notifications stay live during a mute.** "Send Test Notification" is an
  explicit, one-device, user-initiated check of _that device's_ plumbing, and
  someone debugging a broken subscription during a mute window should not be
  told, misleadingly, that push is broken. The cost is that the mute is not
  literally "no push can leave the server"; it is "no _event_ reaches a user
  unbidden", which is the property the feature is actually for.
- **No early cancel.** An admin who mis-clicks waits out ten minutes. Accepted
  for the scope reasons above; adding a cancel later is a small, additive change
  (`setNotificationMuteUntil(0)` plus a second button).
- **Last write wins.** Two admins muting concurrently is a single-row upsert; no
  locking, no merge. The later deadline is not preserved if the earlier write
  lands second, which for a fixed-length window from `now` is a sub-second
  discrepancy.
- **Server clock only.** The deadline is compared against the server's clock in
  the dispatchers and against the browser's clock only for the countdown
  display. A skewed client shows a wrong countdown; it cannot change when the
  mute actually ends.

## Related

- `docs/specs/user-table-admin-flag.md` — where `is_admin` comes from
- `docs/specs/mqtt-push-notifications.md` — the pipeline this suppresses
- `docs/specs/camera-availability-notifications.md` — the second dispatcher
- `docs/specs/camera-motion-notification-dedup.md` — burst/patch semantics
