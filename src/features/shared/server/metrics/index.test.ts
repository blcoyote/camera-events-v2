import {
  AggregationTemporality,
  DataPointType,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  _resetMetricsForTests,
  observeMqttConnection,
  recordMqttMessage,
  recordPushSend,
  startMetrics,
  withRequestMetrics,
} from '.'

vi.mock('@tanstack/react-start/server-only', () => ({}))

function start() {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 60_000,
  })
  startMetrics(reader)
  return reader
}

async function collect(reader: ReturnType<typeof start>) {
  const { resourceMetrics } = await reader.collect()
  const metrics = resourceMetrics.scopeMetrics.flatMap((s) => s.metrics)
  return {
    resource: resourceMetrics.resource,
    metric: (name: string) => metrics.find((m) => m.descriptor.name === name),
  }
}

const ok =
  (status = 200) =>
  async () =>
    new Response(null, { status })
const req = (path: string, method = 'GET') =>
  new Request(`http://localhost${path}`, { method })

async function durationPoints(reader: ReturnType<typeof start>) {
  const { metric } = await collect(reader)
  return metric('http.server.request.duration')?.dataPoints ?? []
}

afterEach(async () => {
  await _resetMetricsForTests()
  vi.unstubAllEnvs()
})

describe('metrics', () => {
  it('is a no-op without reader or endpoint, and does not mark started', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '')
    startMetrics()
    const res = await withRequestMetrics(ok(204))(req('/api/health'))
    expect(res.status).toBe(204)

    const reader = start()
    await withRequestMetrics(ok())(req('/api/health'))
    expect(await durationPoints(reader)).toHaveLength(1)
  })

  it.each([
    ['/_serverFn/abc', 'serverFn'],
    ['/api/health', 'api'],
    ['/api/events/123/snapshot.jpg', 'api'],
    ['/assets/index-abc.js', 'asset'],
    ['/sw.js', 'asset'],
    ['/manifest.webmanifest', 'asset'],
    ['/icons/icon-192.png', 'asset'],
    ['/', 'page'],
    ['/cameras', 'page'],
    ['/camera-events/1700000000.123456-abc', 'page'],
  ])('classifies %s as %s', async (path, kind) => {
    const reader = start()
    await withRequestMetrics(ok())(req(path))
    const points = await durationPoints(reader)
    expect(points[0]?.attributes['request.kind']).toBe(kind)
  })

  it.each([
    [200, '2xx', 'GET'],
    [304, '3xx', 'GET'],
    [404, '4xx', 'POST'],
    [503, '5xx', 'POST'],
  ])('records status %i as %s (%s)', async (status, cls, method) => {
    const reader = start()
    await withRequestMetrics(ok(status))(req('/api/x', method))
    const [point] = await durationPoints(reader)
    expect(point?.attributes['http.response.status_class']).toBe(cls)
    expect(point?.attributes['http.request.method']).toBe(method)
  })

  it('uses second-scale semconv histogram buckets', async () => {
    const reader = start()
    await withRequestMetrics(ok(200))(req('/api/x', 'GET'))
    const [point] = await durationPoints(reader)
    expect(point?.value).toMatchObject({
      buckets: {
        boundaries: [
          0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5,
          10,
        ],
      },
    })
  })

  it('records an unknown method as _OTHER', async () => {
    const reader = start()
    await withRequestMetrics(ok(200))(req('/api/x', 'PROPFIND'))
    const [point] = await durationPoints(reader)
    expect(point?.attributes['http.request.method']).toBe('_OTHER')
  })

  it('re-throws handler errors and records 5xx', async () => {
    const reader = start()
    const boom = new Error('boom')
    const wrapped = withRequestMetrics(async () => {
      throw boom
    })
    await expect(wrapped(req('/api/x'))).rejects.toBe(boom)
    const [point] = await durationPoints(reader)
    expect(point?.attributes['http.response.status_class']).toBe('5xx')
  })

  it('exports positive memory gauges', async () => {
    const { metric } = await collect(start())
    for (const name of ['process.memory.rss', 'process.memory.heap_used']) {
      const value = metric(name)?.dataPoints[0]?.value as number
      expect(value).toBeGreaterThan(0)
    }
  })

  it('exports process.cpu.time as a monotonic sum by cpu.mode', async () => {
    const { metric } = await collect(start())
    const cpu = metric('process.cpu.time')
    expect(cpu?.dataPointType).toBe(DataPointType.SUM)
    expect(cpu).toMatchObject({ isMonotonic: true })
    expect(cpu?.descriptor.unit).toBe('s')
    const points = cpu?.dataPoints ?? []
    expect(points.map((p) => p.attributes['cpu.mode']).sort()).toEqual([
      'system',
      'user',
    ])
    for (const p of points) expect(p.value as number).toBeGreaterThanOrEqual(0)
  })

  it('takes the resource from OTEL_* env vars', async () => {
    vi.stubEnv('OTEL_SERVICE_NAME', 'camera-events-v2')
    vi.stubEnv(
      'OTEL_RESOURCE_ATTRIBUTES',
      'service.instance.id=test,deployment.environment.name=test',
    )
    const { resource } = await collect(start())
    expect(resource.attributes['service.name']).toBe('camera-events-v2')
    expect(resource.attributes['service.instance.id']).toBe('test')
  })

  it('ignores a second startMetrics call', async () => {
    const reader = start()
    startMetrics(start())
    await withRequestMetrics(ok())(req('/api/x'))
    const points = await durationPoints(reader)
    expect(points).toHaveLength(1)
    expect(points[0]?.value).toMatchObject({ count: 1 })
  })

  it('never records path-like attributes', async () => {
    const reader = start()
    await withRequestMetrics(ok())(req('/api/events/123?token=s'))
    const [point] = await durationPoints(reader)
    expect(Object.keys(point?.attributes ?? {}).sort()).toEqual([
      'http.request.method',
      'http.response.status_class',
      'request.kind',
    ])
  })
})

