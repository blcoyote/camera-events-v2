import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'
import { notifyUsersForCamera } from './push-notify'
import { notifyUsersForCameraAvailability } from './availability-notify'
import { log } from '#/features/shared/server/log'
import type { DetectionInfo } from './event-batcher'

vi.mock('#/features/shared/server/log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('mqtt', () => {
  const mockClient = {
    on: vi.fn(),
    subscribe: vi.fn(),
    end: vi.fn(),
  }
  return {
    default: {
      connect: vi.fn(() => mockClient),
    },
    __mockClient: mockClient,
  }
})

vi.mock('./push-notify', () => ({
  notifyUsersForCamera: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./availability-notify', () => ({
  notifyUsersForCameraAvailability: vi.fn().mockResolvedValue(undefined),
}))

async function getMockClient() {
  const mod = await import('mqtt')

  return (mod as any).__mockClient
}

describe('SUBSCRIBED_TOPICS', () => {
  it('contains frigate/events, frigate/reviews, frigate/stats, and frigate/available', async () => {
    const { SUBSCRIBED_TOPICS } = await import('./mqtt')
    expect(SUBSCRIBED_TOPICS).toContain('frigate/events')
    expect(SUBSCRIBED_TOPICS).toContain('frigate/reviews')
    expect(SUBSCRIBED_TOPICS).toContain('frigate/stats')
    expect(SUBSCRIBED_TOPICS).toContain('frigate/available')
    expect(SUBSCRIBED_TOPICS).toHaveLength(4)
  })
})

describe('onFrigateMessage', () => {
  beforeEach(() => {
    clearFrigateCache()
  })

  it('clears the Frigate cache when called with frigate/events', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } = await import(
      '#/features/shared/server/frigate/cache'
    )

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage('frigate/events', Buffer.from('{}'))
    expect(frigateCache.size).toBe(0)
  })

  it('clears the Frigate cache when called with frigate/reviews', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } = await import(
      '#/features/shared/server/frigate/cache'
    )

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage('frigate/reviews', Buffer.from('{}'))
    expect(frigateCache.size).toBe(0)
  })

  it('logs "New detection" when a valid new detection is received', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    onFrigateMessage(
      'frigate/events',
      Buffer.from(
        JSON.stringify({
          type: 'new',
          after: {
            id: 'x',
            camera: 'front_porch',
            label: 'person',
            start_time: 1713182400,
          },
        }),
      ),
    )

    expect(log.info).toHaveBeenCalledWith(
      'mqtt',
      'New detection',
      expect.objectContaining({ event_id: 'x' }),
    )
  })

  it('logs "Ignored" when the message is not a "new" event', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    onFrigateMessage(
      'frigate/events',
      Buffer.from(
        JSON.stringify({
          type: 'update',
          after: {
            id: 'x',
            camera: 'front_porch',
            label: 'person',
            start_time: 1713182400,
          },
        }),
      ),
    )

    expect(log.debug).toHaveBeenCalledWith(
      'mqtt',
      expect.stringContaining('Ignored'),
      expect.anything(),
    )
  })

  it('does not clear the Frigate cache for frigate/stats', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } = await import(
      '#/features/shared/server/frigate/cache'
    )

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage(
      'frigate/stats',
      Buffer.from(JSON.stringify({ cameras: {} })),
    )
    expect(frigateCache.size).toBe(1)
  })

  it('does not clear the Frigate cache for frigate/available', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } = await import(
      '#/features/shared/server/frigate/cache'
    )

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage('frigate/available', Buffer.from('online'))
    expect(frigateCache.size).toBe(1)
  })

  it('logs "Ignored" for a malformed frigate/stats payload', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    expect(() =>
      onFrigateMessage('frigate/stats', Buffer.from('not json')),
    ).not.toThrow()

    expect(log.debug).toHaveBeenCalledWith(
      'mqtt',
      expect.stringContaining('Ignored'),
      expect.anything(),
    )
  })

  it('logs "Ignored" for an unexpected frigate/available payload', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    expect(() =>
      onFrigateMessage('frigate/available', Buffer.from('unknown')),
    ).not.toThrow()

    expect(log.debug).toHaveBeenCalledWith(
      'mqtt',
      expect.stringContaining('Ignored'),
      expect.anything(),
    )
  })
})

