import { describe, it, expect } from 'vitest'
import { recentDayCutoff, filterSummaryToRecentDays } from './dateWindow'
import type { FrigateEventSummary } from '#/features/shared/server/frigate/types'

function row(
  overrides: Partial<FrigateEventSummary[number]> = {},
): FrigateEventSummary[number] {
  return {
    camera: 'front_porch',
    count: 1,
    day: '2026-06-30',
    label: 'person',
    sub_label: null,
    zones: [],
    ...overrides,
  }
}

describe('recentDayCutoff', () => {
  it('returns today minus (days - 1) as an inclusive YYYY-MM-DD cutoff', () => {
    // 2026-06-30 minus 29 days = 2026-06-01 (30-day inclusive window)
    expect(recentDayCutoff(new Date('2026-06-30T12:00:00Z'), 30)).toBe(
      '2026-06-01',
    )
  })

  it('handles a 1-day window as today itself', () => {
    expect(recentDayCutoff(new Date('2026-06-30T00:00:00Z'), 1)).toBe(
      '2026-06-30',
    )
  })

  it('crosses month and year boundaries', () => {
    expect(recentDayCutoff(new Date('2026-01-05T12:00:00Z'), 30)).toBe(
      '2025-12-07',
    )
  })
})

describe('filterSummaryToRecentDays', () => {
  it('keeps rows on or after the cutoff (boundary inclusive)', () => {
    const summary = [
      row({ day: '2026-06-01' }),
      row({ day: '2026-06-15' }),
      row({ day: '2026-05-31' }),
    ]
    const kept = filterSummaryToRecentDays(summary, '2026-06-01')
    expect(kept.map((r) => r.day)).toEqual(['2026-06-01', '2026-06-15'])
  })

  it('returns [] for empty input', () => {
    expect(filterSummaryToRecentDays([], '2026-06-01')).toEqual([])
  })
})
