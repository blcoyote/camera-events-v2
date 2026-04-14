import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { handleClipRequest } from './-clip-proxy'

const FRIGATE_URL = 'http://frigate.local:5000'

function mockFetchBinary(buffer: ArrayBuffer, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new Error('not json')),
    arrayBuffer: () => Promise.resolve(buffer),
  })
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError('fetch failed'))
}

describe('handleClipRequest', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.FRIGATE_URL = FRIGATE_URL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('returns 401 when user is not authenticated', async () => {
    const response = await handleClipRequest('front_door.123', false)
    expect(response.status).toBe(401)
  })

  it('returns 400 when event ID is invalid', async () => {
    const response = await handleClipRequest('../etc/passwd', true)
    expect(response.status).toBe(400)
  })

  it('returns MP4 with correct headers on success', async () => {
    const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20]).buffer
    globalThis.fetch = mockFetchBinary(mp4Bytes)
    const response = await handleClipRequest('front_door.123', true)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="event-front_door.123.mp4"',
    )
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })

  it('returns 502 when Frigate is unreachable', async () => {
    globalThis.fetch = mockFetchNetworkError()
    const response = await handleClipRequest('front_door.123', true)

    expect(response.status).toBe(502)
  })

  it('returns 502 when Frigate returns HTTP error', async () => {
    globalThis.fetch = mockFetchBinary(new ArrayBuffer(0), 500)
    const response = await handleClipRequest('front_door.123', true)

    expect(response.status).toBe(502)
  })
})