describe('onFrigateMessage — availability tracker wiring', () => {
  const notifyAvailabilityMock = vi.mocked(notifyUsersForCameraAvailability)

  beforeEach(async () => {
    notifyAvailabilityMock.mockClear()
    const { _resetAvailabilityTracker } = await import('./mqtt')
    _resetAvailabilityTracker()
  })

  function statsPayload(camera: string, cameraFps: number): Buffer {
    return Buffer.from(
      JSON.stringify({ cameras: { [camera]: { camera_fps: cameraFps } } }),
    )
  }

  it('flags a camera offline only once the default threshold of zero-fps readings is reached', async () => {
    const { onFrigateMessage } = await import('./mqtt')

    for (let i = 0; i < 9; i++) {
      onFrigateMessage('frigate/stats', statsPayload('front_porch', 0))
    }
    expect(notifyAvailabilityMock).not.toHaveBeenCalled()

    onFrigateMessage('frigate/stats', statsPayload('front_porch', 0))
    expect(notifyAvailabilityMock).toHaveBeenCalledTimes(1)
    expect(notifyAvailabilityMock).toHaveBeenCalledWith(
      'front_porch',
      'offline',
    )
  })

  it('flags a camera back online once fps recovers', async () => {
    const { onFrigateMessage } = await import('./mqtt')

    for (let i = 0; i < 10; i++) {
      onFrigateMessage('frigate/stats', statsPayload('front_porch', 0))
    }
    notifyAvailabilityMock.mockClear()

    onFrigateMessage('frigate/stats', statsPayload('front_porch', 5))
    expect(notifyAvailabilityMock).toHaveBeenCalledWith('front_porch', 'online')
  })

  it('flags every known camera offline immediately on frigate/available "offline" (not debounced)', async () => {
    const { onFrigateMessage } = await import('./mqtt')

    onFrigateMessage('frigate/stats', statsPayload('front_porch', 5))
    notifyAvailabilityMock.mockClear()

    onFrigateMessage('frigate/available', Buffer.from('offline'))
    expect(notifyAvailabilityMock).toHaveBeenCalledWith(
      'front_porch',
      'offline',
    )
  })
})

describe('dispatchBatch', () => {
  const notifyMock = vi.mocked(notifyUsersForCamera)

  beforeEach(() => {
    notifyMock.mockClear()
  })

  it('logs the flush and dispatches push notifications', async () => {
    const { dispatchBatch } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    const events: DetectionInfo[] = [
      {
        id: '1',
        camera: 'front_porch',
        label: 'person',
        startTime: 1,
        hasSnapshot: true,
        hasClip: false,
      },
      {
        id: '2',
        camera: 'front_porch',
        label: 'car',
        startTime: 2,
        hasSnapshot: true,
        hasClip: false,
      },
    ]

    dispatchBatch('front_porch', events, { burstStart: true })

    expect(log.info).toHaveBeenCalledWith('mqtt', 'Flushing detection batch', {
      camera: 'front_porch',
      count: 2,
      burst_start: true,
    })
    expect(notifyMock).toHaveBeenCalledWith('front_porch', events, {
      burstStart: true,
    })
  })

  it('forwards a continuation flush so the dispatcher patches instead of alerting', async () => {
    const { dispatchBatch } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    const events: DetectionInfo[] = [
      {
        id: '3',
        camera: 'driveway',
        label: 'person',
        startTime: 3,
        hasSnapshot: true,
        hasClip: false,
      },
    ]

    dispatchBatch('driveway', events, { burstStart: false })

    expect(notifyMock).toHaveBeenCalledWith('driveway', events, {
      burstStart: false,
    })
  })
})

describe('dispatchAvailability', () => {
  const notifyAvailabilityMock = vi.mocked(notifyUsersForCameraAvailability)

  beforeEach(() => {
    notifyAvailabilityMock.mockClear()
  })

  it('logs the transition and dispatches an availability push notification', async () => {
    const { dispatchAvailability } = await import('./mqtt')
    vi.mocked(log.info).mockClear()
    vi.mocked(log.debug).mockClear()

    dispatchAvailability('driveway', 'offline')

    expect(log.info).toHaveBeenCalledWith(
      'mqtt',
      'Camera availability changed',
      {
        camera: 'driveway',
        status: 'offline',
      },
    )
    expect(notifyAvailabilityMock).toHaveBeenCalledWith('driveway', 'offline')
  })
})

