import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { FrigateEvent, FrigateReview, FrigateReviewSummary } from './types'
import { clearFrigateCache } from './cache'

const FRIGATE_URL = 'http://frigate.local:5000'

const MOCK_EVENT: FrigateEvent = {
  id: '1678886400.123-abc',
  label: 'person',
  sub_label: null,
  camera: 'front_door',
  start_time: 1678886400,
  end_time: 1678886405,
  false_positive: null,
  zones: ['driveway'],
  thumbnail: '/api/events/1678886400.123-abc/thumbnail.jpg',
  has_clip: true,
  has_snapshot: true,
  retain_indefinitely: false,
  plus_id: null,
  box: null,
  top_score: null,
  data: {
    attributes: [],
    box: [0.5, 0.5, 0.1, 0.2],
    region: [0, 0, 1, 1],
    score: 0.9,
    top_score: 0.9,
    type: 'object',
  },
}

function mockFetchJson(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  })
}

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

function mockFetchBadJson(status = 200) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  })
}

function mockFetchTimeout() {
  return vi.fn().mockRejectedValue(
    new DOMException('signal timed out', 'TimeoutError'),
  )
}

describe('getEvents', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearFrigateCache()
    process.env.FRIGATE_URL = FRIGATE_URL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('returns events array on success with no filters', async () => {
    globalThis.fetch = mockFetchJson([MOCK_EVENT])
    const { getEvents } = await import('./client')
    const result = await getEvents()

    expect(result).toEqual({ ok: true, data: [MOCK_EVENT] })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${FRIGATE_URL}/api/events`,
      expect.objectContaining({ signal: expect.anything() }),
    )
  })

  it('serializes query params correctly', async () => {
    globalThis.fetch = mockFetchJson([])
    const { getEvents } = await import('./client')
    await getEvents({ cameras: 'front_door', labels: 'person', limit: 10 })

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('cameras=front_door')
    expect(calledUrl).toContain('labels=person')
    expect(calledUrl).toContain('limit=10')
  })

  it('serializes time range params', async () => {
    globalThis.fetch = mockFetchJson([])
    const { getEvents } = await import('./client')
    await getEvents({ after: '1678886400', before: '1678972800' })

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('after=1678886400')
    expect(calledUrl).toContain('before=1678972800')
  })

  it('returns { ok: false } with status on HTTP 404', async () => {
    globalThis.fetch = mockFetchJson({ detail: 'not found' }, 404)
    const { getEvents } = await import('./client')
    const result = await getEvents()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
      expect(result.error).toBeTruthy()
    }
  })

  it('returns { ok: false } on network failure', async () => {
    globalThis.fetch = mockFetchNetworkError()
    const { getEvents } = await import('./client')
    const result = await getEvents()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('fetch failed')
    }
  })

  it('returns { ok: false } on malformed JSON', async () => {
    globalThis.fetch = mockFetchBadJson()
    const { getEvents } = await import('./client')
    const result = await getEvents()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns { ok: false } on timeout', async () => {
    globalThis.fetch = mockFetchTimeout()
    const { getEvents } = await import('./client')
    const result = await getEvents()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('timed out')
    }
  })

  it('omits undefined query params', async () => {
    globalThis.fetch = mockFetchJson([])
    const { getEvents } = await import('./client')
    await getEvents({ cameras: 'front_door', limit: undefined })

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('cameras=front_door')
    expect(calledUrl).not.toContain('limit')
  })
})

describe('getEventThumbnail', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearFrigateCache()
    process.env.FRIGATE_URL = FRIGATE_URL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('makes GET request to correct thumbnail URL', async () => {
    const buffer = new ArrayBuffer(8)
    globalThis.fetch = mockFetchBinary(buffer)
    const { getEventThumbnail } = await import('./client')
    const result = await getEventThumbnail('abc123')

    expect(result).toEqual({ ok: true, data: buffer })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/events/abc123/thumbnail.jpg`)
  })

  it('returns { ok: false } on HTTP error', async () => {
    globalThis.fetch = mockFetchBinary(new ArrayBuffer(0), 404)
    const { getEventThumbnail } = await import('./client')
    const result = await getEventThumbnail('missing')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
    }
  })
})

