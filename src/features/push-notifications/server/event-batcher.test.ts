import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventBatcher } from './event-batcher'
import type { FrigateEventInfo } from './event-batcher'

function makeEvent(
  overrides: Partial<FrigateEventInfo> = {},
): FrigateEventInfo {
  return {
    id: '1234.5678-abc',
    camera: 'front_porch',
    label: 'person',
    startTime: 1713182400,
    ...overrides,
  }
}

let batcher: EventBatcher

afterEach(() => {
  batcher.dispose()
})

describe('EventBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes the first event for a camera immediately', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent())

    expect(flush).toHaveBeenCalledOnce()
    expect(flush.mock.calls[0][0]).toBe('front_porch')
    expect(flush.mock.calls[0][1]).toEqual([makeEvent()])
  })

  it('buffers events arriving during the window and flushes them when it expires', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ id: 'evt1' }))
    expect(flush).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(10_000)
    batcher.add(makeEvent({ id: 'evt2' }))
    vi.advanceTimersByTime(10_000)
    batcher.add(makeEvent({ id: 'evt3' }))

    expect(flush).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(10_000) // window closes 30s after the leading flush
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flush.mock.calls[1][1]).toEqual([
      makeEvent({ id: 'evt2' }),
      makeEvent({ id: 'evt3' }),
    ])
  })

  it('keeps the window chain alive while events keep arriving', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ id: 'evt1' })) // leading flush
    vi.advanceTimersByTime(10_000)
    batcher.add(makeEvent({ id: 'evt2' }))
    vi.advanceTimersByTime(20_000) // flush #2 with evt2, chain restarts

    expect(flush).toHaveBeenCalledTimes(2)

    batcher.add(makeEvent({ id: 'evt3' })) // buffered, not flushed immediately
    expect(flush).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(30_000)
    expect(flush).toHaveBeenCalledTimes(3)
    expect(flush.mock.calls[2][1]).toEqual([makeEvent({ id: 'evt3' })])
  })

  it('ends the window chain when a window expires with nothing buffered', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ id: 'evt1' }))
    expect(flush).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(30_000) // empty window — no flush, camera goes idle
    expect(flush).toHaveBeenCalledOnce()

    batcher.add(makeEvent({ id: 'evt2' })) // idle again, so flush immediately
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flush.mock.calls[1][1]).toEqual([makeEvent({ id: 'evt2' })])
  })

  it('maintains independent windows per camera', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ camera: 'front_porch', id: 'p1' }))
    vi.advanceTimersByTime(15_000)
    batcher.add(makeEvent({ camera: 'driveway', id: 'd1' }))

    // Both leading flushes are immediate and independent
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flush.mock.calls[0][0]).toBe('front_porch')
    expect(flush.mock.calls[1][0]).toBe('driveway')

    batcher.add(makeEvent({ camera: 'front_porch', id: 'p2' }))
    vi.advanceTimersByTime(15_000) // front_porch window closes at 30s
    expect(flush).toHaveBeenCalledTimes(3)
    expect(flush.mock.calls[2][0]).toBe('front_porch')
    expect(flush.mock.calls[2][1]).toEqual([
      makeEvent({ camera: 'front_porch', id: 'p2' }),
    ])
  })

  it('does not flush buffered events after dispose', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ id: 'evt1' })) // leading flush
    batcher.add(makeEvent({ id: 'evt2' })) // buffered
    batcher.dispose()

    vi.advanceTimersByTime(30_000)
    expect(flush).toHaveBeenCalledOnce()
  })

  it('uses custom window duration', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 5_000)

    batcher.add(makeEvent({ id: 'evt1' }))
    batcher.add(makeEvent({ id: 'evt2' }))

    vi.advanceTimersByTime(4_999)
    expect(flush).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(1)
    expect(flush).toHaveBeenCalledTimes(2)
  })

  describe('burst detection', () => {
    it("marks a camera's first ever flush as a burst start", () => {
      const flush = vi.fn()
      batcher = new EventBatcher(flush, 30_000, 600_000)

      batcher.add(makeEvent())

      expect(flush.mock.calls[0][2]).toEqual({ burstStart: true })
    })

    it('marks trailing flushes as continuations, not burst starts', () => {
      const flush = vi.fn()
      batcher = new EventBatcher(flush, 30_000, 600_000)

      batcher.add(makeEvent({ id: 'evt1' }))
      batcher.add(makeEvent({ id: 'evt2' }))
      vi.advanceTimersByTime(30_000)

      expect(flush).toHaveBeenCalledTimes(2)
      expect(flush.mock.calls[1][2]).toEqual({ burstStart: false })
    })

    it('treats a leading flush within the burst gap as a continuation', () => {
      const flush = vi.fn()
      batcher = new EventBatcher(flush, 30_000, 600_000)

      batcher.add(makeEvent({ id: 'evt1' }))
      vi.advanceTimersByTime(60_000) // camera goes idle, but well inside the gap
      batcher.add(makeEvent({ id: 'evt2' }))

      expect(flush).toHaveBeenCalledTimes(2)
      expect(flush.mock.calls[1][2]).toEqual({ burstStart: false })
    })

    it('starts a new burst once the burst gap has elapsed', () => {
      const flush = vi.fn()
      batcher = new EventBatcher(flush, 30_000, 600_000)

      batcher.add(makeEvent({ id: 'evt1' }))
      vi.advanceTimersByTime(600_000)
      batcher.add(makeEvent({ id: 'evt2' }))

      expect(flush).toHaveBeenCalledTimes(2)
      expect(flush.mock.calls[1][2]).toEqual({ burstStart: true })
    })

    it('tracks burst state independently per camera', () => {
      const flush = vi.fn()
      batcher = new EventBatcher(flush, 30_000, 600_000)

      batcher.add(makeEvent({ camera: 'front_porch', id: 'p1' }))
      vi.advanceTimersByTime(60_000)
      // front_porch continues its burst; driveway is seen for the first time
      batcher.add(makeEvent({ camera: 'front_porch', id: 'p2' }))
      batcher.add(makeEvent({ camera: 'driveway', id: 'd1' }))

      expect(flush.mock.calls[1][2]).toEqual({ burstStart: false })
      expect(flush.mock.calls[2][2]).toEqual({ burstStart: true })
    })

    it('forgets burst state on dispose', () => {
      const flush = vi.fn()
      batcher = new EventBatcher(flush, 30_000, 600_000)

      batcher.add(makeEvent({ id: 'evt1' }))
      batcher.dispose()
      batcher.add(makeEvent({ id: 'evt2' }))

      expect(flush.mock.calls[1][2]).toEqual({ burstStart: true })
    })
  })
})
