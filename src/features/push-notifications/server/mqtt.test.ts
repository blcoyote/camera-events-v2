import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'
import { notifyUsersForCamera } from './push-notify'
import { notifyUsersForCameraAvailability } from './availability-notify'
import type { FrigateEventInfo } from './event-batcher'

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
    const { frigateCache } =
      await import('#/features/shared/server/frigate/cache')

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage('frigate/events', Buffer.from('{}'))
    expect(frigateCache.size).toBe(0)
  })

  it('clears the Frigate cache when called with frigate/reviews', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } =
      await import('#/features/shared/server/frigate/cache')

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage('frigate/reviews', Buffer.from('{}'))
    expect(frigateCache.size).toBe(0)
  })

  it('logs "New event" when a valid new event is received', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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

    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('New event')),
    ).toBe(true)

    logSpy.mockRestore()
  })

  it('logs "Ignored" when the message is not a "new" event', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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

    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('Ignored')),
    ).toBe(true)

    logSpy.mockRestore()
  })

  it('does not clear the Frigate cache for frigate/stats', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } =
      await import('#/features/shared/server/frigate/cache')

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
    const { frigateCache } =
      await import('#/features/shared/server/frigate/cache')

    frigateCache.set('test-key', { ok: true, data: 'cached' })
    expect(frigateCache.size).toBe(1)

    onFrigateMessage('frigate/available', Buffer.from('online'))
    expect(frigateCache.size).toBe(1)
  })

  it('logs "Ignored" for a malformed frigate/stats payload', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(() =>
      onFrigateMessage('frigate/stats', Buffer.from('not json')),
    ).not.toThrow()

    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('Ignored')),
    ).toBe(true)

    logSpy.mockRestore()
  })

  it('logs "Ignored" for an unexpected frigate/available payload', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(() =>
      onFrigateMessage('frigate/available', Buffer.from('unknown')),
    ).not.toThrow()

    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('Ignored')),
    ).toBe(true)

    logSpy.mockRestore()
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
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const events: FrigateEventInfo[] = [
      { id: '1', camera: 'front_porch', label: 'person', startTime: 1 },
      { id: '2', camera: 'front_porch', label: 'car', startTime: 2 },
    ]

    dispatchBatch('front_porch', events, { burstStart: true })

    expect(
      logSpy.mock.calls.some(
        (call) =>
          String(call[0]).includes('front_porch') &&
          String(call[0]).includes('2'),
      ),
    ).toBe(true)
    expect(notifyMock).toHaveBeenCalledWith('front_porch', events, {
      burstStart: true,
    })

    logSpy.mockRestore()
  })

  it('forwards a continuation flush so the dispatcher patches instead of alerting', async () => {
    const { dispatchBatch } = await import('./mqtt')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const events: FrigateEventInfo[] = [
      { id: '3', camera: 'driveway', label: 'person', startTime: 3 },
    ]

    dispatchBatch('driveway', events, { burstStart: false })

    expect(notifyMock).toHaveBeenCalledWith('driveway', events, {
      burstStart: false,
    })

    logSpy.mockRestore()
  })
})

describe('dispatchAvailability', () => {
  const notifyAvailabilityMock = vi.mocked(notifyUsersForCameraAvailability)

  beforeEach(() => {
    notifyAvailabilityMock.mockClear()
  })

  it('logs the transition and dispatches an availability push notification', async () => {
    const { dispatchAvailability } = await import('./mqtt')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    dispatchAvailability('driveway', 'offline')

    expect(
      logSpy.mock.calls.some(
        (call) =>
          String(call[0]).includes('driveway') &&
          String(call[0]).includes('offline'),
      ),
    ).toBe(true)
    expect(notifyAvailabilityMock).toHaveBeenCalledWith('driveway', 'offline')

    logSpy.mockRestore()
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
        },
      }),
    )
    expect(result).toEqual({
      id: '1713182400.123-abc',
      camera: 'front_porch',
      label: 'person',
      startTime: 1713182400.123,
    })
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
    const { startMqttSubscriber, getMqttConnectionState } =
      await import('./mqtt')
    startMqttSubscriber()
    expect(getMqttConnectionState()).toBe('not_configured')
  })

  it('returns not_configured when FRIGATE_MOCK is enabled', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    process.env.FRIGATE_MOCK = 'true'
    const { startMqttSubscriber, getMqttConnectionState } =
      await import('./mqtt')
    startMqttSubscriber()
    expect(getMqttConnectionState()).toBe('not_configured')
  })

  it('returns disconnected after startMqttSubscriber connects but before broker acks', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber, getMqttConnectionState } =
      await import('./mqtt')
    startMqttSubscriber()
    expect(getMqttConnectionState()).toBe('disconnected')
  })

  it('returns connected after the connect event fires', async () => {
    process.env.MQTT_URL = 'mqtt://localhost:1883'
    delete process.env.FRIGATE_MOCK
    const { startMqttSubscriber, getMqttConnectionState } =
      await import('./mqtt')
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
    const { startMqttSubscriber, getMqttConnectionState } =
      await import('./mqtt')
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