describe('getEventSnapshot', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearFrigateCache()
    process.env.FRIGATE_URL = FRIGATE_URL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('makes GET request to correct snapshot URL', async () => {
    const buffer = new ArrayBuffer(16)
    globalThis.fetch = mockFetchBinary(buffer)
    const { getEventSnapshot } = await import('./client')
    const result = await getEventSnapshot('abc123')

    expect(result).toEqual({ ok: true, data: buffer })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/events/abc123/snapshot.jpg`)
  })

  it('returns { ok: false } on HTTP error', async () => {
    globalThis.fetch = mockFetchBinary(new ArrayBuffer(0), 500)
    const { getEventSnapshot } = await import('./client')
    const result = await getEventSnapshot('abc123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(500)
    }
  })
})

const MOCK_REVIEW: FrigateReview = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  camera: 'front_door',
  start_time: '2024-07-29T15:51:28.071Z',
  end_time: '2024-07-29T15:51:33.071Z',
  has_been_reviewed: false,
  severity: 'alert',
  thumb_path: '/media/thumbnails/front_door/123.jpg',
  data: {},
}

describe('getEventSummary', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('calls the correct endpoint', async () => {
    const summary = { camera_counts: {} }
    globalThis.fetch = mockFetchJson(summary)
    const { getEventSummary } = await import('./client')
    const result = await getEventSummary()

    expect(result).toEqual({ ok: true, data: summary })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('/api/events/summary')
  })

  it('passes timezone param', async () => {
    globalThis.fetch = mockFetchJson({})
    const { getEventSummary } = await import('./client')
    await getEventSummary({ timezone: 'Europe/Oslo' })

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('timezone=Europe%2FOslo')
  })
})

describe('getReviews', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('serializes severity and reviewed params', async () => {
    globalThis.fetch = mockFetchJson([MOCK_REVIEW])
    const { getReviews } = await import('./client')
    const result = await getReviews({ severity: 'alert', reviewed: 0 })

    expect(result).toEqual({ ok: true, data: [MOCK_REVIEW] })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('severity=alert')
    expect(calledUrl).toContain('reviewed=0')
  })
})

describe('getReviewByEvent', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('makes GET request to correct path', async () => {
    globalThis.fetch = mockFetchJson(MOCK_REVIEW)
    const { getReviewByEvent } = await import('./client')
    const result = await getReviewByEvent('abc123')

    expect(result).toEqual({ ok: true, data: MOCK_REVIEW })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/review/event/abc123`)
  })
})

describe('getReviewSummary', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('passes timezone param and returns summary', async () => {
    const summary: FrigateReviewSummary = {
      last24Hours: { reviewed_alert: 0, reviewed_detection: 0, total_alert: 5, total_detection: 12 },
    }
    globalThis.fetch = mockFetchJson(summary)
    const { getReviewSummary } = await import('./client')
    const result = await getReviewSummary({ timezone: 'Europe/Oslo' })

    expect(result).toEqual({ ok: true, data: summary })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('timezone=Europe%2FOslo')
  })
})

describe('getTimeline', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('passes camera and limit params', async () => {
    globalThis.fetch = mockFetchJson([{ timestamp: 1678886400 }])
    const { getTimeline } = await import('./client')
    const result = await getTimeline({ camera: 'front_door', limit: 50 })

    expect(result.ok).toBe(true)
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('camera=front_door')
    expect(calledUrl).toContain('limit=50')
  })
})

describe('getStats', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('calls the correct endpoint with no params', async () => {
    const stats = { cpu_usages: {}, detectors: {} }
    globalThis.fetch = mockFetchJson(stats)
    const { getStats } = await import('./client')
    const result = await getStats()

    expect(result).toEqual({ ok: true, data: stats })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/stats`)
  })
})

describe('getConfig', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('calls the correct endpoint with no params', async () => {
    const config = { cameras: { front_door: {} } }
    globalThis.fetch = mockFetchJson(config)
    const { getConfig } = await import('./client')
    const result = await getConfig()

    expect(result).toEqual({ ok: true, data: config })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/config`)
  })
})

describe('getCameras', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('returns camera names from config', async () => {
    const config = { cameras: { front_door: { enabled: true }, backyard: { enabled: true }, garage: { enabled: false } } }
    globalThis.fetch = mockFetchJson(config)
    const { getCameras } = await import('./client')
    const result = await getCameras()

    expect(result).toEqual({ ok: true, data: ['backyard', 'front_door', 'garage'] })
  })

  it('returns empty array when config has no cameras key', async () => {
    globalThis.fetch = mockFetchJson({ mqtt: {} })
    const { getCameras } = await import('./client')
    const result = await getCameras()

    expect(result).toEqual({ ok: true, data: [] })
  })

  it('propagates errors from getConfig', async () => {
    globalThis.fetch = mockFetchJson({}, 500)
    const { getCameras } = await import('./client')
    const result = await getCameras()

    expect(result.ok).toBe(false)
  })
})

