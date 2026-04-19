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

  it('flushes a single event after the window expires', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent())
    expect(flush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(30_000)
    expect(flush).toHaveBeenCalledOnce()
    expect(flush).toHaveBeenCalledWith('front_porch', [makeEvent()])
  })

  it('batches multiple events from the same camera', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ id: 'evt1' }))
    vi.advanceTimersByTime(10_000)
    batcher.add(makeEvent({ id: 'evt2' }))
    vi.advanceTimersByTime(10_000)
    batcher.add(makeEvent({ id: 'evt3' }))

    expect(flush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(10_000) // total 30s from first event
    expect(flush).toHaveBeenCalledOnce()
    expect(flush.mock.calls[0][1]).toHaveLength(3)
  })

  it('maintains independent windows per camera', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ camera: 'front_porch' }))
    vi.advanceTimersByTime(15_000)
    batcher.add(makeEvent({ camera: 'driveway' }))

    vi.advanceTimersByTime(15_000) // front_porch fires at 30s
    expect(flush).toHaveBeenCalledOnce()
    expect(flush.mock.calls[0][0]).toBe('front_porch')

    vi.advanceTimersByTime(15_000) // driveway fires at 45s
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flush.mock.calls[1][0]).toBe('driveway')
  })

  it('does not flush after dispose', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent())
    batcher.dispose()

    vi.advanceTimersByTime(30_000)
    expect(flush).not.toHaveBeenCalled()
  })

  it('starts a new window after a flush', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 30_000)

    batcher.add(makeEvent({ id: 'evt1' }))
    vi.advanceTimersByTime(30_000)
    expect(flush).toHaveBeenCalledOnce()

    // Add another event — should start a new window
    batcher.add(makeEvent({ id: 'evt2' }))
    vi.advanceTimersByTime(30_000)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flush.mock.calls[1][1]).toEqual([makeEvent({ id: 'evt2' })])
  })

  it('uses custom window duration', () => {
    const flush = vi.fn()
    batcher = new EventBatcher(flush, 5_000)

    batcher.add(makeEvent())

    vi.advanceTimersByTime(4_999)
    expect(flush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(flush).toHaveBeenCalledOnce()
  })
})
