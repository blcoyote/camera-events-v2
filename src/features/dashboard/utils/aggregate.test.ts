import { describe, it, expect } from 'vitest'
import {
  aggregateByCamera,
  aggregateByLabel,
  aggregateByDay,
  totalEventCount,
  filterSummaryByLabel,
} from './aggregate'
import type { FrigateEventSummary } from '#/features/shared/server/frigate/types'

function item(
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

describe('totalEventCount', () => {
  it('returns 0 for an empty summary', () => {
    expect(totalEventCount([])).toBe(0)
  })

  it('sums all counts', () => {
    expect(totalEventCount([item({ count: 3 }), item({ count: 4 })])).toBe(7)
  })
})

describe('filterSummaryByLabel', () => {
  it('returns the summary unchanged when label is null', () => {
    const summary = [item({ label: 'person' }), item({ label: 'car' })]
    expect(filterSummaryByLabel(summary, null)).toBe(summary)
  })

  it('keeps only rows matching the label', () => {
    const summary = [
      item({ label: 'person', count: 3 }),
      item({ label: 'car', count: 5 }),
      item({ label: 'person', count: 1 }),
    ]
    expect(filterSummaryByLabel(summary, 'person')).toEqual([
      item({ label: 'person', count: 3 }),
      item({ label: 'person', count: 1 }),
    ])
  })

  it('returns [] when no rows match', () => {
    expect(filterSummaryByLabel([item({ label: 'car' })], 'person')).toEqual([])
  })
})

describe('aggregateByCamera', () => {
  it('returns [] for empty input', () => {
    expect(aggregateByCamera([])).toEqual([])
  })

  it('sums counts per camera', () => {
    const summary = [
      item({ camera: 'a', count: 2 }),
      item({ camera: 'a', count: 3 }),
      item({ camera: 'b', count: 1 }),
    ]
    expect(aggregateByCamera(summary)).toEqual([
      { key: 'a', count: 5 },
      { key: 'b', count: 1 },
    ])
  })

  it('sorts by count descending, ties alphabetical', () => {
    const summary = [
      item({ camera: 'z', count: 2 }),
      item({ camera: 'a', count: 2 }),
      item({ camera: 'm', count: 9 }),
    ]
    expect(aggregateByCamera(summary).map((e) => e.key)).toEqual([
      'm',
      'a',
      'z',
    ])
  })
})

describe('aggregateByLabel', () => {
  it('sums counts per label, busiest first', () => {
    const summary = [
      item({ label: 'person', count: 1 }),
      item({ label: 'car', count: 5 }),
      item({ label: 'person', count: 1 }),
    ]
    expect(aggregateByLabel(summary)).toEqual([
      { key: 'car', count: 5 },
      { key: 'person', count: 2 },
    ])
  })
})

describe('aggregateByDay', () => {
  it('sums counts per day in chronological order', () => {
    const summary = [
      item({ day: '2026-06-30', count: 2 }),
      item({ day: '2026-06-28', count: 1 }),
      item({ day: '2026-06-30', count: 3 }),
      item({ day: '2026-06-29', count: 4 }),
    ]
    expect(aggregateByDay(summary)).toEqual([
      { key: '2026-06-28', count: 1 },
      { key: '2026-06-29', count: 4 },
      { key: '2026-06-30', count: 5 },
    ])
  })
})
