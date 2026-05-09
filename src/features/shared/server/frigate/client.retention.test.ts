import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const originalFetch = globalThis.fetch
const originalEnv = process.env.FRIGATE_URL

beforeEach(() => {
  process.env.FRIGATE_URL = 'http://frigate.local:5000'
  process.env.FRIGATE_MOCK = undefined as unknown as string
  delete process.env.FRIGATE_MOCK
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalEnv === undefined) delete process.env.FRIGATE_URL
  else process.env.FRIGATE_URL = originalEnv
  delete process.env.FRIGATE_MOCK
  vi.restoreAllMocks()
})

const { retainEvent, unretainEvent } = await import('./client')

describe('retainEvent', () => {
  it('sends POST to /api/events/{id}/retain and returns ok:true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
    globalThis.fetch = mockFetch

    const result = await retainEvent('1713095000.123456-abcdef')

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/events/1713095000.123456-abcdef/retain')
    expect(init?.method).toBe('POST')
  })

  it('returns ok:false with error message on non-2xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })

    const result = await retainEvent('1713095000.123456-abcdef')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('404')
  })

  it('returns ok:true with data:undefined on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })

    const result = await retainEvent('1713095000.123456-abcdef')
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('returns ok:true without fetching when FRIGATE_MOCK=true', async () => {
    process.env.FRIGATE_MOCK = 'true'
    const mockFetch = vi.fn()
    globalThis.fetch = mockFetch

    const result = await retainEvent('1713095000.123456-abcdef')
    expect(result.ok).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('unretainEvent', () => {
  it('sends DELETE to /api/events/{id}/retain and returns ok:true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
    globalThis.fetch = mockFetch

    const result = await unretainEvent('1713095000.123456-abcdef')

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/events/1713095000.123456-abcdef/retain')
    expect(init?.method).toBe('DELETE')
  })

  it('returns ok:false on non-2xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })

    const result = await unretainEvent('1713095000.123456-abcdef')
    expect(result.ok).toBe(false)
  })

  it('returns ok:true without fetching when FRIGATE_MOCK=true', async () => {
    process.env.FRIGATE_MOCK = 'true'
    const mockFetch = vi.fn()
    globalThis.fetch = mockFetch

    const result = await unretainEvent('1713095000.123456-abcdef')
    expect(result.ok).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
