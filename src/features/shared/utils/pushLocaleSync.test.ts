import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncPushLocale } from './pushLocaleSync'

vi.mock('#/paraglide/runtime.js', () => ({ getLocale: () => 'da' }))

const fetchMock = vi.fn()

function setSw(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value: value === undefined ? {} : { serviceWorker: value },
    configurable: true,
  })
}

const origNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (origNav) Object.defineProperty(globalThis, 'navigator', origNav)
})

const withSub = (sub: unknown) =>
  setSw({
    ready: Promise.resolve({
      pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) },
    }),
  })

describe('syncPushLocale', () => {
  it('posts endpoint and current locale', async () => {
    withSub({ endpoint: 'https://e/1' })
    await syncPushLocale()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/push/locale')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual({
      endpoint: 'https://e/1',
      locale: 'da',
    })
  })

  it('uses an explicit locale', async () => {
    withSub({ endpoint: 'https://e/1' })
    await syncPushLocale('en')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).locale).toBe('en')
  })

  it('does nothing without a subscription', async () => {
    withSub(null)
    await syncPushLocale()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not throw without serviceWorker support', async () => {
    setSw(undefined)
    await expect(syncPushLocale()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not throw when the request rejects', async () => {
    withSub({ endpoint: 'https://e/1' })
    fetchMock.mockRejectedValue(new Error('net'))
    await expect(syncPushLocale()).resolves.toBeUndefined()
  })
})
