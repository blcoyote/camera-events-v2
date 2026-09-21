import { useEffect, useState } from 'react'
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
    <section className="island-shell mt-6 rounded-4xl px-6 py-8 sm:px-10 sm:py-10">
      <h2 className="mb-6 text-lg font-semibold text-(--sea-ink)">Admin</h2>
      <p className="mb-4 text-sm text-(--sea-ink-soft)">
        Silence motion and camera-offline notifications for every user for the
        selected duration, or choose Off to resume notifications immediately.
        Events are still recorded — this only pauses push alerts.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admin-mute-duration"
            className="text-sm font-medium text-(--sea-ink)"
          >
            Mute duration
          </label>
          <select
            id="admin-mute-duration"
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
            className="min-h-11 rounded-lg border border-(--chip-line) bg-(--chip-bg) px-3 py-2 text-sm text-(--sea-ink)"
          >
            {MUTE_DURATION_OPTIONS.map((option) => (
              <option key={option.ms} value={option.ms}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="min-h-11 w-fit rounded-full border border-(--accent-muted-border) bg-(--accent-muted-bg) px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-(--accent-muted-hover-bg) disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>
      <div aria-live="polite" className="mt-3 min-h-5">
        {isMuted && (
          <p className="text-sm text-(--sea-ink-soft)">
            All notifications silenced — {formatRemaining(view.remainingMs)}{' '}
            remaining
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </section>
  )
}
