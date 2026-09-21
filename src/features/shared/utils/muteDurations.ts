/**
 * The ladder of admin notification-mute durations.
 *
 * This is a shared contract, not a UI detail: the Settings dropdown renders
 * these options and the `/api/push/mute` handler validates the submitted
 * duration against the same list. Both features import it from here rather
 * than keeping their own copies, because drift between them is a real bug —
 * an option the client offers but the server rejects looks like a broken
 * button.
 *
 * Validation is an allowlist rather than a range check. A range would let a
 * caller post any value up to the maximum, including absurd or oddly precise
 * ones; the ladder keeps the set of reachable deadlines small and known,
 * which is also what makes the corruption ceiling in `notification-mute.ts`
 * meaningful.
 *
 * Pure and isomorphic — no server-only imports, safe in the client bundle.
 */

export interface MuteDurationOption {
  /** Duration in milliseconds. Zero means "no mute": clear any active one. */
  ms: number
  label: string
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export const MUTE_DURATION_OPTIONS: readonly MuteDurationOption[] = [
  { ms: 0, label: 'Off — resume notifications' },
  { ms: 10 * MINUTE, label: '10 minutes' },
  { ms: 30 * MINUTE, label: '30 minutes' },
  { ms: 1 * HOUR, label: '1 hour' },
  { ms: 2 * HOUR, label: '2 hours' },
  { ms: 4 * HOUR, label: '4 hours' },
  { ms: 6 * HOUR, label: '6 hours' },
] as const

/**
 * The pre-selected duration. Zero, so that opening Settings and submitting
 * without touching the dropdown resumes notifications rather than silencing
 * them — the accident-proof direction for a control that affects every user.
 */
export const DEFAULT_MUTE_DURATION_MS = 0

/**
 * The longest mute that can be requested. `isMuteActive` uses this as the
 * ceiling above which a stored deadline is treated as corrupt, so it must
 * stay equal to the largest offered option.
 */
export const MAX_MUTE_DURATION_MS = MUTE_DURATION_OPTIONS.reduce(
  (max, option) => (option.ms > max ? option.ms : max),
  0,
)

/** Is `value` one of the offered durations? Zero (clear) counts as valid. */
export function isValidMuteDurationMs(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    MUTE_DURATION_OPTIONS.some((option) => option.ms === value)
  )
}

/** The label for an offered duration, or null when it is not on the ladder. */
export function muteDurationLabel(ms: number): string | null {
  return MUTE_DURATION_OPTIONS.find((option) => option.ms === ms)?.label ?? null
}
