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
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const subJson = subscription.toJSON()
    const res = await fetchFn('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
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
  fetchFn: typeof fetch = fetch,
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
