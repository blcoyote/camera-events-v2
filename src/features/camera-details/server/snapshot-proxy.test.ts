import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { handleSnapshotRequest } from './snapshot-proxy'

// Ensure mock mode is off for real client tests
const _savedFrigateMock = process.env.FRIGATE_MOCK
beforeEach(() => {
  delete process.env.FRIGATE_MOCK
})
afterEach(() => {
  if (_savedFrigateMock === undefined) delete process.env.FRIGATE_MOCK
  else process.env.FRIGATE_MOCK = _savedFrigateMock
})

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

describe('handleSnapshotRequest', () => {
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
    const response = await handleSnapshotRequest('front_door.123', false)
    expect(response.status).toBe(401)
  })

  it('returns 400 when event ID is invalid', async () => {
    const response = await handleSnapshotRequest('../etc/passwd', true)
    expect(response.status).toBe(400)
  })

  it('returns JPEG with correct headers on success', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer
    globalThis.fetch = mockFetchBinary(jpegBytes)
    const response = await handleSnapshotRequest('front_door.123', true)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(response.headers.get('Content-Disposition')).toBeNull()
  })

  it('sets Content-Disposition when download is true', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer
    globalThis.fetch = mockFetchBinary(jpegBytes)
    const response = await handleSnapshotRequest('front_door.123', true, true)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="event-front_door.123.jpg"',
    )
  })

  it('returns 502 when Frigate is unreachable', async () => {
    globalThis.fetch = mockFetchNetworkError()
    const response = await handleSnapshotRequest('front_door.123', true)

    expect(response.status).toBe(502)
  })

  it('returns 502 when Frigate returns HTTP error', async () => {
    globalThis.fetch = mockFetchBinary(new ArrayBuffer(0), 500)
    const response = await handleSnapshotRequest('front_door.123', true)

    expect(response.status).toBe(502)
  })

  it('forwards bbox=true to the upstream Frigate URL when bbox is set', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer
    const fetchMock = mockFetchBinary(jpegBytes)
    globalThis.fetch = fetchMock
    const response = await handleSnapshotRequest(
      'front_door.123',
      true,
      false,
      true,
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('bbox=true')
  })

  it('does not include bbox in the upstream URL when bbox is not set', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer
    const fetchMock = mockFetchBinary(jpegBytes)
    globalThis.fetch = fetchMock
    await handleSnapshotRequest('front_door.123', true)

    expect(fetchMock).toHaveBeenCalledOnce()
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).not.toContain('bbox')
  })

  it('returns 401 without calling fetch even when bbox is set', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    const response = await handleSnapshotRequest(
      'front_door.123',
      false,
      false,
      true,
    )

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 without calling fetch when event id is invalid and bbox is set', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    const response = await handleSnapshotRequest(
      '../etc/passwd',
      true,
      false,
      true,
    )

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
