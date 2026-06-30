import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type {
  FrigateEventSummary,
  FrigateReviewSummary,
  FrigateStats,
} from '#/features/shared/server/frigate/types'

// ─── Module mocks (hoisted before imports) ───────────────────────────────────

const mockRequireSession = vi.fn<() => Promise<string>>()
vi.mock('#/features/shared/server/session', () => ({
  requireSession: mockRequireSession,
}))

const mockGetStats = vi.fn()
const mockGetEventSummary = vi.fn()
const mockGetReviewSummary = vi.fn()
vi.mock('#/features/shared/server/frigate/client', () => ({
  getStats: mockGetStats,
  getEventSummary: mockGetEventSummary,
  getReviewSummary: mockGetReviewSummary,
}))

// Import handler AFTER mocks are set up
const { loadDashboardHandler } = await import('./dashboard-handlers')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const STATS = { detection_fps: 5 } as unknown as FrigateStats
const SUMMARY: FrigateEventSummary = [
  {
    camera: 'a',
    count: 2,
    day: '2026-06-30',
    label: 'person',
    sub_label: null,
    zones: [],
  },
]
const REVIEW = {
  last24Hours: {
    reviewed_alert: 0,
    reviewed_detection: 0,
    total_alert: 1,
    total_detection: 2,
  },
}

function okStats(): FrigateResult<FrigateStats> {
  return { ok: true, data: STATS }
}
function okSummary(): FrigateResult<FrigateEventSummary> {
  return { ok: true, data: SUMMARY }
}
function okReview(): FrigateResult<FrigateReviewSummary> {
  return { ok: true, data: REVIEW }
}

beforeEach(() => {
  mockRequireSession.mockResolvedValue('user-123')
  mockGetStats.mockResolvedValue(okStats())
  mockGetEventSummary.mockResolvedValue(okSummary())
  mockGetReviewSummary.mockResolvedValue(okReview())
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('loadDashboardHandler', () => {
  describe('auth guard', () => {
    it('throws Unauthorized when session is missing', async () => {
      mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
      await expect(loadDashboardHandler()).rejects.toThrow('Unauthorized')
    })

    it('does not call Frigate when unauthorized', async () => {
      mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
      await expect(loadDashboardHandler()).rejects.toThrow()
      expect(mockGetStats).not.toHaveBeenCalled()
      expect(mockGetEventSummary).not.toHaveBeenCalled()
      expect(mockGetReviewSummary).not.toHaveBeenCalled()
    })
  })

  describe('combining results', () => {
    it('returns all three payloads when every call succeeds', async () => {
      const result = await loadDashboardHandler()
      expect(result).toEqual({
        ok: true,
        data: { stats: STATS, summary: SUMMARY, review: REVIEW },
      })
    })

    it('fetches the three endpoints in parallel', async () => {
      await loadDashboardHandler()
      expect(mockGetStats).toHaveBeenCalledOnce()
      expect(mockGetEventSummary).toHaveBeenCalledOnce()
      expect(mockGetReviewSummary).toHaveBeenCalledOnce()
    })

    it('nulls stats when the stats call fails but keeps the others', async () => {
      mockGetStats.mockResolvedValue({ ok: false, error: 'HTTP 500' })
      const result = await loadDashboardHandler()
      expect(result.ok).toBe(true)
      expect(result.ok && result.data.stats).toBeNull()
      expect(result.ok && result.data.summary).toEqual(SUMMARY)
      expect(result.ok && result.data.review).toEqual(REVIEW)
    })

    it('defaults summary to an empty array when its call fails', async () => {
      mockGetEventSummary.mockResolvedValue({ ok: false, error: 'HTTP 500' })
      const result = await loadDashboardHandler()
      expect(result.ok && result.data.summary).toEqual([])
    })

    it('nulls review when its call fails', async () => {
      mockGetReviewSummary.mockResolvedValue({ ok: false, error: 'HTTP 500' })
      const result = await loadDashboardHandler()
      expect(result.ok && result.data.review).toBeNull()
    })

    it('returns ok:false only when all three calls fail', async () => {
      mockGetStats.mockResolvedValue({ ok: false, error: 'down' })
      mockGetEventSummary.mockResolvedValue({ ok: false, error: 'down' })
      mockGetReviewSummary.mockResolvedValue({ ok: false, error: 'down' })
      const result = await loadDashboardHandler()
      expect(result.ok).toBe(false)
    })
  })
})
