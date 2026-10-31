import { useState, useEffect, useCallback } from 'react'
import { m } from '#/paraglide/messages.js'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { NotificationSection } from './NotificationSection'
import { CameraPreferences } from './CameraPreferences'
import type { CameraPref } from './CameraPreferences'
import { Button } from '#/features/shared/components/ui/button'
import { AvailabilityAlertsToggle } from './AvailabilityAlertsToggle'

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
  const [availabilityEnabled, setAvailabilityEnabled] = useState(false)

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

  const loadAvailabilityPreference = useCallback(async () => {
    try {
      const res = await fetch('/api/push/availability-preference', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setAvailabilityEnabled(Boolean(data.enabled))
      }
    } catch {
      // Silently fail — toggle will just keep its default (off)
    }
  }, [])

  // Load camera and availability preferences when subscribed
  useEffect(() => {
    if (isSubscribed) {
      loadPreferences()
      loadAvailabilityPreference()
    }
  }, [isSubscribed, loadPreferences, loadAvailabilityPreference])

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
        <p className="text-sm text-muted-foreground">
          {m.settings_push_unsupported()}
        </p>
      </NotificationSection>
    )
  }

  // Server doesn't have VAPID keys
  if (!isPushEnabled) {
    return (
      <NotificationSection>
        <p className="text-sm text-muted-foreground">
          {m.settings_push_unavailable()}
        </p>
      </NotificationSection>
    )
  }

  // Permission permanently denied
  if (permissionState === 'denied' && !isSubscribed) {
    return (
      <NotificationSection>
        <p className="text-sm text-muted-foreground">{m.settings_blocked()}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {m.settings_unblock_help()}
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
      setTestResult(m.settings_test_sent({ count: sent }))
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

  async function handleToggleAvailability(enabled: boolean) {
    // Optimistic update
    setAvailabilityEnabled(enabled)
    try {
      const res = await fetch('/api/push/availability-preference', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) {
        // Revert on failure
        setAvailabilityEnabled(!enabled)
      }
    } catch {
      // Revert on network error
      setAvailabilityEnabled(!enabled)
    }
  }

  return (
    <NotificationSection>
      <div className="flex flex-col gap-4">
        {isSubscribed ? (
          <>
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-success"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">
                {m.settings_enabled()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUnsubscribe}
                disabled={isLoading}
              >
                {isLoading ? m.settings_working() : m.settings_disable()}
              </Button>
              <Button size="sm" onClick={handleSendTest} disabled={isLoading}>
                {isLoading ? m.settings_sending() : m.settings_send_test()}
              </Button>
            </div>
            <AvailabilityAlertsToggle
              enabled={availabilityEnabled}
              onToggle={handleToggleAvailability}
            />
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
            <p className="text-sm text-muted-foreground">
              {m.settings_enable_prompt()}
            </p>
            <Button
              className="w-fit"
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? m.settings_working() : m.settings_enable()}
            </Button>
          </>
        )}

        {/* Status messages */}
        <div aria-live="polite" className="min-h-5">
          {error && <p className="text-sm text-danger-text">{error}</p>}
          {testResult && !error && (
            <p className="text-sm text-success-text">{testResult}</p>
          )}
        </div>
      </div>
    </NotificationSection>
  )
}