describe('parseFrigateEvent', () => {
  function makePayload(obj: unknown): Buffer {
    return Buffer.from(JSON.stringify(obj))
  }

  it('parses a valid "new" event', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    const result = parseFrigateEvent(
      makePayload({
        type: 'new',
        before: {},
        after: {
          id: '1713182400.123-abc',
          camera: 'front_porch',
          label: 'person',
          start_time: 1713182400.123,
          score: 0.87,
          zones: ['yard'],
          has_snapshot: true,
          has_clip: false,
        },
      }),
    )
    expect(result).toEqual({
      id: '1713182400.123-abc',
      camera: 'front_porch',
      label: 'person',
      startTime: 1713182400.123,
      hasSnapshot: true,
      hasClip: false,
    })
  })

  it('carries has_clip through when Frigate is retaining a recording', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    const result = parseFrigateEvent(
      makePayload({
        type: 'new',
        after: {
          id: 'x',
          camera: 'c',
          label: 'person',
          start_time: 1,
          has_snapshot: false,
          has_clip: true,
        },
      }),
    )
    expect(result).toMatchObject({ hasSnapshot: false, hasClip: true })
  })

  it('defaults both persistence flags to false when Frigate omits them', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    const result = parseFrigateEvent(
      makePayload({
        type: 'new',
        after: { id: 'x', camera: 'c', label: 'person', start_time: 1 },
      }),
    )
    expect(result).toMatchObject({ hasSnapshot: false, hasClip: false })
  })

  it('returns null for "update" events', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    const result = parseFrigateEvent(
      makePayload({
        type: 'update',
        after: { id: 'x', camera: 'c', label: 'person', start_time: 1 },
      }),
    )
    expect(result).toBeNull()
  })

  it('returns null for "end" events', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    const result = parseFrigateEvent(
      makePayload({
        type: 'end',
        after: { id: 'x', camera: 'c', label: 'person', start_time: 1 },
      }),
    )
    expect(result).toBeNull()
  })

  it('returns null for invalid JSON', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    expect(parseFrigateEvent(Buffer.from('not json'))).toBeNull()
  })

  it('returns null when after is missing', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    expect(parseFrigateEvent(makePayload({ type: 'new' }))).toBeNull()
  })

  it('returns null when required fields are missing', async () => {
    const { parseFrigateEvent } = await import('./mqtt')
    // Missing id
    expect(
      parseFrigateEvent(
        makePayload({
          type: 'new',
          after: { camera: 'c', label: 'person', start_time: 1 },
        }),
      ),
    ).toBeNull()
    // Missing camera
    expect(
      parseFrigateEvent(
        makePayload({
          type: 'new',
          after: { id: 'x', label: 'person', start_time: 1 },
        }),
      ),
    ).toBeNull()
    // Missing label
    expect(
      parseFrigateEvent(
        makePayload({
          type: 'new',
          after: { id: 'x', camera: 'c', start_time: 1 },
        }),
      ),
    ).toBeNull()
    // Non-numeric start_time
    expect(
      parseFrigateEvent(
        makePayload({
          type: 'new',
          after: { id: 'x', camera: 'c', label: 'person', start_time: 'bad' },
        }),
      ),
    ).toBeNull()
  })
})

