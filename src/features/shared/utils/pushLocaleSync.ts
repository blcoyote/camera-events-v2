import { getLocale } from '#/paraglide/runtime.js'

/**
 * Tell the server which language this device's push subscription should use.
 * Best-effort background maintenance: no subscription or no service worker
 * support is a no-op, and errors are logged, never thrown. Client-only.
 */
export async function syncPushLocale(
  locale: 'en' | 'da' = getLocale(),
): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    await fetch('/api/push/locale', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, locale }),
    })
  } catch (err) {
    console.warn('[push] locale sync failed:', err)
  }
}
