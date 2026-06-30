import '@tanstack/react-start/server-only'
import { requireSession } from '#/features/shared/server/session'
import {
  getStats,
  getEventSummary,
  getReviewSummary,
} from '#/features/shared/server/frigate/client'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { DASHBOARD_WINDOW_DAYS } from '#/features/dashboard/types'
import type { DashboardData } from '#/features/dashboard/types'
import {
  recentDayCutoff,
  filterSummaryToRecentDays,
} from '#/features/dashboard/utils/dateWindow'

/**
 * Pure handler for the activity dashboard. Exported for unit testing.
 * Calls requireSession() first (server functions are HTTP-callable, so the
 * route guard alone is not enough). The three Frigate calls are independent:
 * a failure in one degrades that section rather than the whole page, and the
 * load only fails outright when all three are unavailable.
 */
export async function loadDashboardHandler(): Promise<
  FrigateResult<DashboardData>
> {
  await requireSession()
  const [statsRes, summaryRes, reviewRes] = await Promise.all([
    getStats(),
    getEventSummary(),
    getReviewSummary(),
  ])
  if (!statsRes.ok && !summaryRes.ok && !reviewRes.ok) {
    return { ok: false, error: summaryRes.error }
  }
  // /api/events/summary is all-time + all-label; scope it to a recent window
  // here so the result is computed once and dehydrated (SSR-safe). Label
  // scoping happens client-side via the dashboard's type filter.
  const cutoff = recentDayCutoff(new Date(), DASHBOARD_WINDOW_DAYS)
  return {
    ok: true,
    data: {
      stats: statsRes.ok ? statsRes.data : null,
      summary: summaryRes.ok
        ? filterSummaryToRecentDays(summaryRes.data, cutoff)
        : [],
      review: reviewRes.ok ? reviewRes.data : null,
    },
  }
}
