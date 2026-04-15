import { useState, useEffect, useCallback } from 'react'

export interface UsePushSubscriptionReturn {
  /** Browser supports Push API */
  isSupported: boolean
  /** Server has VAPID keys configured */
  isPushEnabled: boolean
  /** Current notification permission state */
  permissionState: NotificationPermission
  /** User has an active push subscription */
  isSubscribed: boolean
  /** An async operation is in progress */
  isLoading: boolean
  /** Last error message, if any */
  error: string | null
  /** Request permission and subscribe to push */
  subscribe: () => Promise<void>
  /** Unsubscribe from push */
  unsubscribe: () => Promise<void>
  /** Send a test notification, returns number of devices notified */
  sendTest: () => Promise<number>
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  // All browser-only values start as safe defaults so server and client
  // produce identical initial markup (avoids hydration mismatch).
  const [isSupported, setIsSupported] = useState(false)
  const [isPushEnabled, setIsPushEnabled] = useState(false)
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null)

  // Detect browser support and fetch VAPID key / existing subscription on mount
  useEffect(() => {
    const supported = typeof globalThis.PushManager !== 'undefined'
    setIsSupported(supported)

    if (typeof globalThis.Notification !== 'undefined') {
      setPermissionState(Notification.permission)
    }

    if (!supported) return

    let cancelled = false

    async function init() {
      try {
        // Fetch VAPID public key
        const res = await fetch('/api/push/vapid-public-key')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setVapidPublicKey(data.publicKey)
            setIsPushEnabled(true)
          }
        }

        // Check existing subscription
        const registration = await navigator.serviceWorker.ready
        const existingSub = await registration.pushManager.getSubscription()
        if (!cancelled && existingSub) {
          setCurrentSubscription(existingSub)
          setIsSubscribed(true)
        }
      } catch {
        // Silently fail — push just won't be available
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      setPermissionState(permission)

      if (permission !== 'granted') {
        setError(permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Notification permission was not granted.')
        return
      }

      // Get VAPID key if not already fetched
      let key = vapidPublicKey
      if (!key) {
        const res = await fetch('/api/push/vapid-public-key')
        if (!res.ok) throw new Error('Could not fetch VAPID key')
        const data = await res.json()
        key = data.publicKey
        setVapidPublicKey(key)
      }

      // Subscribe via PushManager
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key!,
      })

      // Send to server
      const subJson = subscription.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })

      if (!res.ok) {
        // Roll back local subscription
        await subscription.unsubscribe()
        setError('Could not enable notifications. Please try again.')
        return
      }

      setCurrentSubscription(subscription)
      setIsSubscribed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe')
    } finally {
      setIsLoading(false)
    }
  }, [vapidPublicKey])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (currentSubscription) {
        const endpoint = currentSubscription.endpoint
        await currentSubscription.unsubscribe()

        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }

      setCurrentSubscription(null)
      setIsSubscribed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe')
    } finally {
      setIsLoading(false)
    }
  }, [currentSubscription])

  const sendTest = useCallback(async (): Promise<number> => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        throw new Error('Failed to send test notification')
      }

      const data = await res.json()
      return data.sent ?? 0
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test')
      return 0
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isSupported,
    isPushEnabled,
    permissionState,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  }
}
