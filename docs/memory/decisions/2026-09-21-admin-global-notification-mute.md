---
tags: [decision, push, admin, sqlite, security]
created: 2026-09-21
---

# Admin-triggered global notification mute, persisted and enforced at dispatch

> An admin picks a duration — Off, or 10 minutes up to 6 hours — and every
> user's push notifications stop until it lapses; Off clears an active mute.
> The deadline is a row in SQLite, not a variable, and it is enforced at the two
> dispatchers — so events keep flowing, only the outbound push is dropped.

## Context

`is_admin` existed but nothing read it (see
[[decisions/2026-09-21-users-table-and-admin-flag]], whose "nothing consumes
`is_admin` yet" note this decision retires). The first thing to need it is a
blunt, temporary off-switch for notifications.

The motivating case is physical: someone is working in front of a camera, and
every subscribed device in the household is being pelted with motion alerts for
as long as it lasts. The controls that existed were all per-user and per-camera
— a user could opt one camera out of motion alerts, or unsubscribe their own
device — so sparing everyone meant every user acting individually, which is
exactly what an admin wants to avoid, and then remembering to undo it.

## Decision

**A single global deadline, stored in SQLite.** A new `push_global_settings`
key/value table holds `notification_mute_until` as an epoch-millisecond
timestamp in text. `applyNotificationMute(durationMs)` writes
`now + durationMs`; `areNotificationsMuted(now)` compares the stored deadline
against the caller's clock. A `durationMs` of 0 writes `0`, which every read
path already sees as lapsed — so clearing a mute needs no separate column, no
delete, and no "never muted" vs "explicitly resumed" distinction.

The duration comes from a fixed ladder in
`src/features/shared/utils/muteDurations.ts` (Off, 10m, 30m, 1h, 2h, 4h, 6h),
validated server-side as an **allowlist**. It lives in `shared/` because the
dropdown and the handler must agree and features may not import from one
another; duplicating a contract whose halves must agree is how they stop
agreeing. The default is Off, so submitting without touching the dropdown
resumes rather than silences.

Four properties hold this together:

1. **Persisted, not in-memory.** A module-level variable would have been the
   obvious fit for a single-process Bun server, and it fails in the one case
   that matters: a deploy or crash-restart inside the window un-mutes silently
   and lets the alert storm through, at the moment nobody is looking.
2. **Fail-closed on read, in the safe direction, in two layers.**
   `parseMuteUntil()` in `push-store.ts` accepts only a non-negative safe
   integer, so a missing row, an empty string, or garbage like `"1e100"`
   (finite but not a safe integer) reads as **not muted**. `isMuteActive()` in
   `notification-mute.ts` additionally caps a deadline at `MAX_MUTE_DURATION_MS`
   (the longest offered option) from now, so a structurally-valid but corrupt
   far-future value (a year-2100 timestamp) is also treated as not muted. That
   ceiling is coupled to the ladder on purpose, and the coupling is load-
   bearing: adding a longer option widens the blast radius of a corrupt row by
   the same amount, so it is a deliberate weakening of this guarantee rather
   than a free UI change. Together these deliver the
   guarantee that a corrupt value can never wedge the system into permanent
   silence. Note the polarity is the opposite of `toIsAdmin()`: for a
   permission flag, safe means "deny"; here, safe means "deliver". A store
   error is logged and treated as not muted for the same reason.
3. **Expiry is never written.** The read path compares and returns; there is no
   sweep job, no flag to clear, and no write when a mute lapses.
4. **Enforced at the dispatchers, not upstream.** `notifyUsersForCamera()` and
   `notifyUsersForCameraAvailability()` each return early when muted. Everything
   before them keeps running: MQTT stays subscribed, `frigate/events` still
   clears the Frigate cache, the `EventBatcher` still batches and still tracks
   burst boundaries, and `CameraAvailabilityTracker` still counts zero-fps
   readings and still flips state. Only the send is dropped.

**"Silent" means not sent.** Not `silent: true` on the payload — iOS re-alerts
on those anyway ([[gotchas/ios-ignores-silent-and-renotify]]), so a silent-flag
implementation would work on Android and desktop and fail on the platform this
app treats as first-class ([[decisions/2026-04-17-cross-platform-pwa-first]]).

**Authorization is re-read per request.** Both `GET` and `POST
/api/push/mute` resolve the session `sub` and then call
`userStore.isAdmin(sub)`: `401` unauthenticated, `403` signed-in non-admin.
`GET` is gated identically to `POST` so mute state is never returned to a
non-admin. Admin status is deliberately **not** put in the
session cookie or in router context — that was alternative 1 of the users-table
decision and it stays rejected. The client-side gate (the Settings section
renders `null` unless `GET /api/push/mute` reported `isAdmin: true`) is
presentation only.

## Alternatives

1. **In-memory module state.** Simplest possible, and the restart hole above
   makes it wrong precisely when it is being relied on.
2. **Reuse `push_notification_preferences` with a synthetic user row.** Avoids
   a new table at the cost of a `user_id` that is not a user and an `enabled`
   column holding a timestamp. A three-column key/value table is smaller than
   the explanation.
3. **Suppress at the `EventBatcher` instead.** Drops events earlier and saves a
   little work, but loses burst tracking across the window: the first event
   after the mute would be classified as a continuation and would silently patch
   a notification nobody ever saw.
4. **Per-user snooze.** Useful, and a different feature — it requires every user
   to act, which is the thing being avoided.
5. **Send with `silent: true`.** Rejected on iOS behaviour, above.
6. **A separate early-cancel button.** The original fixed-window version
   deferred cancelling entirely. With selectable durations a mute can run for
   six hours, so waiting it out stopped being acceptable — but cancelling
   became the `Off` rung of the ladder rather than a second control, keeping
   one submit path, one handler and one validation rule.
7. **A free-form minutes input, or a range check instead of an allowlist.**
   Rejected — it makes the set of reachable deadlines unbounded, which is
   exactly what the corruption ceiling relies on being small and known.

## Why it matters

**The mute is not "no push can leave the server".** The explicit _Send Test
Notification_ button stays live during a window. It is a one-device,
user-initiated check of that device's own plumbing, and someone debugging a
broken subscription mid-mute should not be told, misleadingly, that push is
dead. The property actually being enforced is narrower and more useful: no
_event_ reaches a user unbidden. Anyone adding a third automatic dispatcher must
add the `areNotificationsMuted()` guard to it — the guard lives at each call
site, not inside `sendPushNotification()`, and that is a conscious trade of
one-line duplication for not silencing deliberate sends.

**Nothing is lost, only delayed-and-dropped.** Events that occur during a window
are still recorded by Frigate, still visible in the app the moment anyone opens
it, and still in the cache-invalidation path. A camera that goes offline during
a mute and is still offline afterwards does not re-announce itself, because the
transition already fired — the alert is dropped, not queued.

## Related

- [[Home]]
- [[decisions/2026-09-21-users-table-and-admin-flag]] — the `is_admin` flag this
  is the first consumer of
- [[decisions/2026-08-02-alert-once-per-burst-then-patch]] — the burst tracking
  that enforcing at dispatch preserves
- [[decisions/2026-08-18-camera-availability-detection]] — the second dispatcher
- [[gotchas/ios-ignores-silent-and-renotify]] — why "silent" means "not sent"
- `docs/specs/admin-global-notification-mute.md` — the fuller design write-up