describe('startMqttSubscriber', () => {
  const originalMqttUrl = process.env.MQTT_URL
  const originalFrigateMock = process.env.FRIGATE_MOCK

  afterEach(async () => {
    if (originalMqttUrl === undefined) {
      delete process.env.MQTT_URL
    } else {
      process.env.MQTT_URL = originalMqttUrl
    }
    if (originalFrigateMock === undefined) {
      delete process.env.FRIGATE_MOCK
    } else {
      process.env.FRIGATE_MOCK = originalFrigateMock
    }
    const { _resetMqttConnectionState } = await import('./mqtt')
    _resetMqttConnectionState()
  })

  it('returns null when FRIGATE_MOCK is enabled', async () => {
    process.env.FRIGATE_MOCK = 'true'
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    const { startMqttSubscriber } = await import('./mqtt')
    const result = startMqttSubscriber()
    expect(result).toBeNull()
  })

  it('returns null when MQTT_URL is not set', async () => {
    delete process.env.MQTT_URL
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber } = await import('./mqtt')
    const result = startMqttSubscriber()
    expect(result).toBeNull()
  })

  it('connects and subscribes when MQTT_URL is set', async () => {
    delete process.env.FRIGATE_MOCK
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    const mqtt = await import('mqtt')
    const { startMqttSubscriber } = await import('./mqtt')

    const client = startMqttSubscriber()
    expect(client).not.toBeNull()
    expect(mqtt.default.connect).toHaveBeenCalledWith(
      'mqtt://localhost:1883',
      expect.objectContaining({ clean: true }),
    )

    // Simulate 'connect' event to trigger subscription
    const mockClient = await getMockClient()
    const connectHandler = mockClient.on.mock.calls.find(
      (call: [string, (...args: unknown[]) => void]) => call[0] === 'connect',
    )?.[1]
    expect(connectHandler).toBeDefined()
    connectHandler()

    expect(mockClient.subscribe).toHaveBeenCalledWith(
      [
        'frigate/events',
        'frigate/reviews',
        'frigate/stats',
        'frigate/available',
      ],
      expect.any(Function),
    )
  })

  it('wires onFrigateMessage as the message handler', async () => {
    delete process.env.FRIGATE_MOCK
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    const { startMqttSubscriber } = await import('./mqtt')

    startMqttSubscriber()

    const mockClient = await getMockClient()
    const messageHandler = mockClient.on.mock.calls.find(
      (call: [string, (...args: unknown[]) => void]) => call[0] === 'message',
    )
    expect(messageHandler).toBeDefined()
    expect(messageHandler[0]).toBe('message')
  })
})

describe('getMqttConnectionState', () => {
  const originalMqttUrl = process.env.MQTT_URL
  const originalFrigateMock = process.env.FRIGATE_MOCK

  afterEach(async () => {
    if (originalMqttUrl === undefined) delete process.env.MQTT_URL
    else process.env.MQTT_URL = originalMqttUrl
    if (originalFrigateMock === undefined) delete process.env.FRIGATE_MOCK
    else process.env.FRIGATE_MOCK = originalFrigateMock
    const { _resetMqttConnectionState } = await import('./mqtt')
    _resetMqttConnectionState()
  })

  it('returns not_configured before startMqttSubscriber is called', async () => {
    const { getMqttConnectionState } = await import('./mqtt')
    expect(getMqttConnectionState()).toBe('not_configured')
  })

  it('returns not_configured when MQTT_URL is absent', async () => {
    delete process.env.MQTT_URL
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber, getMqttConnectionState } = await import(
      './mqtt'
    )
    startMqttSubscriber()
    expect(getMqttConnectionState()).toBe('not_configured')
  })

  it('returns not_configured when FRIGATE_MOCK is enabled', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    process.env.FRIGATE_MOCK = 'true'
    const { startMqttSubscriber, getMqttConnectionState } = await import(
      './mqtt'
    )
    startMqttSubscriber()
    expect(getMqttConnectionState()).toBe('not_configured')
  })

  it('returns disconnected after startMqttSubscriber connects but before broker acks', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber, getMqttConnectionState } = await import(
      './mqtt'
    )
    startMqttSubscriber()
    expect(getMqttConnectionState()).toBe('disconnected')
  })

  it('returns connected after the connect event fires', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber, getMqttConnectionState } = await import(
      './mqtt'
    )
    startMqttSubscriber()

    const mockClient = await getMockClient()
    const connectHandler = mockClient.on.mock.calls.find(
      (call: [string, (...args: unknown[]) => void]) => call[0] === 'connect',
    )?.[1]
    connectHandler()

    expect(getMqttConnectionState()).toBe('connected')
  })

  it('returns disconnected after the close event fires', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber, getMqttConnectionState } = await import(
      './mqtt'
    )
    startMqttSubscriber()

    const mockClient = await getMockClient()
    const connectHandler = mockClient.on.mock.calls.find(
      (call: [string, (...args: unknown[]) => void]) => call[0] === 'connect',
    )?.[1]
    connectHandler()
    expect(getMqttConnectionState()).toBe('connected')

    const closeHandler = mockClient.on.mock.calls.find(
      (call: [string, (...args: unknown[]) => void]) => call[0] === 'close',
    )?.[1]
    closeHandler()
    expect(getMqttConnectionState()).toBe('disconnected')
  })
})

