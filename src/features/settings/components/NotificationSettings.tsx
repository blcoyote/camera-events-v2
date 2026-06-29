import { useState, useEffect, useCallback } from 'react'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { NotificationSection } from './NotificationSection'
import { CameraPreferences } from './CameraPreferences'
import type { CameraPref } from './CameraPreferences'

export function NotificationSettings() {
  const {
    isSupported,
    isPushEnabled,
    permissionState,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushSubscription()

  const [testResult, setTestResult] = useState<string | null>(null)
  const [hasMounted, setHasMounted] = useState(false)
  const [cameraPrefs, setCameraPrefs] = useState<CameraPref[]>([])
  const [prefsLoading, setPrefsLoading] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const loadPreferences = useCallback(async () => {
    setPrefsLoading(true)
    try {
      const res = await fetch('/api/push/preferences', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCameraPrefs(data.cameras ?? [])
      }
    } catch {
      // Silently fail — preferences section will just not appear
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  // Load camera preferences when subscribed
  useEffect(() => {
    if (isSubscribed) {
      loadPreferences()
    }
  }, [isSubscribed, loadPreferences])

  // Before the client effect runs, render a neutral placeholder so SSR
  // and initial client markup match (avoids hydration mismatch).
  if (!hasMounted) {
    return (
      <NotificationSection>
        <div className="h-6" />
      </NotificationSection>
    )
  }

  // Browser doesn't support Push API
  if (!isSupported) {
    return (
      <NotificationSection>
        <p className="text-sm text-(--sea-ink-soft)">
          Push notifications are not supported in this browser.
        </p>
      </NotificationSection>
    )
  }

  // Server doesn't have VAPID keys
  if (!isPushEnabled) {
    return (
      <NotificationSection>
        <p className="text-sm text-(--sea-ink-soft)">
          Push notifications are not available on this server.
        </p>
      </NotificationSection>
    )
  }

  // Permission permanently denied
  if (permissionState === 'denied' && !isSubscribed) {
    return (
      <NotificationSection>
        <p className="text-sm text-(--sea-ink-soft)">
          Notifications are blocked in your browser settings.
        </p>
        <p className="mt-2 text-xs text-(--sea-ink-soft)">
          To unblock: in <strong>Chrome</strong>, click the lock icon in the
          address bar &gt; Site settings &gt; Notifications &gt; Allow. In{' '}
          <strong>Safari</strong>, go to Settings &gt; Websites &gt;
          Notifications and allow this site.
        </p>
      </NotificationSection>
    )
  }

  async function handleSubscribe() {
    setTestResult(null)
    await subscribe()
  }

  async function handleUnsubscribe() {
    setTestResult(null)
    await unsubscribe()
  }

  async function handleSendTest() {
    setTestResult(null)
    const sent = await sendTest()
    if (sent > 0) {
      setTestResult(`Test sent to ${sent} device${sent !== 1 ? 's' : ''}.`)
    }
  }

  async function handleToggleCamera(camera: string, enabled: boolean) {
    // Optimistic update
    setCameraPrefs((prev) =>
      prev.map((c) => (c.name === camera ? { ...c, enabled } : c)),
    )
    try {
      const res = await fetch('/api/push/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera, enabled }),
      })
      if (!res.ok) {
        // Revert on failure
        setCameraPrefs((prev) =>
          prev.map((c) =>
            c.name === camera ? { ...c, enabled: !enabled } : c,
          ),
        )
      }
    } catch {
      // Revert on network error
      setCameraPrefs((prev) =>
        prev.map((c) => (c.name === camera ? { ...c, enabled: !enabled } : c)),
      )
    }
  }

  return (
    <NotificationSection>
      <div className="flex flex-col gap-4">
        {isSubscribed ? (
          <>
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-(--sea-ink)">
                Notifications are enabled
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={isLoading}
                className="min-h-11 rounded-full border border-(--chip-line) bg-(--chip-bg) px-4 py-2 text-sm font-medium text-(--sea-ink) transition hover:bg-(--chip-bg)/80 disabled:opacity-50"
              >
                {isLoading ? 'Working...' : 'Disable Notifications'}
              </button>
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isLoading}
                className="min-h-11 rounded-full border border-(--accent-strong-border) bg-(--accent-strong-bg) px-4 py-2 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-(--accent-strong-hover-bg) disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Test Notification'}
              </button>
            </div>
            {cameraPrefs.length > 0 && (
              <CameraPreferences
                cameras={cameraPrefs}
                loading={prefsLoading}
                onToggle={handleToggleCamera}
              />
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-(--sea-ink-soft)">
              Enable push notifications to receive alerts on this device.
            </p>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={isLoading}
              className="min-h-11 w-fit rounded-full border border-(--accent-strong-border) bg-(--accent-strong-bg) px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-(--accent-strong-hover-bg) disabled:opacity-50"
            >
              {isLoading ? 'Working...' : 'Enable Notifications'}
            </button>
          </>
        )}

        {/* Status messages */}
        <div aria-live="polite" className="min-h-5">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {testResult && !error && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {testResult}
            </p>
          )}
        </div>
      </div>
    </NotificationSection>
  )
}
