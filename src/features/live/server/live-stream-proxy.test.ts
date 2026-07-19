import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getCameraLiveStream } from '#/features/shared/server/frigate/client'
import {
  handleLiveStreamRequest,
  parseOptionalPositiveInt,
} from './live-stream-proxy'

vi.mock('#/features/shared/server/frigate/client', () => ({
  getCameraLiveStream: vi.fn(),
}))

const mockGetCameraLiveStream = vi.mocked(getCameraLiveStream)

function streamFrom(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

beforeEach(() => {
  mockGetCameraLiveStream.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleLiveStreamRequest', () => {
  // ─── Auth / validation guards ───

  it('returns 401 when user is not authenticated and never calls the client', async () => {
    const response = await handleLiveStreamRequest('garage', false)
    expect(response.status).toBe(401)
    expect(mockGetCameraLiveStream).not.toHaveBeenCalled()
  })

  it('returns 400 for a path-traversal camera name and never calls the client', async () => {
    const response = await handleLiveStreamRequest('../etc', true)
    expect(response.status).toBe(400)
    expect(mockGetCameraLiveStream).not.toHaveBeenCalled()
  })

  it('returns 400 for a camera name containing a slash', async () => {
    const response = await handleLiveStreamRequest('garage/../secret', true)
    expect(response.status).toBe(400)
    expect(mockGetCameraLiveStream).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty camera name', async () => {
    const response = await handleLiveStreamRequest('', true)
    expect(response.status).toBe(400)
    expect(mockGetCameraLiveStream).not.toHaveBeenCalled()
  })

  // ─── Upstream network failure ───

  it('returns 502 when the client reports a network failure', async () => {
    mockGetCameraLiveStream.mockResolvedValue({
      ok: false,
      error: 'fetch failed',
    })
    const response = await handleLiveStreamRequest('garage', true)
    expect(response.status).toBe(502)
  })

  // ─── Mirrors upstream non-2xx ───

  it('mirrors an upstream non-2xx status and cancels the upstream body', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const body = { cancel } as unknown as ReadableStream<Uint8Array>
    mockGetCameraLiveStream.mockResolvedValue({
      ok: true,
      data: { status: 404, body, headers: new Headers() },
    })
    const response = await handleLiveStreamRequest('garage', true)
    expect(response.status).toBe(404)
    expect(cancel).toHaveBeenCalledOnce()
  })

  // ─── Success ───

  it('streams the body through with Content-Type copied and Cache-Control: no-store', async () => {
    const body = streamFrom(new Uint8Array([1, 2, 3]))
    mockGetCameraLiveStream.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body,
        headers: new Headers({
          'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        }),
      },
    })
    const response = await handleLiveStreamRequest('garage', true)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'multipart/x-mixed-replace; boundary=frame',
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.body).toBe(body)
  })

  it('falls back to multipart/x-mixed-replace when upstream omits Content-Type', async () => {
    mockGetCameraLiveStream.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body: streamFrom(new Uint8Array([1])),
        headers: new Headers(),
      },
    })
    const response = await handleLiveStreamRequest('garage', true)
    expect(response.headers.get('Content-Type')).toBe(
      'multipart/x-mixed-replace',
    )
  })

  it('does not set Content-Length on the response', async () => {
    mockGetCameraLiveStream.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body: streamFrom(new Uint8Array([1])),
        headers: new Headers({ 'Content-Length': '999999' }),
      },
    })
    const response = await handleLiveStreamRequest('garage', true)
    expect(response.headers.get('Content-Length')).toBeNull()
  })

  // ─── Options forwarding ───

  it('forwards signal, fps, and height into getCameraLiveStream', async () => {
    mockGetCameraLiveStream.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        body: streamFrom(new Uint8Array([1])),
        headers: new Headers(),
      },
    })
    const controller = new AbortController()
    await handleLiveStreamRequest('garage', true, {
      signal: controller.signal,
      fps: 5,
      height: 480,
    })
    expect(mockGetCameraLiveStream).toHaveBeenCalledWith('garage', {
      signal: controller.signal,
      fps: 5,
      height: 480,
    })
  })
})

describe('parseOptionalPositiveInt', () => {
  it('parses a valid positive integer string', () => {
    expect(parseOptionalPositiveInt('5')).toBe(5)
  })

  it('returns undefined for null', () => {
    expect(parseOptionalPositiveInt(null)).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    expect(parseOptionalPositiveInt('0')).toBeUndefined()
  })

  it('returns undefined for a negative number', () => {
    expect(parseOptionalPositiveInt('-3')).toBeUndefined()
  })

  it('returns undefined for a non-numeric string', () => {
    expect(parseOptionalPositiveInt('abc')).toBeUndefined()
  })

  it('truncates a decimal string to its integer part (parseInt behavior)', () => {
    expect(parseOptionalPositiveInt('12.5')).toBe(12)
  })
})
