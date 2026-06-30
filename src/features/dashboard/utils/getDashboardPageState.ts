import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { DashboardData } from '#/features/dashboard/types'

export type DashboardState =
  | { kind: 'ready'; data: DashboardData }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

/**
 * Map the dashboard loader result to a render state. Mirrors the
 * `getCamerasPageState` pattern: error when the whole load failed, empty when
 * Frigate returned nothing useful, ready otherwise.
 */
export function getDashboardPageState(
  result: FrigateResult<DashboardData>,
): DashboardState {
  if (!result.ok) {
    return {
      kind: 'error',
      message: 'Could not load activity. Check that Frigate is running.',
    }
  }
  const { stats, summary, review } = result.data
  const hasSummary = summary.length > 0
  const hasStats = stats !== null
  const hasReview = review !== null
  if (!hasSummary && !hasStats && !hasReview) {
    return { kind: 'empty' }
  }
  return { kind: 'ready', data: result.data }
}
