import { useState, useEffect, useCallback } from 'react'
import { usePushSubscription } from '../hooks/usePushSubscription'

interface CameraPref {
  name: string
  enabled: boolean
}

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
      const res = await fetch('/api/push/preferences')
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
                className="rounded-full border border-(--chip-line) bg-(--chip-bg) px-4 py-2 text-sm font-medium text-(--sea-ink) transition hover:bg-(--chip-bg)/80 disabled:opacity-50"
              >
                {isLoading ? 'Working...' : 'Disable Notifications'}
              </button>
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isLoading}
                className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50"
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
              className="w-fit rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50"
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

function formatCameraName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function CameraPreferences({
  cameras,
  loading,
  onToggle,
}: {
  cameras: CameraPref[]
  loading: boolean
  onToggle: (camera: string, enabled: boolean) => void
}) {
  return (
    <div className="mt-2 border-t border-(--chip-line) pt-5">
      <h3 className="mb-3 text-sm font-semibold text-(--sea-ink)">
        Camera Notifications
      </h3>
      <p className="mb-4 text-xs text-(--sea-ink-soft)">
        Choose which cameras send you push notifications.
      </p>
      {loading ? (
        <div className="h-6" />
      ) : (
        <ul className="flex flex-col gap-3">
          {cameras.map((cam) => (
            <li key={cam.name} className="flex items-center justify-between">
              <span className="text-sm text-(--sea-ink)">
                {formatCameraName(cam.name)}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={cam.enabled}
                aria-label={`Notifications for ${formatCameraName(cam.name)}`}
                onClick={() => onToggle(cam.name, !cam.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  cam.enabled ? 'bg-emerald-500' : 'bg-(--chip-line)'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    cam.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NotificationSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="island-shell mt-6 rounded-4xl px-6 py-8 sm:px-10 sm:py-10">
      <h2 className="mb-6 text-lg font-semibold text-(--sea-ink)">
        Notifications
      </h2>
      {children}
    </section>
  )
}
