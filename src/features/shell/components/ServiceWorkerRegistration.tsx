import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '#/features/shared/components/ui/button'
import { resyncExistingPushSubscription } from '#/features/shared/utils/pushResync'

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  // Tracks whether the user explicitly clicked "Update now" so the
  // controllerchange handler knows it's safe to reload even when the page
  // was uncontrolled at load time (e.g. first install + clientsClaim).
  const updateRequestedRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg
        // Force a byte-comparison check against the server on every page load
        // so SW updates are detected without requiring a full hard reload.
        reg.update().catch(() => {})

        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return

          const checkInstalled = () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(installing)
            }
          }
          // Guard against a race where the SW transitions before the listener
          // is attached (can happen when sw.js is served from cache quickly).
          installing.addEventListener('statechange', checkInstalled)
          checkInstalled()
        })
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error)
      })

    const claimPendingNavigation = () => {
      navigator.serviceWorker.ready
        .then((reg) => {
          const worker = reg.active ?? navigator.serviceWorker.controller
          worker?.postMessage({ type: 'CLAIM_NAVIGATION' })
        })
        .catch(() => {
          // No active SW yet; controllerchange will claim on next activation
        })
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'PENDING_NAVIGATION_AVAILABLE') {
        claimPendingNavigation()
        return
      }
      if (
        data?.type === 'NAVIGATE' &&
        typeof data.url === 'string' &&
        data.url.startsWith('/') &&
        !data.url.startsWith('//') &&
        !data.url.startsWith('/\\')
      ) {
        const currentPath = window.location.pathname + window.location.search
        if (data.url !== currentPath) {
          window.location.assign(data.url)
        }
      }
    })

    // On every mount, ask the SW whether a notificationclick queued a URL
    // we still need to navigate to. Handles the iOS cold-start case where
    // the PWA launched at start_url instead of the notification's URL.
    claimPendingNavigation()

    // Repair any server/client push-subscription drift on app open.
    void resyncExistingPushSubscription()

    // Reload when the controller changes. Allow the reload when:
    //   a) An old SW was already controlling the page at load (normal update), OR
    //   b) The user explicitly clicked "Update now" (handles first-install +
    //      clientsClaim case where hadControllerAtLoad is false).
    const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerAtLoad && !updateRequestedRef.current) return
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registration?.update().catch(() => {})
        void resyncExistingPushSubscription()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleUpdate = useCallback(() => {
    updateRequestedRef.current = true
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
    setWaitingWorker(null)
  }, [waitingWorker])

  const handleDismiss = useCallback(() => {
    setWaitingWorker(null)
  }, [])

  if (!waitingWorker) return null

  return (
    <div
      role="alert"
      className="glass fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 mx-auto max-w-md animate-[slideUp_280ms_ease-out] rounded-card px-5 py-4 sm:left-auto"
    >
      <p className="text-sm font-medium text-foreground">
        A new version is available.
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={handleUpdate}>
          Update now
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleDismiss}
        >
          Later
        </Button>
      </div>
    </div>
  )
}