describe('getEventClip', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearFrigateCache()
    process.env.FRIGATE_URL = FRIGATE_URL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('makes GET request to correct clip URL', async () => {
    const buffer = new ArrayBuffer(32)
    globalThis.fetch = mockFetchBinary(buffer)
    const { getEventClip } = await import('./client')
    const result = await getEventClip('abc123')

    expect(result).toEqual({ ok: true, data: buffer })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/events/abc123/clip.mp4`)
  })

  it('returns { ok: false } on HTTP error', async () => {
    globalThis.fetch = mockFetchBinary(new ArrayBuffer(0), 404)
    const { getEventClip } = await import('./client')
    const result = await getEventClip('missing')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
    }
  })

  it('returns { ok: false } on network failure', async () => {
    globalThis.fetch = mockFetchNetworkError()
    const { getEventClip } = await import('./client')
    const result = await getEventClip('abc123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('fetch failed')
    }
  })
})

describe('getLatestSnapshot', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => { clearFrigateCache(); process.env.FRIGATE_URL = FRIGATE_URL })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) { delete process.env.FRIGATE_URL } else { process.env.FRIGATE_URL = originalEnv }
  })

  it('makes GET request to correct snapshot URL and returns ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(32)
    globalThis.fetch = mockFetchBinary(buffer)
    const { getLatestSnapshot } = await import('./client')
    const result = await getLatestSnapshot('front_door')

    expect(result).toEqual({ ok: true, data: buffer })
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toBe(`${FRIGATE_URL}/api/front_door/latest.jpg`)
  })

  it('returns { ok: false } on HTTP error', async () => {
    globalThis.fetch = mockFetchBinary(new ArrayBuffer(0), 404)
    const { getLatestSnapshot } = await import('./client')
    const result = await getLatestSnapshot('front_door')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(404)
    }
  })

  it('returns { ok: false } on network failure', async () => {
    globalThis.fetch = mockFetchNetworkError()
    const { getLatestSnapshot } = await import('./client')
    const result = await getLatestSnapshot('front_door')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('fetch failed')
    }
  })
})

describe('frigateGet caching', () => {
  const originalEnv = process.env.FRIGATE_URL
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearFrigateCache()
    process.env.FRIGATE_URL = FRIGATE_URL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('returns cached result on second call without hitting fetch again', async () => {
    globalThis.fetch = mockFetchJson([MOCK_EVENT])
    const { getEvents } = await import('./client')

    const first = await getEvents()
    const second = await getEvents()

    expect(first).toEqual(second)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('cache key distinguishes different URLs', async () => {
    globalThis.fetch = mockFetchJson([MOCK_EVENT])
    const { getEvents } = await import('./client')

    await getEvents({ limit: 10 })
    await getEvents({ limit: 20 })

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache failed responses', async () => {
    globalThis.fetch = mockFetchJson({ detail: 'error' }, 500)
    const { getEvents } = await import('./client')

    const first = await getEvents()
    expect(first.ok).toBe(false)

    globalThis.fetch = mockFetchJson([MOCK_EVENT])
    const second = await getEvents()
    expect(second.ok).toBe(true)
  })

  it('does not cache binary endpoint responses', async () => {
    const buffer = new ArrayBuffer(8)
    globalThis.fetch = mockFetchBinary(buffer)
    const { getEventThumbnail } = await import('./client')

    await getEventThumbnail('abc123')
    await getEventThumbnail('abc123')

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('clearFrigateCache causes next call to fetch again', async () => {
    globalThis.fetch = mockFetchJson([MOCK_EVENT])
    const { getEvents, clearFrigateCache: clear } = await import('./client')

    await getEvents()
    clear()
    await getEvents()

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('cache expires after TTL', async () => {
    vi.useFakeTimers()
    try {
      globalThis.fetch = mockFetchJson([MOCK_EVENT])
      const { getEvents } = await import('./client')

      await getEvents()
      vi.advanceTimersByTime(600_001)
      await getEvents()

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
