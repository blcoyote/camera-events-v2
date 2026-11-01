// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePushSubscription } from './usePushSubscription'

vi.mock('#/paraglide/runtime.js', () => ({ getLocale: () => 'da' }))

afterEach(() => vi.unstubAllGlobals())

describe('usePushSubscription subscribe body', () => {
  it('includes the current locale', async () => {
    const sub = {
      endpoint: 'https://e/1',
      toJSON: () => ({
        endpoint: 'https://e/1',
        keys: { p256dh: 'p', auth: 'a' },
      }),
      unsubscribe: vi.fn(),
    }
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ publicKey: 'AAAA' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn().mockResolvedValue(sub),
          },
        }),
      },
    })

    const { result } = renderHook(() => usePushSubscription())
    await act(async () => {
      await result.current.subscribe()
    })

    const call = fetchMock.mock.calls.find(
      (c) => c[0] === '/api/push/subscribe',
    )
    expect(JSON.parse(call![1].body).locale).toBe('da')
  })
})
