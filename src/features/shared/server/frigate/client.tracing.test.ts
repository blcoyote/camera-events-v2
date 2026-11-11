import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetTracingForTests,
  startTracing,
  withSpan,
} from '#/features/shared/server/tracing'
import { clearFrigateCache } from './cache'

vi.mock('@tanstack/react-start/server-only', () => ({}))
vi.mock('@opentelemetry/exporter-trace-otlp-http', async () => ({
  OTLPTraceExporter: (await import('@opentelemetry/sdk-trace'))
    .InMemorySpanExporter,
}))

const { getEvents, getEventClipStream, retainEvent, unretainEvent } =
  await import('./client')

const originalFetch = globalThis.fetch
const originalUrl = process.env.FRIGATE_URL
let exporter: InMemorySpanExporter

beforeEach(() => {
  delete process.env.FRIGATE_MOCK
  process.env.FRIGATE_URL = 'http://frigate.local:5000'
  clearFrigateCache()
  exporter = new InMemorySpanExporter()
  startTracing(new SimpleSpanProcessor({ exporter }))
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  if (originalUrl === undefined) delete process.env.FRIGATE_URL
  else process.env.FRIGATE_URL = originalUrl
  await _resetTracingForTests()
})

function stubFetch(status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve([]),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    body: null,
    headers: new Headers(),
  })
  globalThis.fetch = fn
  return fn
}

const spans = () => exporter.getFinishedSpans()

describe('Frigate client spans', () => {
  it('GET creates one CLIENT span with path and status, child of the active span', async () => {
    stubFetch()
    await withSpan('outer', {}, () => getEvents({ limit: 5 }))
    const client = spans().find((s) => s.name === 'frigate GET')!
    const outer = spans().find((s) => s.name === 'outer')!
    expect(spans().filter((s) => s.name === 'frigate GET')).toHaveLength(1)
    expect(client.kind).toBe(SpanKind.CLIENT)
    expect(client.attributes['http.request.method']).toBe('GET')
    expect(client.attributes['url.path']).toBe('/api/events')
    expect(client.attributes['http.response.status_code']).toBe(200)
    expect(client.parentSpanContext?.spanId).toBe(outer.spanContext().spanId)
  })

  it('url.path never contains a query string', async () => {
    stubFetch()
    await getEvents({ limit: 5, cameras: 'a' })
    expect(String(spans()[0]?.attributes['url.path'])).not.toContain('?')
  })

  it('a cache hit creates no span', async () => {
    stubFetch()
    await getEvents()
    await getEvents()
    expect(spans()).toHaveLength(1)
  })

  it('HTTP 500 marks the span ERROR and still returns ok:false', async () => {
    stubFetch(500)
    const result = await getEvents()
    expect(result.ok).toBe(false)
    expect(spans()[0]?.status.code).toBe(SpanStatusCode.ERROR)
    expect(spans()[0]?.attributes['http.response.status_code']).toBe(500)
  })

  it('a thrown fetch marks the span ERROR and still returns ok:false', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const result = await getEvents()
    expect(result.ok).toBe(false)
    expect(spans()[0]?.status.code).toBe(SpanStatusCode.ERROR)
    expect(spans()[0]?.status.message).toBe('fetch failed')
  })

  it('sends no traceparent header', async () => {
    const fetchFn = stubFetch()
    await getEvents()
    await getEventClipStream('abc')
    for (const [, init] of fetchFn.mock.calls as [string, RequestInit][]) {
      expect(new Headers(init.headers).has('traceparent')).toBe(false)
    }
  })

  it('POST and DELETE create spans named by method', async () => {
    stubFetch()
    await retainEvent('abc')
    await unretainEvent('abc')
    const names = spans().map((s) => s.name)
    expect(names).toContain('frigate POST')
    expect(names).toContain('frigate DELETE')
  })

  it('clip stream creates a span with the status code', async () => {
    stubFetch(206)
    await getEventClipStream('abc')
    const s = spans().find((x) => x.name === 'frigate GET')!
    expect(s.attributes['url.path']).toBe('/api/events/abc/clip.mp4')
    expect(s.attributes['http.response.status_code']).toBe(206)
  })
})
