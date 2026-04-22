import { useCallback, useEffect, useState } from 'react'

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(installing)
            }
          })
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

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }, [])

  const handleUpdate = useCallback(() => {
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
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 mx-auto max-w-md animate-[slideUp_300ms_ease-out] rounded-2xl border border-(--line) bg-(--surface-strong) px-5 py-4 shadow-[0_8px_32px_rgba(30,90,72,0.18)] backdrop-blur-lg sm:left-auto"
    >
      <p className="text-sm font-medium text-(--sea-ink)">
        A new version is available.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleUpdate}
          className="inline-flex min-h-11 items-center rounded-full border border-[rgba(50,143,151,0.4)] bg-[rgba(79,184,178,0.18)] px-4 py-2 text-sm font-semibold text-(--lagoon-deep) transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.28)]"
        >
          Update now
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex min-h-11 items-center rounded-full border border-(--chip-line) bg-(--chip-bg) px-4 py-2 text-sm font-semibold text-(--sea-ink-soft) transition hover:text-(--sea-ink)"
        >
          Later
        </button>
      </div>
    </div>
  )
}
