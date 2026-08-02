---
tags: [gotcha, ios, pwa, push-notifications, service-worker]
created: 2026-08-02
---

# ⚠️ iOS ignores `silent` and `renotify` on notifications

> You cannot patch a notification quietly on iOS. Same-tag replacement keeps the
> **list** at one entry, but the device still alerts.

## What bites

`showNotification()` accepts `silent: true` (don't play sound/vibrate) and
`renotify: false` (replace without re-alerting). Chrome, Android, and desktop
browsers honour both. **iOS Safari — including standalone PWAs — ignores both.**

So the natural "update the notification in place without bothering the user"
pattern only half-works there:

| Behaviour                            | Android / desktop | iOS       |
| ------------------------------------ | ----------------- | --------- |
| Same tag replaces the existing entry | ✅                | ✅        |
| Body / count updates in place        | ✅                | ✅        |
| Suppresses the sound / vibration     | ✅                | ❌ alerts |

The list-clutter half of the problem is solved on both platforms. The
alert-fatigue half is not solvable client-side on iOS.

## What to do instead

Pace the pushes **server-side** for Apple devices, since you cannot pace the
alerts client-side. Apple endpoints are identifiable by host:

```ts
new URL(endpoint).host === 'web.push.apple.com'
```

`SendThrottle` in `src/features/push-notifications/server/send-throttle.ts`
limits update pushes to Apple endpoints to one per 5 minutes per
camera-and-device, while other platforms receive every update immediately. Match
the host exactly — a `.endsWith()` check would accept
`web.push.apple.com.evil.example`.

Do **not** solve this by skipping the push entirely on iOS: iOS expects every
push it delivers to result in a visible notification, and repeatedly failing to
show one can get the subscription revoked. Not sending is fine; receiving and
staying silent is not.

## Also watch for

`ServiceWorkerRegistration.getNotifications()` is not dependable across older
Safari builds. `readExistingState()` wraps it in a try/catch and treats both a
missing method and a throw as "nothing on screen", which degrades to alerting
instead of patching rather than crashing the `push` handler.

## Related

- [[decisions/2026-08-02-alert-once-per-burst-then-patch]]
- [[decisions/2026-04-17-cross-platform-pwa-first]]
- [[gotchas/push-subscription-desync]]
- [[Home]]
