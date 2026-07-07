---
tags: [gotchas, push, pwa]
created: 2026-07-07
---

# Push Subscriptions Silently Desync From the Server DB

> A device can stop receiving Web Push while the UI still shows "subscribed",
> because the browser subscription and the server DB row drift apart.

## Context

Users reported that notifications "just stopped showing up" with no error and no
change in the Settings UI, which still displayed an active subscription.

## What we know

Two independent forces delete or invalidate a subscription without the other
side finding out:

- **Server-side cleanup.** `sendPushNotification` (`push.ts`) deletes the
  `push_subscriptions` row on a `410 Gone` / `404` from the push service. This
  is correct cleanup, but nothing ever re-creates the row.
- **Endpoint rotation.** Push services (FCM/Apple/Mozilla) rotate endpoints. The
  browser then holds a subscription the server has no row for.

The client hook `usePushSubscription` reads `pushManager.getSubscription()` on
mount and, if a subscription object exists, shows `isSubscribed = true` — so the
UI looks healthy even when the server has no matching row. Result: no pushes,
and the UI misrepresents reality.

**Fix:** on app open, `usePushSubscription` re-POSTs the browser's current
subscription to `/api/push/subscribe`. `saveSubscription` is an idempotent
upsert on `(user_id, endpoint)`, so this restores a cleaned-up row and updates
rotated keys. The re-sync (`resyncSubscription`) is best-effort and
fire-and-forget: failures (e.g. an expired session → 401) are swallowed and
never change the visible subscription state.

## Why it matters

- Camera opt-out **preferences** live in a separate table keyed by user, so they
  survive independently — only the **subscription row** needs re-syncing.
- Don't rely on `PushSubscription.expirationTime` to detect this; it is almost
  always `null` in practice. Re-registering on open is the robust repair.
- Applies to both iOS standalone and Android — subscription lifetime differs per
  platform, so a manual "toggle off/on in Settings" is not an acceptable fix.

## Related

- [[architecture/push-pipeline]]
- [[Home]]
