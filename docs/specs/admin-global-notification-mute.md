# Spec: Admin Global Notification Mute

## Intent Description

An admin needs a way to stop every push notification going to every user for a
bounded window — the case that motivated it is physical work in front of a
camera (deliveries, gardening, a party in the driveway) that would otherwise
spray motion alerts at every subscribed device for as long as it lasts. Today
the only mitigations are per-user and per-camera: each user can opt a camera out
of motion alerts in Settings, and each user can unsubscribe their own device.
Neither helps an admin who wants to spare _everyone_ for the next few hours
without touching anyone's stored preferences.

The control is a duration dropdown plus a button on the Settings page, visible
only to users whose `users.is_admin` row is set (see
`docs/specs/user-table-admin-flag.md`). The dropdown offers a fixed ladder —
**Off, 10 minutes, 30 minutes, 1 hour, 2 hours, 4 hours, 6 hours** — and
defaults to **Off**. Submitting a duration silences motion alerts and camera
offline/online alerts for everyone until it lapses; submitting **Off** clears
any active mute and resumes notifications immediately. A lapsed mute needs no
action at all.

The default is Off rather than the longest or most recent choice so that
opening Settings and submitting without touching the dropdown resumes
notifications rather than silencing them — the accident-proof direction for a
control that affects every user.

## Scope

**In scope**

- A global mute deadline, stored server-side, shared by all users.
- Suppression of the two _automatic_ push dispatchers: motion events
  (`notifyUsersForCamera`) and camera availability transitions
  (`notifyUsersForCameraAvailability`).
- An admin-gated `GET`/`POST /api/push/mute` endpoint.
- An admin-only Settings section with the button and a live countdown.

**Out of scope**

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

Clearing a mute writes `0` rather than deleting the row: `parseMuteUntil('0')`
yields `0`, and `isMuteActive(0, now)` is false because `0 > now` fails. One
write path covers both setting and clearing, and no read path has to
distinguish "never muted" from "explicitly resumed".

Reads are fail-closed in the _safe_ direction, via two layers of validation. In
`push-store.ts`, `parseMuteUntil()` accepts only a non-negative safe integer —
a missing row, an empty string, a non-numeric string, or a value like `"1e100"`
(finite but not a safe integer) all read as **not muted**. In
`notification-mute.ts`, `isMuteActive()` additionally caps how far in the
future a deadline may be: no legitimate deadline is ever further out than
`MAX_MUTE_DURATION_MS` (the longest offered option) from now, so a
structurally-valid but corrupt far-future value (e.g. a year-2100 timestamp) is
also treated as not muted. Together these two layers are what deliver the
guarantee: a corrupt value must never be able to wedge the system into
permanent silence; the worst outcome of a bad read is a notification the admin
wanted suppressed, not a notification that never arrives.

That ceiling is coupled to the duration ladder, and the coupling is load-
bearing: it is what caps the blast radius of a corrupt row at one maximum
window. Widening the ladder widens the ceiling, so a longer option is a
deliberate weakening of the corruption guarantee, not a free UI change.

### The duration ladder

`src/features/shared/utils/muteDurations.ts` holds the ladder as a shared,
isomorphic contract. The Settings dropdown renders it and the `POST` handler
validates against it, so the two cannot drift — an option the client offers but
the server rejects would look like a broken button.

It lives in `shared/` rather than in either feature because features must never
import from one another, and this is genuinely one value used by both sides of
a request. The architecture's "prefer duplication over coupling" guidance does
not apply: duplicating a contract whose halves must agree is how the halves
stop agreeing.

Validation is an **allowlist**, not a range check. A range would accept any
value up to six hours, including absurdly precise ones, and would let the set
of reachable deadlines grow without bound; the ladder keeps that set small and
known, which is also what keeps the corruption ceiling meaningful.

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

Both `GET` and `POST /api/push/mute` resolve the session `sub`, then re-read
`userStore.isAdmin(sub)` on every call: `401` with no session, `403` for a
signed-in non-admin. `GET` is admin-gated the same as `POST` so mute state
itself is never leaked to a non-admin caller. The client-side gate — the
section renders `null` unless `GET /api/push/mute` reported `isAdmin: true` —
is presentation only. Admin status is never carried in the session cookie or
in router context, so demoting a user takes effect on their next request
rather than their next login.

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
- **Cancelling is a duration, not a separate control.** Submitting **Off** is
  how an active mute is cleared, rather than a second "cancel" button appearing
  only while muted. One submit path means one server handler, one validation
  rule and one state machine; the cost is that "resume now" reads as a dropdown
  choice rather than an obvious standalone action.
- **The button stays enabled while a mute is active.** It was disabled when the
  only possible action was starting a fixed window. Now it is needed precisely
  _during_ a mute — to shorten it, extend it, or clear it — so disabling it
  would lock the admin out of the control for as long as the mute they want to
  change is running.
- **Last write wins, and a re-submit restarts rather than extends.** Two admins
  submitting concurrently is a single-row upsert; no locking, no merge.
  Submitting again replaces the deadline with `now + durationMs`, so choosing a
  shorter duration during a longer mute shortens it. That is the intuitive
  reading of "mute for 30 minutes" and it keeps clearing (duration 0) on the
  same path, but it does mean a mute can be silently cut short by a second
  admin who picked a smaller number.
- **Server clock only.** The deadline is compared against the server's clock in
  the dispatchers and against the browser's clock only for the countdown
  display. A skewed client shows a wrong countdown; it cannot change when the
  mute actually ends.

## Related

- `docs/specs/user-table-admin-flag.md` — where `is_admin` comes from
- `docs/specs/mqtt-push-notifications.md` — the pipeline this suppresses
- `docs/specs/camera-availability-notifications.md` — the second dispatcher
- `docs/specs/camera-motion-notification-dedup.md` — burst/patch semantics
