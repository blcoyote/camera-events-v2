import { getLocale } from '#/paraglide/runtime.js'

/**
 * Best-effort re-registration of the browser's current push subscription with
 * the server. Web Push subscriptions can be silently invalidated server-side
 * (the DB row is deleted on a 410/404 send failure) or rotated by the push
 * service; re-POSTing keeps the server DB in sync — an idempotent upsert on
 * (user_id, endpoint). Failures are swallowed on purpose: this is background
 * maintenance and must never surface an error to the user or change any
 * visible subscription state.
 *
 * Isomorphic-safe: no server-only imports, and browser APIs are only touched
 * at call time (never at import). Only call it from client effects.
 *
 * @returns true if the server accepted the re-sync, false otherwise.
 */
export async function resyncSubscription(
  subscription: Pick<PushSubscription, 'toJSON'>,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  try {
    const subJson = subscription.toJSON()
    const res = await fetchFn('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        locale: getLocale(),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Look up the browser's current push subscription (if any) and re-sync it with
 * the server. Safe to call on every app open: if the browser has no
 * subscription, or the Push API is unavailable (SSR, unsupported browser), it
 * resolves to false without a network request. All errors are swallowed.
 *
 * @returns true if a subscription existed and the server accepted the re-sync.
 */
export async function resyncExistingPushSubscription(
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    typeof globalThis.PushManager === 'undefined'
  ) {
    return false
  }
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false
    return resyncSubscription(subscription, fetchFn)
  } catch {
    return false
  }
}

/**
 * Sign-out helper: tell the server to forget this device's push subscription,
 * and unsubscribe in the browser concurrently, so a hung POST can't block the
 * latter (otherwise the next app open re-POSTs it via
 * resyncExistingPushSubscription). Must run while the session is still valid.
 * Never throws and is bounded by `timeoutMs` (serviceWorker.ready can hang
 * forever when no SW is registered).
 */
export async function dropPushSubscription(
  fetchFn: typeof fetch = globalThis.fetch,
  timeoutMs = 2000,
): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    typeof globalThis.PushManager === 'undefined'
  ) {
    return
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  const work = (async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return
      const endpoint = subscription.endpoint
      // Concurrent: a POST hanging past the timeout must not stop the local unsubscribe.
      await Promise.allSettled([
        fetchFn('/api/push/unsubscribe', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }),
        subscription.unsubscribe(),
      ])
    } catch {
      // Never block sign-out.
    }
  })()
  await Promise.race([work, timeout])
  clearTimeout(timer)
}
