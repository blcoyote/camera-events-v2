import { describe, it, expect } from 'vitest'
import { getDashboardPageState } from './getDashboardPageState'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { DashboardData } from '#/features/dashboard/types'

function ok(data: DashboardData): FrigateResult<DashboardData> {
  return { ok: true, data }
}

const EMPTY_DATA: DashboardData = { stats: null, summary: [], review: null }

describe('getDashboardPageState', () => {
  it('returns error state when the load failed', () => {
    const state = getDashboardPageState({ ok: false, error: 'boom' })
    expect(state.kind).toBe('error')
  })

  it('returns empty state when stats, summary and review are all absent', () => {
    expect(getDashboardPageState(ok(EMPTY_DATA))).toEqual({ kind: 'empty' })
  })

  it('returns ready when summary has entries', () => {
    const data: DashboardData = {
      ...EMPTY_DATA,
      summary: [
        {
          camera: 'a',
          count: 1,
          day: '2026-06-30',
          label: 'person',
          sub_label: null,
          zones: [],
        },
      ],
    }
    const state = getDashboardPageState(ok(data))
    expect(state.kind).toBe('ready')
    expect(state.kind === 'ready' && state.data).toEqual(data)
  })

  it('returns ready when only stats are present', () => {
    const data = {
      ...EMPTY_DATA,
      stats: {} as DashboardData['stats'],
    }
    expect(getDashboardPageState(ok(data)).kind).toBe('ready')
  })

  it('returns ready when only review is present', () => {
    const data = {
      ...EMPTY_DATA,
      review: {} as DashboardData['review'],
    }
    expect(getDashboardPageState(ok(data)).kind).toBe('ready')
  })
})
