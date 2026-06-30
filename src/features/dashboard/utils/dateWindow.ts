import type { FrigateEventSummary } from '#/features/shared/server/frigate/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Compute the inclusive `YYYY-MM-DD` cutoff for a "last N days" window ending
 * today (i.e. today minus N-1 days). Computed in UTC so the result is
 * deterministic regardless of the host timezone — safe to call on the server
 * and serialize. Compared lexicographically against Frigate summary `day`
 * keys, which works because both use zero-padded `YYYY-MM-DD`.
 */
export function recentDayCutoff(now: Date, days: number): string {
  const ms = now.getTime() - (days - 1) * 86_400_000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Keep only summary rows on or after the cutoff day. */
export function filterSummaryToRecentDays(
  summary: FrigateEventSummary,
  cutoff: string,
): FrigateEventSummary {
  return summary.filter((row) => row.day >= cutoff)
}
