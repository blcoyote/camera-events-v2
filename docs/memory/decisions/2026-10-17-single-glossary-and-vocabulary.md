---
tags: [decision, glossary, domain]
created: 2026-10-17
---

# CONTEXT.md is the only domain glossary; vocabulary settled

> Domain terms live in `CONTEXT.md` alone. The vault glossary keeps tooling terms
> only. Same change settles Ghost, Alert, Availability, Device, Favorite and
> Patch-count wording, and records that Test push is never muted.

## Context

Two glossaries described the same domain. The vault `glossary.md` defined
Frigate, Event, Review and Event batching; `CONTEXT.md` defined the same words,
more precisely. They had drifted: the vault called an Event a "motion
occurrence" while `CONTEXT.md` separates Detection from Event. A stress test of
the domain model also found terms used two ways: "saved" for both Frigate
persistence and favoriting, "Alert" for both the opening notification and any
loud one, "ghost event" for something that is, at first, merely pending, and
"subscription" for both a Device and a Preference.

## Decision

- **`CONTEXT.md` is the sole domain glossary.** `docs/memory/glossary.md` keeps
  only tooling terms (VAPID, Standalone (iOS), Feature slice, Server function)
  and points to `CONTEXT.md`.
- **Ghost detection, not Ghost event.** A Detection not saved within the
  2-minute grace window. Inside the window it is a Pending detection, matching
  the detail page's `pending` state from
  [[decisions/2026-08-29-ghost-event-notifications]]. The ADR title keeps the
  old wording as history.
- **Alert** is any notification that sounds or vibrates, including iOS Patches
  and Availability notifications. The **opening Alert** is the one that opens a
  Burst.
- **Availability** and **Availability notification** name camera Offline/Online
  state and the push about a change. Avoid "offline alert".
- **Device** is one push subscription (one endpoint). Avoid "Subscription" for
  it; `subscription` stays on the Preference avoid-list.
- **Favorite** is the user's marker on an Event; **saved** means only that
  Frigate persisted the Event. Retention is a separate term.
- **Admin** and **Patch window** are added as terms.
- **Patch count** documents current behaviour: detections since the last
  visible notification. Apple pacing and user dismissal can make it undercount.
  No server change.
- **Test push is never muted.** It stays outside Delivery, so Mute does not
  apply. See [[decisions/2026-09-21-admin-global-notification-mute]].

## Alternatives

1. **Keep two glossaries.** Rejected: it is what produced the drift above.
2. **Change the Patch count to a burst total.** Rejected for now: it needs
   server state per Burst; documenting the current meaning costs nothing.
3. **Treat Test push as a muted kind.** Rejected: it is a deliberate one-device
   plumbing check, and silencing it would mislead someone debugging a broken
   Device.

## Why it matters

One glossary means one place to fix a word. The Pending/Ghost split and the
Favorite/saved split stop two different facts sharing one name in code, UI copy
and conversation.

## Related

- [[Home]]
- [[glossary]]
- [[decisions/2026-08-29-ghost-event-notifications]]
- [[decisions/2026-10-14-delivery-module]]
