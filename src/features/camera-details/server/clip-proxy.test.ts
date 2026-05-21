import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { handleClipRequest } from './clip-proxy'

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

function streamFrom(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function mockFetchStream({
  status = 200,
  headers = {},
  body,
}: {
  status?: number
  headers?: Record<string, string>
  body?: ReadableStream<Uint8Array> | null
} = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    body: body === undefined ? streamFrom(new Uint8Array([1, 2, 3, 4])) : body,
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

  // ─── Auth / validation guards ───

  it('returns 401 when user is not authenticated', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    const response = await handleClipRequest('front_door.123', false)
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 when event ID is invalid', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    const response = await handleClipRequest('../etc/passwd', true)
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ─── Default (inline serve) ───

  it('serves inline by default — no Content-Disposition, has Accept-Ranges, Content-Length propagated', async () => {
    globalThis.fetch = mockFetchStream({
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': '4096',
        'Accept-Ranges': 'bytes',
      },
      body: streamFrom(new Uint8Array(4)),
    })
    const response = await handleClipRequest('front_door.123', true)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Disposition')).toBeNull()
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Content-Length')).toBe('4096')
  })

  // ─── Download flag ───

  it('sets Content-Disposition: attachment when options.download is true', async () => {
    globalThis.fetch = mockFetchStream({
      status: 200,
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': '4096' },
    })
    const response = await handleClipRequest('front_door.123', true, {
      download: true,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="event-front_door.123.mp4"',
    )
  })

  // ─── Range pass-through ───

  it('forwards a Range header to upstream and returns 206 + Content-Range + Content-Length', async () => {
    const upstreamBytes = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd])
    const fetchMock = mockFetchStream({
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes 0-3/4096',
        'Content-Length': '4',
      },
      body: streamFrom(upstreamBytes),
    })
    globalThis.fetch = fetchMock
    const response = await handleClipRequest('front_door.123', true, {
      rangeHeader: 'bytes=0-3',
    })

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe('bytes 0-3/4096')
    expect(response.headers.get('Content-Length')).toBe('4')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const sentHeaders = new Headers(init.headers)
    expect(sentHeaders.get('Range')).toBe('bytes=0-3')

    // AC18: body length matches Content-Length, not the full mp4.
    const reader = response.body?.getReader()
    expect(reader).toBeDefined()
    if (!reader) return
    const { value } = await reader.read()
    expect(value).toEqual(upstreamBytes)
  })

  it('two-call sequence: initial 200 + Accept-Ranges, follow-up Range request returns 206', async () => {
    const firstFetch = mockFetchStream({
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': '4096',
        'Accept-Ranges': 'bytes',
      },
    })
    globalThis.fetch = firstFetch
    const initial = await handleClipRequest('front_door.123', true)
    expect(initial.status).toBe(200)
    expect(initial.headers.get('Accept-Ranges')).toBe('bytes')

    const secondFetch = mockFetchStream({
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes 1024-2047/4096',
        'Content-Length': '1024',
      },
    })
    globalThis.fetch = secondFetch
    const ranged = await handleClipRequest('front_door.123', true, {
      rangeHeader: 'bytes=1024-2047',
    })
    expect(ranged.status).toBe(206)
    expect(ranged.headers.get('Content-Range')).toBe('bytes 1024-2047/4096')
    expect(ranged.headers.get('Content-Length')).toBe('1024')
  })

  it('forwards a malformed Range header unchanged and mirrors upstream 416 (does not synthesize 206)', async () => {
    const fetchMock = mockFetchStream({
      status: 416,
      headers: {},
      body: null,
    })
    globalThis.fetch = fetchMock
    const response = await handleClipRequest('front_door.123', true, {
      rangeHeader: 'bytes=abc',
    })

    // AC20: proxy mirrors upstream status, does not synthesize 206 or collapse to 502.
    expect(response.status).toBe(416)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const sentHeaders = new Headers(init.headers)
    expect(sentHeaders.get('Range')).toBe('bytes=abc')
  })

  // ─── Upstream failure ───

  it('returns 502 when Frigate is unreachable (network error)', async () => {
    globalThis.fetch = mockFetchNetworkError()
    const response = await handleClipRequest('front_door.123', true)
    expect(response.status).toBe(502)
  })

  it('mirrors upstream 5xx status (does not collapse to 502)', async () => {
    globalThis.fetch = mockFetchStream({ status: 500, body: null })
    const response = await handleClipRequest('front_door.123', true)
    expect(response.status).toBe(500)
  })

  it('mirrors an upstream 404', async () => {
    globalThis.fetch = mockFetchStream({ status: 404, body: null })
    const response = await handleClipRequest('front_door.123', true)
    expect(response.status).toBe(404)
  })

  // ─── AC19: Content-Length propagation on 200 even when upstream omits Accept-Ranges ───

  it('propagates Content-Length from upstream on a 200 response and synthesizes Accept-Ranges when upstream omits it', async () => {
    globalThis.fetch = mockFetchStream({
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': '8192',
        // No Accept-Ranges from upstream
      },
    })
    const response = await handleClipRequest('front_door.123', true)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Length')).toBe('8192')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
  })
})
