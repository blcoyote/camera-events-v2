import { useEffect, useState } from 'react'
import { getAdminMuteView, formatRemaining } from '../utils/adminMuteState'

const MUTE_ERROR_MESSAGE = 'Could not silence notifications. Please try again.'

export function AdminNotificationMute() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [mutedUntil, setMutedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(0)
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

  async function handleSilence() {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/push/mute', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setError(MUTE_ERROR_MESSAGE)
        return
      }
      const data = await res.json()
      setMutedUntil(data.mutedUntil)
      setNow(Date.now())
    } catch {
      setError(MUTE_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (view.kind === 'hidden') {
    return null
  }

  const isMuted = view.kind === 'muted'
  const buttonLabel = isSubmitting
    ? 'Silencing…'
    : 'Silence all notifications for 10 minutes'

  return (
    <section className="island-shell mt-6 rounded-4xl px-6 py-8 sm:px-10 sm:py-10">
      <h2 className="mb-6 text-lg font-semibold text-(--sea-ink)">Admin</h2>
      <p className="mb-4 text-sm text-(--sea-ink-soft)">
        Silence motion and camera-offline notifications for every user for 10
        minutes. Events are still recorded — this only pauses push alerts.
      </p>
      <button
        type="button"
        onClick={handleSilence}
        disabled={isMuted || isSubmitting}
        className="min-h-11 w-fit rounded-full border border-(--accent-muted-border) bg-(--accent-muted-bg) px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-(--accent-muted-hover-bg) disabled:opacity-50"
      >
        {buttonLabel}
      </button>
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
