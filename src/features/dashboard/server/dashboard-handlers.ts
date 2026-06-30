import '@tanstack/react-start/server-only'
import { requireSession } from '#/features/shared/server/session'
import {
  getStats,
  getEventSummary,
  getReviewSummary,
} from '#/features/shared/server/frigate/client'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { DashboardData } from '#/features/dashboard/types'

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
  return {
    ok: true,
    data: {
      stats: statsRes.ok ? statsRes.data : null,
      summary: summaryRes.ok ? summaryRes.data : [],
      review: reviewRes.ok ? reviewRes.data : null,
    },
  }
}
