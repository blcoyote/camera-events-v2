import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace'
import type { MockInstance } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { log } from '#/features/shared/server/log'
import {
  _resetTracingForTests,
  startTracing,
  withRequestSpan,
  withSpan,
} from '.'

vi.mock('@tanstack/react-start/server-only', () => ({}))
// Never hit the network from the endpoint-env test.
vi.mock('@opentelemetry/exporter-trace-otlp-http', async () => ({
  OTLPTraceExporter: (await import('@opentelemetry/sdk-trace'))
    .InMemorySpanExporter,
}))

function start() {
  const exporter = new InMemorySpanExporter()
  startTracing(new SimpleSpanProcessor({ exporter }))
  return exporter
}

const ok =
  (status = 200) =>
  async () =>
    new Response(null, { status })
const req = (path: string, method = 'GET') =>
  new Request(`http://localhost${path}`, { method })

afterEach(async () => {
  await _resetTracingForTests()
  vi.unstubAllEnvs()
})

describe('startTracing', () => {
  it('is off without endpoint or processor: fn runs, request passes through', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '')
    startTracing()
    expect(await withSpan('x', {}, () => 5)).toBe(5)
    const res = await withRequestSpan(ok(204))(req('/'))
    expect(res.status).toBe(204)
    expect(trace.getActiveSpan()).toBeUndefined()
  })

  it('turns on from OTEL_EXPORTER_OTLP_ENDPOINT without a processor', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:1')
    startTracing()
    let active = false
    await withSpan('x', {}, () => {
      active = trace.getActiveSpan() !== undefined
    })
    expect(active).toBe(true)
  })
})

describe('withRequestSpan', () => {
  it.each([
    ['/', 'page'],
    ['/api/events', 'api'],
    ['/_serverFn/abc', 'serverFn'],
  ])('creates one SERVER span for %s', async (path, kind) => {
    const exporter = start()
    await withRequestSpan(ok(201))(req(path, 'POST'))
    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0].name).toBe('POST')
    expect(spans[0].kind).toBe(SpanKind.SERVER)
    expect(spans[0].attributes).toMatchObject({
      'http.request.method': 'POST',
      'url.path': path,
      'request.kind': kind,
      'http.response.status_code': 201,
    })
  })

  it('collapses unknown methods to _OTHER', async () => {
    const exporter = start()
    await withRequestSpan(ok())(req('/', 'BREW'))
    expect(
      exporter.getFinishedSpans()[0].attributes['http.request.method'],
    ).toBe('_OTHER')
  })

  it.each([
    '/assets/index-abc.js',
    '/sw.js',
    '/api/health',
    '/api/health/ready',
  ])('creates no span for %s', async (path) => {
    const exporter = start()
    const res = await withRequestSpan(ok())(req(path))
    expect(res.status).toBe(200)
    expect(exporter.getFinishedSpans()).toHaveLength(0)
  })

  it('never records the query string', async () => {
    const exporter = start()
    await withRequestSpan(ok())(
      req('/api/auth/google/callback?code=SECRET&state=X'),
    )
    const [span] = exporter.getFinishedSpans()
    expect(span.attributes['url.path']).toBe('/api/auth/google/callback')
    expect(
      JSON.stringify({ n: span.name, a: span.attributes, e: span.events }),
    ).not.toContain('SECRET')
  })

  it('marks a thrown error as ERROR with an exception event and rethrows', async () => {
    const exporter = start()
    await expect(
      withRequestSpan(async () => {
        throw new Error('boom')
      })(req('/')),
    ).rejects.toThrow('boom')
    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.events.map((e) => e.name)).toContain('exception')
  })

  it('marks a 5xx response as ERROR', async () => {
    const exporter = start()
    await withRequestSpan(ok(503))(req('/'))
    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.attributes['http.response.status_code']).toBe(503)
  })

  it('keeps the request span active across awaits for child spans and logs', async () => {
    const exporter = start()
    const spy: MockInstance<typeof console.log> = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {})
    await withRequestSpan(async () => {
      await new Promise((r) => setTimeout(r, 1))
      await withSpan('child', {}, () => {})
      log.info('t', 'inside')
      return new Response(null)
    })(req('/api/x'))
    const line = JSON.parse(spy.mock.calls[0][0] as string) as Record<
      string,
      string
    >
    spy.mockRestore()
    const spans = exporter.getFinishedSpans()
    const child = spans.find((s) => s.name === 'child')
    const server = spans.find((s) => s.name === 'GET')
    expect(child?.parentSpanContext?.spanId).toBe(server?.spanContext().spanId)
    expect(line.trace_id).toBe(server?.spanContext().traceId)
    expect(line.span_id).toBe(server?.spanContext().spanId)
  })
})

describe('withSpan', () => {
  it('root: true starts a new trace inside an active span', async () => {
    const exporter = start()
    await withSpan('outer', {}, () =>
      withSpan('inner', {}, () => {}, { root: true }),
    )
    const spans = exporter.getFinishedSpans()
    const outer = spans.find((s) => s.name === 'outer')
    const inner = spans.find((s) => s.name === 'inner')
    expect(inner?.spanContext().traceId).not.toBe(outer?.spanContext().traceId)
  })

  it('records exception and ERROR on throw, and rethrows', async () => {
    const exporter = start()
    await expect(
      withSpan('x', { a: 1 }, () => {
        throw new Error('nope')
      }),
    ).rejects.toThrow('nope')
    const [span] = exporter.getFinishedSpans()
    expect(span.attributes.a).toBe(1)
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.events[0].name).toBe('exception')
  })
})
