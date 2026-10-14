---
tags: [decision, push, architecture, mute]
created: 2026-10-14
---

# One Delivery module owns Mute, fan-out and send

> Motion and camera-availability notifications share a single Delivery module
> (`push-notifications/server/delivery.ts`) that gates on Mute, fans out to
> eligible users' devices and sends. Each notification kind is a thin policy over
> it. Delivery also remembers a Burst Alert that Mute swallowed, so the first
> unmuted flush afterwards is promoted to an Alert instead of patching nothing.

## Context

[[decisions/2026-09-21-admin-global-notification-mute]] enforced Mute "at the
two dispatchers": `notifyUsersForCamera()` and
`notifyUsersForCameraAvailability()` each repeated the push-enabled guard, the
Mute check, the subscribed-user loop, the Preference check and the
send-with-error-isolation loop. A third notification kind would have had to
copy the Mute gate and remember to do so.

The copy also hid a bug. `EventBatcher` decides `burstStart` before Mute is
checked (it must keep tracking Bursts through a Mute, per the Mute ADR). A Burst
that opened while muted had its Alert dropped; if detections continued and the
Mute lapsed mid-Burst, the next flush was a continuation and went out as a
silent Patch on Android and desktop. The user was never alerted to that Burst.
That is exactly the failure the Mute ADR cites against suppressing at the
batcher, reproduced by suppressing after it. Fixed first as ce-d44.

## Decision

1. **`createDelivery(deps?)` returns `{ deliver(request) }`.** Delivery owns the
   push-enabled guard, the Mute gate, `getAllSubscribedUserIds`, per-user
   eligibility, per-device send, and per-device error isolation (one failing
   device never stops the rest).
2. **Callers supply a policy**, not a kind flag: `isUserEligible`, `buildPayload`,
   an optional `allowEndpoint` filter, an optional `burst: { key, start }`. A
   third notification kind adds a policy and does not touch Delivery. Motion
   supplies the per-camera Preference, the Burst-aware payload and the Apple
   pacing; availability supplies the global opt-in and nothing else.
3. **Promotion state lives in the Delivery instance.** When Mute swallows a flush
   with `burst.start`, the burst key is remembered. The next unmuted delivery for
   that key is treated as `burstStart: true` and the entry is cleared; a natural
   new Burst clears it too. A muted continuation records nothing, because that
   Burst's Alert was already delivered before the Mute, so Patches afterwards
   stay Patches. The promoted Alert is a normal Alert built from that flush's
   events only; it does not mention the Mute.
4. **Dependencies are injected with production defaults.** `isPushEnabled`,
   `isMuted`, `getStore`, `send` and `now` default to the real modules. Production
   web-push and an in-memory fake are two adapters, so the seam is real, and
   `delivery.test.ts` uses no `vi.mock`.
5. **`handleTest` stays outside.** The test-push endpoint deliberately bypasses
   Mute; routing it through Delivery would need a bypass flag that any caller
   could set by accident.
6. **`EventBatcher` is unchanged.** It keeps tracking Bursts through a Mute.

## Deviation from the plan

The Apple update throttle and the `now` override remain per-call options on
`notifyUsersForCamera` (`NotifyOptions.throttle` / `now`), and the throttle is
still an import-time singleton in `push-notify.ts`. The motion policy owns it,
as intended, but it is not injected through Delivery's dependencies. Moving the
wiring to one construction point is a separate, weaker candidate.

## Alternatives

1. **Suppress at `EventBatcher` via an `isMuted` query.** Rejected for the reason
   in the Mute ADR, and it would give the batcher a Mute dependency.
2. **Promotion state in `mqtt.ts` `dispatchBatch`.** The glue between batcher and
   notifier would hold behaviour the notifier cannot be tested without.
3. **Leave the bug documented.** Leaves a Patch with no Alert on screen.
4. **Delivery branches on notification kind.** Every new kind would edit Delivery.
5. **Route `handleTest` through Delivery with a bypass option.** Rejected above.

## Why it matters

Mute, Preference and Burst promotion now change in one module and are tested
through one interface. Changing the Mute rules (per-camera Mute, letting offline
alerts through) touches Delivery instead of both dispatchers. See also
[[decisions/2026-08-02-alert-once-per-burst-then-patch]] and the Delivery entry
in `CONTEXT.md`.
