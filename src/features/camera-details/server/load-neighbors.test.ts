import { describe, expect, it, vi } from 'vitest'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { loadCameraNeighbors } from './load-neighbors'

const ev = (id: string, start_time: number) =>
  ({ id, start_time, label: 'person' }) as FrigateEvent
const input = {
  eventId: '1700000000.123-abc123',
  camera: 'driveway',
  startTime: 100,
}

describe('loadCameraNeighbors', () => {
  it('queries newer and older and picks neighbors', async () => {
    const getEvents = vi.fn(async (p?: { after?: unknown }) =>
      p?.after !== undefined
        ? { ok: true as const, data: [ev('n', 120), ev('n2', 130)] }
        : { ok: true as const, data: [ev('p', 90)] },
    )
    const r = await loadCameraNeighbors(input, getEvents)
    expect(r.next?.id).toBe('n')
    expect(r.previous?.id).toBe('p')
    expect(getEvents).toHaveBeenCalledWith({
      cameras: 'driveway',
      after: 100,
      limit: 50,
      include_thumbnails: false,
    })
    expect(getEvents).toHaveBeenCalledWith({
      cameras: 'driveway',
      before: 100,
      limit: 2,
      include_thumbnails: false,
    })
  })

  it('rejects when a Frigate query fails', async () => {
    const getEvents = vi.fn(async (p?: { after?: unknown }) =>
      p?.after !== undefined
        ? { ok: false as const, error: 'boom' }
        : { ok: true as const, data: [ev('p', 90)] },
    )
    await expect(loadCameraNeighbors(input, getEvents)).rejects.toThrow('boom')
  })

  it('returns nulls without calling Frigate on invalid input', async () => {
    const getEvents = vi.fn()
    for (const bad of [
      { ...input, eventId: '../x' },
      { ...input, camera: '../x' },
      { ...input, startTime: Number.NaN },
    ]) {
      expect(await loadCameraNeighbors(bad, getEvents)).toEqual({
        previous: null,
        next: null,
      })
    }
    expect(getEvents).not.toHaveBeenCalled()
  })
})
