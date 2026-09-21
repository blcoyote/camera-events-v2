export type AdminMuteView =
  { kind: 'hidden' } | { kind: 'idle' } | { kind: 'muted'; remainingMs: number }

export function getAdminMuteView(input: {
  isAdmin: boolean
  mutedUntil: number | null
  now: number
}): AdminMuteView {
  const { isAdmin, mutedUntil, now } = input

  if (!isAdmin) {
    return { kind: 'hidden' }
  }

  if (mutedUntil === null || mutedUntil <= now) {
    return { kind: 'idle' }
  }

  return { kind: 'muted', remainingMs: mutedUntil - now }
}

/** Format a remaining duration as `M:SS`, clamped at 0:00. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
