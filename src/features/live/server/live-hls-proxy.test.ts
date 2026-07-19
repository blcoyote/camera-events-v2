import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  getCameraHlsPlaylist,
  getCameraHlsSegment,
} from '#/features/shared/server/frigate/client'
import {
  handleHlsPlaylistRequest,
  handleHlsSegmentRequest,
} from './live-hls-proxy'

vi.mock('#/features/shared/server/frigate/client', () => ({
  getCameraHlsPlaylist: vi.fn(),
  getCameraHlsSegment: vi.fn(),
}))

const mockGetCameraHlsPlaylist = vi.mocked(getCameraHlsPlaylist)
const mockGetCameraHlsSegment = vi.mocked(getCameraHlsSegment)

function streamFrom(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

beforeEach(() => {
  mockGetCameraHlsPlaylist.mockReset()
  mockGetCameraHlsSegment.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleHlsPlaylistRequest', () => {
  // ─── Auth / validation guards ───

  it('returns 401 when user is not authenticated and never calls the client', async () => {
    const response = await handleHlsPlaylistRequest('garage', false)
    expect(response.status).toBe(401)
    expect(mockGetCameraHlsPlaylist).not.toHaveBeenCalled()
  })

  it('returns 400 for a path-traversal camera name and never calls the client', async () => {
    const response = await handleHlsPlaylistRequest('../etc', true)
    expect(response.status).toBe(400)
    expect(mockGetCameraHlsPlaylist).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty camera name', async () => {
    const response = await handleHlsPlaylistRequest('', true)
    expect(response.status).toBe(400)
    expect(mockGetCameraHlsPlaylist).not.toHaveBeenCalled()
  })

  // ─── Upstream network failure ───

  it('returns 502 when the client reports a network failure', async () => {
    mockGetCameraHlsPlaylist.mockResolvedValue({
      ok: false,
      error: 'fetch failed',
    })
    const response = await handleHlsPlaylistRequest('garage', true)
    expect(response.status).toBe(502)
  })

  // ─── Mirrors upstream non-2xx ───

  it('mirrors an upstream 404 with no body', async () => {
    mockGetCameraHlsPlaylist.mockResolvedValue({
      ok: true,
      data: { status: 404, headers: new Headers(), text: '' },
    })
    const response = await handleHlsPlaylistRequest('garage', true)
    expect(response.status).toBe(404)
  })

  // ─── Success ───

  it('returns 200 with rewritten playlist body, correct Content-Type and Cache-Control', async () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:2.000,',
      'segment1.m4s',
      '',
    ].join('\n')
    mockGetCameraHlsPlaylist.mockResolvedValue({
      ok: true,
      data: { status: 200, headers: new Headers(), text: playlist },
    })
    const response = await handleHlsPlaylistRequest('garage', true)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.apple.mpegurl',
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')

    const body = await response.text()
    expect(body).toContain(
      '/api/live/garage/segment?ref=' + encodeURIComponent('init.mp4'),
    )
    expect(body).toContain(
      '/api/live/garage/segment?ref=' + encodeURIComponent('segment1.m4s'),
    )
  })

  it('forwards signal into getCameraHlsPlaylist', async () => {
    mockGetCameraHlsPlaylist.mockResolvedValue({
      ok: true,
      data: { status: 200, headers: new Headers(), text: '#EXTM3U\n' },
    })
    const controller = new AbortController()
    await handleHlsPlaylistRequest('garage', true, {
      signal: controller.signal,
    })
    expect(mockGetCameraHlsPlaylist).toHaveBeenCalledWith('garage', {
      signal: controller.signal,
    })
  })
})