describe('mqtt metrics', () => {
  afterEach(async () => {
    const { _resetMetricsForTests } = await import(
      '#/features/shared/server/metrics'
    )
    await _resetMetricsForTests()
    vi.resetModules()
  })

  async function collect(name: string) {
    const { startMetrics } = await import('#/features/shared/server/metrics')
    const exporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE,
    )
    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 60_000,
    })
    startMetrics(reader)
    return async () => {
      const { resourceMetrics } = await reader.collect()
      return resourceMetrics.scopeMetrics
        .flatMap((s) => s.metrics)
        .find((m) => m.descriptor.name === name)
    }
  }

  it.each([
    'frigate/events',
    'frigate/reviews',
    'frigate/stats',
    'frigate/available',
  ])('counts a %s message by topic (even if ignored)', async (topic) => {
    const read = await collect('mqtt.messages')
    const { onFrigateMessage } = await import('./mqtt')
    onFrigateMessage(topic, Buffer.from('not json'))
    const metric = await read()
    const point = metric?.dataPoints.find(
      (p) => p.attributes['topic'] === topic,
    )
    expect(point?.value).toBe(1)
  })

  it('reports mqtt.connected 0 by default and 1 once connected', async () => {
    // resetModules: _resetMetricsForTests cleared the module-level getter
    vi.resetModules()
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    delete process.env.FRIGATE_MOCK
    const read = await collect('mqtt.connected')
    expect((await read())?.dataPoints[0]?.value).toBe(0)

    const { startMqttSubscriber } = await import('./mqtt')
    startMqttSubscriber()
    const mockClient = await getMockClient()
    const connectHandler = mockClient.on.mock.calls
      .filter((c: [string, unknown]) => c[0] === 'connect')
      .at(-1)[1]
    connectHandler()
    expect((await read())?.dataPoints[0]?.value).toBe(1)
  })
})