describe('recordMqttMessage', () => {
  it.each([
    ['frigate/events', 'frigate/events'],
    ['frigate/reviews', 'frigate/reviews'],
    ['frigate/stats', 'frigate/stats'],
    ['frigate/available', 'frigate/available'],
    ['frigate/front/person', 'other'],
  ])('counts %s as topic %s', async (topic, expected) => {
    const reader = start()
    recordMqttMessage(topic)
    recordMqttMessage(topic)
    const { metric } = await collect(reader)
    const [point] = metric('mqtt.messages')?.dataPoints ?? []
    expect(point).toMatchObject({ attributes: { topic: expected }, value: 2 })
  })

  it('is a no-op before metrics start', () => {
    expect(() => recordMqttMessage('frigate/events')).not.toThrow()
  })
})

describe('observeMqttConnection', () => {
  it.each([
    [true, 1],
    [false, 0],
  ])('reports connected=%s as %i', async (connected, value) => {
    observeMqttConnection(() => connected)
    const reader = start()
    const { metric } = await collect(reader)
    expect(metric('mqtt.connected')?.dataPoints[0]?.value).toBe(value)
  })

  it('reports 0 when no connection getter was registered', async () => {
    const reader = start()
    const { metric } = await collect(reader)
    expect(metric('mqtt.connected')?.dataPoints[0]?.value).toBe(0)
  })
})

describe('recordPushSend', () => {
  it('counts sends by kind and outcome', async () => {
    const reader = start()
    recordPushSend('motion', 'ok')
    recordPushSend('motion', 'ok')
    recordPushSend('share', 'failed')
    const { metric } = await collect(reader)
    const points = metric('push.sends')?.dataPoints ?? []
    expect(points.map((p) => [p.attributes, p.value])).toEqual(
      expect.arrayContaining([
        [{ kind: 'motion', outcome: 'ok' }, 2],
        [{ kind: 'share', outcome: 'failed' }, 1],
      ]),
    )
    expect(points).toHaveLength(2)
  })

  it('is a no-op before metrics start', () => {
    expect(() => recordPushSend('availability', 'expired')).not.toThrow()
  })
})
