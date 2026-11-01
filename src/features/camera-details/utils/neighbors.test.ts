import { describe, expect, it } from 'vitest'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { pickNeighbors } from './neighbors'

const ev = (id: string, start_time: number, label = 'person') =>
  ({ id, start_time, label }) as FrigateEvent

describe('pickNeighbors', () => {
  it('returns nulls for empty input', () => {
    expect(pickNeighbors('x', [], [])).toEqual({ previous: null, next: null })
  })

  it('picks the closest newer and older regardless of order', () => {
    const r = pickNeighbors(
      'x',
      [ev('n3', 130), ev('n1', 110), ev('n2', 120)],
      [ev('p1', 80), ev('p2', 90)],
    )
    expect(r.next).toEqual({ id: 'n1', label: 'person', start_time: 110 })
    expect(r.previous).toEqual({ id: 'p2', label: 'person', start_time: 90 })
  })

  it('excludes the event itself', () => {
    const r = pickNeighbors('x', [ev('x', 100), ev('n', 110)], [ev('x', 100)])
    expect(r.next?.id).toBe('n')
    expect(r.previous).toBeNull()
  })
})