describe('pipeline spans', () => {
  const notifyMock = vi.mocked(notifyUsersForCamera)
  let exporter: InMemorySpanExporter
  let tracing: typeof import('#/features/shared/server/tracing')

  beforeEach(async () => {
    // Earlier suites reset modules; load tracing fresh so ./mqtt shares this copy.
    vi.resetModules()
    tracing = await import('#/features/shared/server/tracing')
    exporter = new InMemorySpanExporter()
    tracing.startTracing(new SimpleSpanProcessor({ exporter }))
  })
  afterEach(async () => {
    await tracing._resetTracingForTests()
  })

  const newEvent = (id: string) =>
    Buffer.from(
      JSON.stringify({
        type: 'new',
        after: {
          id,
          camera: 'front_porch',
          label: 'person',
          start_time: 1,
        },
      }),
    )

  it('frigate/events new event: consumer span, outcome batched', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    onFrigateMessage('frigate/events', newEvent('e1'))
    const [span, ...rest] = exporter.getFinishedSpans()
    expect(rest).toHaveLength(0)
    expect(span.name).toBe('mqtt frigate/events')
    expect(span.kind).toBe(SpanKind.CONSUMER)
    expect(span.attributes).toEqual({
      'frigate.camera': 'front_porch',
      'frigate.event.id': 'e1',
      'frigate.label': 'person',
      'mqtt.outcome': 'batched',
    })
  })

  it('frigate/events malformed or non-new: outcome ignored', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    onFrigateMessage('frigate/events', Buffer.from('nope'))
    onFrigateMessage('frigate/events', Buffer.from('{"type":"update"}'))
    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(2)
    for (const s of spans) expect(s.attributes['mqtt.outcome']).toBe('ignored')
  })

  it('frigate/stats creates no span', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    onFrigateMessage('frigate/stats', Buffer.from('{}'))
    onFrigateMessage('frigate/available', Buffer.from('online'))
    expect(exporter.getFinishedSpans()).toHaveLength(0)
  })

  it('dispatchBatch: push.batch root span, even inside another span', async () => {
    const { dispatchBatch } = await import('./mqtt')
    let sendSpanParent: string | undefined
    notifyMock.mockImplementationOnce(async () => {
      sendSpanParent = trace.getActiveSpan()?.spanContext().spanId
    })
    const ev = (id: string) => ({
      id,
      camera: 'front_porch',
      label: 'person',
      startTime: 1,
      hasSnapshot: false,
      hasClip: false,
    })
    await tracing.withSpan('outer', {}, async () => {
      dispatchBatch('front_porch', [ev('1'), ev('2')], { burstStart: true })
    })
    await new Promise((r) => setTimeout(r, 0))
    const batch = exporter
      .getFinishedSpans()
      .find((s) => s.name === 'push.batch')!
    const outer = exporter.getFinishedSpans().find((s) => s.name === 'outer')!
    expect(batch.kind).toBe(SpanKind.INTERNAL)
    expect(batch.parentSpanContext).toBeUndefined()
    expect(batch.spanContext().traceId).not.toBe(outer.spanContext().traceId)
    expect(batch.attributes).toEqual({
      'frigate.camera': 'front_porch',
      'frigate.event.ids': ['1', '2'],
      'push.burst_start': true,
    })
    expect(sendSpanParent).toBe(batch.spanContext().spanId)
  })

  it('dispatchBatch logs flush and failure inside push.batch, marking it ERROR', async () => {
    const { dispatchBatch } = await import('./mqtt')
    const { log: freshLog } = await import('#/features/shared/server/log')
    const seen: Record<string, string | undefined> = {}
    vi.mocked(freshLog.info).mockImplementation((_c, msg) => {
      seen[msg] = trace.getActiveSpan()?.spanContext().spanId
    })
    vi.mocked(freshLog.error).mockImplementation((_c, msg) => {
      seen[msg] = trace.getActiveSpan()?.spanContext().spanId
      trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR })
    })
    notifyMock.mockRejectedValueOnce(new Error('boom'))
    dispatchBatch('front_porch', [], { burstStart: false })
    await new Promise((r) => setTimeout(r, 0))
    const batch = exporter
      .getFinishedSpans()
      .find((s) => s.name === 'push.batch')!
    expect(seen['Flushing detection batch']).toBe(batch.spanContext().spanId)
    expect(seen['Push notification dispatch failed']).toBe(
      batch.spanContext().spanId,
    )
    expect(batch.status.code).toBe(SpanStatusCode.ERROR)
  })

  it('dispatchAvailability logs transition and failure inside push.availability', async () => {
    const { dispatchAvailability } = await import('./mqtt')
    const { log: freshLog } = await import('#/features/shared/server/log')
    const seen: Record<string, string | undefined> = {}
    const capture = (_c: string, msg: string) => {
      seen[msg] = trace.getActiveSpan()?.spanContext().spanId
    }
    vi.mocked(freshLog.info).mockImplementation(capture)
    vi.mocked(freshLog.error).mockImplementation(capture)
    vi.mocked(notifyUsersForCameraAvailability).mockRejectedValueOnce(
      new Error('boom'),
    )
    dispatchAvailability('driveway', 'offline')
    await new Promise((r) => setTimeout(r, 0))
    const [span] = exporter.getFinishedSpans()
    expect(seen['Camera availability changed']).toBe(span.spanContext().spanId)
    expect(seen['Availability push dispatch failed']).toBe(
      span.spanContext().spanId,
    )
  })

  it('dispatchAvailability: push.availability root span', async () => {
    const { dispatchAvailability } = await import('./mqtt')
    dispatchAvailability('driveway', 'offline')
    await new Promise((r) => setTimeout(r, 0))
    const [span] = exporter.getFinishedSpans()
    expect(span.name).toBe('push.availability')
    expect(span.parentSpanContext).toBeUndefined()
    expect(span.attributes).toEqual({
      'frigate.camera': 'driveway',
      'camera.status': 'offline',
    })
  })
})
