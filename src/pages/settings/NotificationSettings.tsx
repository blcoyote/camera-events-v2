import { useState, useEffect } from 'react'
import { usePushSubscription } from '#/hooks/usePushSubscription'

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

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Before the client effect runs, render a neutral placeholder so SSR
  // and initial client markup match (avoids hydration mismatch).
  if (!hasMounted) {
    return <NotificationSection><div className="h-6" /></NotificationSection>
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
          To unblock: in <strong>Chrome</strong>, click the lock icon in the address bar &gt;
          Site settings &gt; Notifications &gt; Allow. In <strong>Safari</strong>, go to
          Settings &gt; Websites &gt; Notifications and allow this site.
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

  return (
    <NotificationSection>
      <div className="flex flex-col gap-4">
        {isSubscribed ? (
          <>
            <div className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
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
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{testResult}</p>
          )}
        </div>
      </div>
    </NotificationSection>
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