describe('handleHlsSegmentRequest', () => {
  // ─── Auth / validation guards ───

  it('returns 401 when user is not authenticated and never calls the client', async () => {
    const response = await handleHlsSegmentRequest(
      'garage',
      'segment1.m4s',
      false,
    )
    expect(response.status).toBe(401)
    expect(mockGetCameraHlsSegment).not.toHaveBeenCalled()
  })

  it('returns 400 for a path-traversal camera name and never calls the client', async () => {
    const response = await handleHlsSegmentRequest(
      '../etc',
      'segment1.m4s',
      true,
    )
    expect(response.status).toBe(400)
    expect(mockGetCameraHlsSegment).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid segment ref (path traversal) and never calls the client', async () => {
    const response = await handleHlsSegmentRequest(
      'garage',
      '../etc/passwd',
      true,
    )
    expect(response.status).toBe(400)
    expect(mockGetCameraHlsSegment).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid segment ref (absolute URL) and never calls the client', async () => {
    const response = await handleHlsSegmentRequest(
      'garage',
      'http://evil/x',
      true,
    )
    expect(response.status).toBe(400)
    expect(mockGetCameraHlsSegment).not.toHaveBeenCalled()
  })

  // ─── Upstream network failure ───

  it('returns 502 when the client reports a network failure', async () => {
    mockGetCameraHlsSegment.mockResolvedValue({
      ok: false,
      error: 'fetch failed',
    })
    const response = await handleHlsSegmentRequest(
      'garage',
      'segment1.m4s',
      true,
    )
    expect(response.status).toBe(502)
  })

  // ─── Mirrors upstream non-2xx ───

  it('mirrors an upstream non-2xx status and cancels the upstream body', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const body = { cancel } as unknown as ReadableStream<Uint8Array>
    mockGetCameraHlsSegment.mockResolvedValue({
      ok: true,
      data: { status: 404, body, headers: new Headers() },
    })
    const response = await handleHlsSegmentRequest(
      'garage',
      'segment1.m4s',
      true,
    )
    expect(response.status).toBe(404)
    expect(cancel).toHaveBeenCalledOnce()
  })

  // ─── Success ───

  it('streams the body through with Content-Type copied, Cache-Control: no-store', async () => {
    const body = streamFrom(new Uint8Array([1, 2, 3]))
    mockGetCameraHlsSegment.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body,
        headers: new Headers({ 'Content-Type': 'video/mp4' }),
      },
    })
    const response = await handleHlsSegmentRequest(
      'garage',
      'segment1.m4s',
      true,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.body).toBe(body)
  })

  it('falls back to video/mp4 when upstream omits Content-Type', async () => {
    mockGetCameraHlsSegment.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body: streamFrom(new Uint8Array([1])),
        headers: new Headers(),
      },
    })
    const response = await handleHlsSegmentRequest(
      'garage',
      'segment1.m4s',
      true,
    )
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
  })

  it('forwards Content-Length, Content-Range and Accept-Ranges from upstream on a 206', async () => {
    mockGetCameraHlsSegment.mockResolvedValue({
      ok: true,
      data: {
        status: 206,
        body: streamFrom(new Uint8Array([1, 2])),
        headers: new Headers({
          'Content-Type': 'video/mp4',
          'Content-Length': '2',
          'Content-Range': 'bytes 0-1/10',
          'Accept-Ranges': 'bytes',
        }),
      },
    })
    const response = await handleHlsSegmentRequest(
      'garage',
      'segment1.m4s',
      true,
      { rangeHeader: 'bytes=0-1' },
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Length')).toBe('2')
    expect(response.headers.get('Content-Range')).toBe('bytes 0-1/10')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
  })

  it('forwards the Range header into getCameraHlsSegment', async () => {
    mockGetCameraHlsSegment.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body: streamFrom(new Uint8Array([1])),
        headers: new Headers(),
      },
    })
    const controller = new AbortController()
    await handleHlsSegmentRequest('garage', 'segment1.m4s', true, {
      signal: controller.signal,
      rangeHeader: 'bytes=0-1',
    })
    expect(mockGetCameraHlsSegment).toHaveBeenCalledWith(
      'garage',
      'segment1.m4s',
      { signal: controller.signal, rangeHeader: 'bytes=0-1' },
    )
  })
})
