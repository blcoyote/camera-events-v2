import { useEffect, useState } from 'react'
import { Button } from '#/features/shared/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'
import { getAdminMuteView, formatRemaining } from '../utils/adminMuteState'
import {
  MUTE_DURATION_OPTIONS,
  DEFAULT_MUTE_DURATION_MS,
  muteDurationLabel,
} from '#/features/shared/utils/muteDurations'

const SILENCE_ERROR_MESSAGE =
  'Could not silence notifications. Please try again.'
const RESUME_ERROR_MESSAGE = 'Could not resume notifications. Please try again.'

export function AdminNotificationMute() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [mutedUntil, setMutedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [durationMs, setDurationMs] = useState(DEFAULT_MUTE_DURATION_MS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/push/mute', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setIsAdmin(Boolean(data.isAdmin))
        setMutedUntil(
          typeof data.mutedUntil === 'number' ? data.mutedUntil : null,
        )
        setNow(Date.now())
      } catch {
        // Silently fail — the section just stays hidden.
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const view = getAdminMuteView({ isAdmin, mutedUntil, now })

  useEffect(() => {
    if (view.kind !== 'muted') return

    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [view.kind])

  async function handleSubmit() {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/push/mute', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMs }),
      })
      if (!res.ok) {
        setError(
          durationMs === 0 ? RESUME_ERROR_MESSAGE : SILENCE_ERROR_MESSAGE,
        )
        return
      }
      const data = await res.json()
      setMutedUntil(
        typeof data.mutedUntil === 'number' ? data.mutedUntil : null,
      )
      setNow(Date.now())
    } catch {
      setError(durationMs === 0 ? RESUME_ERROR_MESSAGE : SILENCE_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (view.kind === 'hidden') {
    return null
  }

  const isMuted = view.kind === 'muted'
  const isResume = durationMs === 0
  const buttonLabel = isSubmitting
    ? isResume
      ? 'Resuming…'
      : 'Silencing…'
    : isResume
      ? 'Resume notifications'
      : `Silence all notifications for ${muteDurationLabel(durationMs)}`

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Admin
        </CardTitle>
      </CardHeader>
      <p className="text-sm text-fg-2">
        Silence motion and camera-offline notifications for every user for the
        selected duration, or choose Off to resume notifications immediately.
        Events are still recorded — this only pauses push alerts.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-col gap-1.5">
          <label
            htmlFor="admin-mute-duration"
            className="text-sm font-medium text-foreground"
          >
            Mute duration
          </label>
          <select
            id="admin-mute-duration"
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
            className="min-h-11 w-full rounded-input border border-border bg-surface-warm px-4 py-3 text-base text-foreground outline-none focus-visible:border-brand focus-visible:shadow-focus"
          >
            {MUTE_DURATION_OPTIONS.map((option) => (
              <option key={option.ms} value={option.ms}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {buttonLabel}
        </Button>
      </div>
      <div aria-live="polite" className="mt-3 min-h-5">
        {isMuted && (
          <p className="text-sm text-muted-foreground">
            All notifications silenced — {formatRemaining(view.remainingMs)}{' '}
            remaining
          </p>
        )}
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Card>
  )
}
