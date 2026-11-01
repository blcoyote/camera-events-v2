import { useEffect, useState } from 'react'
import { m } from '#/paraglide/messages.js'
import { Button } from '#/features/shared/components/ui/button'
import { Label } from '#/features/shared/components/ui/label'
import { NativeSelect } from '#/features/shared/components/ui/native-select'
import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'
import { getAdminMuteView, formatRemaining } from '../utils/adminMuteState'
import {
  MUTE_DURATION_OPTIONS,
  DEFAULT_MUTE_DURATION_MS,
} from '#/features/shared/utils/muteDurations'

function durationLabel(ms: number): string {
  if (ms === 0) return m.settings_mute_off()
  const hours = ms / 3_600_000
  return Number.isInteger(hours)
    ? m.settings_mute_hours({ count: hours })
    : m.settings_mute_minutes({ count: ms / 60_000 })
}

const silenceError = () => m.settings_mute_error_silence()
const resumeError = () => m.settings_mute_error_resume()

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
        setError(durationMs === 0 ? resumeError() : silenceError())
        return
      }
      const data = await res.json()
      setMutedUntil(
        typeof data.mutedUntil === 'number' ? data.mutedUntil : null,
      )
      setNow(Date.now())
    } catch {
      setError(durationMs === 0 ? resumeError() : silenceError())
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
      ? m.settings_mute_resuming()
      : m.settings_mute_submitting()
    : isResume
      ? m.settings_mute_resume()
      : m.settings_mute_submit({ duration: durationLabel(durationMs) })

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{m.settings_mute_title()}</CardTitle>
      </CardHeader>
      <p className="text-sm text-fg-2">{m.settings_mute_description()}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-col gap-1.5">
          <Label htmlFor="admin-mute-duration">
            {m.settings_mute_duration_label()}
          </Label>
          <NativeSelect
            id="admin-mute-duration"
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
          >
            {MUTE_DURATION_OPTIONS.map((option) => (
              <option key={option.ms} value={option.ms}>
                {durationLabel(option.ms)}
              </option>
            ))}
          </NativeSelect>
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
            {m.settings_mute_active({
              remaining: formatRemaining(view.remainingMs),
            })}
          </p>
        )}
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Card>
  )
}
