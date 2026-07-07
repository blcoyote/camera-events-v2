import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  resyncSubscription,
  resyncExistingPushSubscription,
} from './pushResync'

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeSubscription(
  overrides: { endpoint?: string; keys?: Record<string, string> } = {},
) {
  const endpoint = overrides.endpoint ?? 'https://push.example.com/sub1'
  const keys = overrides.keys ?? { p256dh: 'p-key', auth: 'a-key' }
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys }),
  }
}

describe('resyncSubscription', () => {
  it('POSTs the subscription endpoint and keys to /api/push/subscribe', async () => {
    const subscription = makeSubscription()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })

    await resyncSubscription(subscription, fetchMock)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/push/subscribe',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('https://push.example.com/sub1'),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'p-key', auth: 'a-key' },
    })
  })

  it('returns true when the response is ok', async () => {
    const subscription = makeSubscription()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })

    const result = await resyncSubscription(subscription, fetchMock)

    expect(result).toBe(true)
  })

  it('returns false without throwing when the response is not ok', async () => {
    const subscription = makeSubscription()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    const result = await resyncSubscription(subscription, fetchMock)

    expect(result).toBe(false)
  })

  it('returns false without throwing when fetchFn rejects', async () => {
    const subscription = makeSubscription()
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))

    const result = await resyncSubscription(subscription, fetchMock)

    expect(result).toBe(false)
  })

  it('defaults to globalThis.fetch when no fetchFn is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resyncSubscription(makeSubscription())

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/push/subscribe',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toBe(true)
  })
})

describe('resyncExistingPushSubscription', () => {
  it('returns false and never calls fetchFn when PushManager is undefined', async () => {
    vi.stubGlobal('navigator', { serviceWorker: {} })
    const fetchMock = vi.fn()

    const result = await resyncExistingPushSubscription(fetchMock)

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false and never calls fetchFn when there is no existing subscription', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
    })
    const fetchMock = vi.fn()

    const result = await resyncExistingPushSubscription(fetchMock)

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls fetchFn and returns true when a subscription exists', async () => {
    const subscription = {
      toJSON: () => ({
        endpoint: 'https://push.example.com/s',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    }
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(subscription),
          },
        }),
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })

    const result = await resyncExistingPushSubscription(fetchMock)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/push/subscribe',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toBe(true)
  })

  it('returns false without throwing when getSubscription rejects', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockRejectedValue(new Error('boom')),
          },
        }),
      },
    })
    const fetchMock = vi.fn()

    const result = await resyncExistingPushSubscription(fetchMock)

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
