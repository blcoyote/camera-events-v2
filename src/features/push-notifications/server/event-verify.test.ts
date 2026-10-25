import { describe, it, expect, vi } from 'vitest'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import {
  VERIFY_ATTEMPTS,
  VERIFY_INTERVAL_MS,
  waitForPersistedEvent,
} from './event-verify'

function makeEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1713182400.123-abc123',
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
    start_time: 1713182400,
    end_time: 1713182460,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: true,
    has_snapshot: true,
    retain_indefinitely: false,
    plus_id: null,
    box: null,
    top_score: 0.9,
    data: {} as FrigateEvent['data'],
    ...overrides,
  }
}

const notFound: FrigateResult<FrigateEvent> = {
  ok: false,
  error: 'Not Found',
  status: 404,
}

function found(event: FrigateEvent): FrigateResult<FrigateEvent> {
  return { ok: true, data: event }
}

describe('waitForPersistedEvent', () => {
  it('returns the event on the first attempt without sleeping', async () => {
    const event = makeEvent()
    const fetchEvent = vi.fn().mockResolvedValue(found(event))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await waitForPersistedEvent([event.id], {
      fetchEvent,
      sleep,
    })

    expect(result).toEqual(event)
    expect(fetchEvent).toHaveBeenCalledOnce()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('succeeds on a later attempt, sleeping between rounds', async () => {
    const event = makeEvent()
    const fetchEvent = vi
      .fn()
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(found(event))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await waitForPersistedEvent([event.id], {
      attempts: 5,
      intervalMs: 123,
      fetchEvent,
      sleep,
    })

    expect(result).toEqual(event)
    expect(fetchEvent).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(123)
  })

  it('returns null after exhausting attempts', async () => {
    const fetchEvent = vi.fn().mockResolvedValue(notFound)
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await waitForPersistedEvent(['a-1', 'b-2'], {
      attempts: 4,
      intervalMs: 50,
      fetchEvent,
      sleep,
    })

    expect(result).toBeNull()
    expect(fetchEvent).toHaveBeenCalledTimes(8)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  describe('id ordering', () => {
    it('returns the first persisted id in the given order', async () => {
      const first = makeEvent({ id: 'first-1' })
      const second = makeEvent({ id: 'second-2' })
      const fetchEvent = vi.fn((id: string) =>
        Promise.resolve(found(id === 'first-1' ? first : second)),
      )
      const sleep = vi.fn().mockResolvedValue(undefined)

      const result = await waitForPersistedEvent(['first-1', 'second-2'], {
        fetchEvent,
        sleep,
      })

      expect(result).toEqual(first)
      expect(fetchEvent).toHaveBeenCalledOnce()
    })

    it('finds the second id when the first is not persisted', async () => {
      const second = makeEvent({ id: 'second-2' })
      const fetchEvent = vi.fn((id: string) =>
        Promise.resolve(id === 'second-2' ? found(second) : notFound),
      )
      const sleep = vi.fn().mockResolvedValue(undefined)

      const result = await waitForPersistedEvent(['first-1', 'second-2'], {
        fetchEvent,
        sleep,
      })

      expect(result).toEqual(second)
      expect(fetchEvent.mock.calls.map((c) => c[0])).toEqual([
        'first-1',
        'second-2',
      ])
      expect(sleep).not.toHaveBeenCalled()
    })
  })

  describe('id validation', () => {
    it('never fetches invalid ids', async () => {
      const event = makeEvent({ id: 'good-1' })
      const fetchEvent = vi.fn((id: string) =>
        Promise.resolve(id === 'good-1' ? found(event) : notFound),
      )
      const sleep = vi.fn().mockResolvedValue(undefined)

      const result = await waitForPersistedEvent(
        ['../config', '', 'a/b', 'good-1'],
        { fetchEvent, sleep },
      )

      expect(result).toEqual(event)
      expect(fetchEvent.mock.calls.map((c) => c[0])).toEqual(['good-1'])
    })

    it('returns null without fetching or sleeping when all ids are invalid', async () => {
      const fetchEvent = vi.fn()
      const sleep = vi.fn()

      const result = await waitForPersistedEvent(['../config', '', 'a/b'], {
        fetchEvent,
        sleep,
      })

      expect(result).toBeNull()
      expect(fetchEvent).not.toHaveBeenCalled()
      expect(sleep).not.toHaveBeenCalled()
    })
  })

  it('returns null without fetching for an empty list', async () => {
    const fetchEvent = vi.fn()
    const sleep = vi.fn()

    const result = await waitForPersistedEvent([], { fetchEvent, sleep })

    expect(result).toBeNull()
    expect(fetchEvent).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('treats a rejecting fetchEvent as not-yet', async () => {
    const event = makeEvent()
    const fetchEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(found(event))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await waitForPersistedEvent([event.id], {
      fetchEvent,
      sleep,
    })

    expect(result).toEqual(event)
    expect(fetchEvent).toHaveBeenCalledTimes(2)
  })

  it('ignores a response whose id does not match the requested id', async () => {
    const fetchEvent = vi
      .fn()
      .mockResolvedValue(found(makeEvent({ id: 'someone-else' })))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await waitForPersistedEvent(['wanted-1'], {
      attempts: 2,
      fetchEvent,
      sleep,
    })

    expect(result).toBeNull()
    expect(fetchEvent).toHaveBeenCalledTimes(2)
  })

  describe('defaults', () => {
    it('exports the documented default constants', () => {
      expect(VERIFY_ATTEMPTS).toBe(8)
      expect(VERIFY_INTERVAL_MS).toBe(2_000)
    })

    it('uses default attempts and interval when options are omitted', async () => {
      const fetchEvent = vi.fn().mockResolvedValue(notFound)
      const sleep = vi.fn().mockResolvedValue(undefined)

      const result = await waitForPersistedEvent(['a-1'], {
        fetchEvent,
        sleep,
      })

      expect(result).toBeNull()
      expect(fetchEvent).toHaveBeenCalledTimes(VERIFY_ATTEMPTS)
      expect(sleep).toHaveBeenCalledTimes(VERIFY_ATTEMPTS - 1)
      expect(sleep).toHaveBeenCalledWith(VERIFY_INTERVAL_MS)
    })
  })
})
