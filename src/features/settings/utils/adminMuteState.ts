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

/**
 * Format a remaining duration, clamped at 0:00.
 *
 * Under an hour: `M:SS` (minutes unpadded, seconds zero-padded).
 * An hour or more: `H:MM:SS` (minutes and seconds both zero-padded).
 */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
