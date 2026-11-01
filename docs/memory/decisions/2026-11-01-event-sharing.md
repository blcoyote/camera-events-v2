---
tags: [decision, sharing, favorites, retention, push]
created: 2026-11-01
---

# Event sharing: separate shares table, combined Retention count

> Shares live in their own `event_shares` table next to `event_favorites`.
> Retention counts both. The push for a share goes out through Delivery with
> Mute bypassed, behind `POST /api/events/$id/share`.

## Context

Users want to send an Event to other family members. The recipient gets a
notification, and the Event appears on their Favorites page with a shared icon
instead of a heart. Spec: `docs/specs/event-sharing.md`.

## Decision

- **Own table:** `event_shares(event_id, sender_id, recipient_id, created_at)`,
  unique per triple, in the favorites store (same DB file). One Event can be
  hearted and shared at the same time, and shared by several people. A `kind`
  column on `event_favorites` could not represent that cleanly.
- **Retention = Favorites + Shares.** Retain when the first Favorite or Share is
  added, unretain when the last is removed (`getReferenceCount`). Otherwise
  Frigate could delete a shared Event before the recipient opens it.
- **Mute does not apply.** A share is one person messaging another, so
  `DeliveryRequest.ignoreMute` skips the admin Mute. Per-camera Preferences are
  not consulted either. It is always an Alert with tag `share:<eventId>`, so it
  never merges into a camera Burst.
- **Feature boundaries:** the UI (`camera-details`) calls an HTTP route.
  The route imports the `push-notifications` handler, which uses the shared
  store and retention helpers. No feature imports another.
- **Recipients remove, senders don't.** Recipients can remove a share (only
  their own rows). Senders see no history and cannot unshare.

## Alternatives

- `kind` column on `event_favorites`: rejected, see above.
- `navigator.share` (OS share sheet): it cannot list app users. Only the icon
  follows the OS.
- Respect Mute for shares: rejected, a share is a deliberate message.

## Why it matters

Whoever changes Retention or Delivery next must keep shares in the reference
count and keep `ignoreMute` limited to deliberate, user-initiated sends.

## Related

- [[Home]]
- [[decisions/2026-10-14-delivery-module]]
