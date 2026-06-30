import type {
  FrigateEventSummary,
  FrigateReviewSummary,
  FrigateStats,
} from '#/features/shared/server/frigate/types'

/** Time window (days) the dashboard's summary panels are scoped to. */
export const DASHBOARD_WINDOW_DAYS = 30

/**
 * Combined payload for the activity dashboard. Each Frigate sub-call is
 * independent: `stats` and `review` are null when that upstream call failed,
 * and `summary` defaults to an empty array. The dashboard renders whatever
 * is available.
 */
export interface DashboardData {
  stats: FrigateStats | null
  summary: FrigateEventSummary
  review: FrigateReviewSummary | null
}
