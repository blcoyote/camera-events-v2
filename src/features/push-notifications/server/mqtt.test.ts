import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'

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

async function getMockClient() {
  const mod = await import('mqtt')

  return (mod as any).__mockClient
}

describe('SUBSCRIBED_TOPICS', () => {
  it('contains frigate/events and frigate/reviews', async () => {
    const { SUBSCRIBED_TOPICS } = await import('./mqtt')
    expect(SUBSCRIBED_TOPICS).toContain('frigate/events')
    expect(SUBSCRIBED_TOPICS).toContain('frigate/reviews')
    expect(SUBSCRIBED_TOPICS).toHaveLength(2)
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

  afterEach(() => {
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
      ['frigate/events', 'frigate/reviews'],
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
