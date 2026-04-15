/**
 * Integration tests: MQTT message → cache invalidation → fresh Frigate fetch.
 *
 * These tests use the real cache and handler implementations, only mocking
 * external boundaries (globalThis.fetch for Frigate HTTP, mqtt.connect for
 * the MQTT broker). They verify the full wiring stays intact so a change
 * to any link in the chain (mqtt → handler → cache → client) is caught.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { frigateCache, clearFrigateCache } from './frigate/cache'

// Ensure mock mode is off for integration tests
const _savedFrigateMock = process.env.FRIGATE_MOCK
beforeEach(() => { delete process.env.FRIGATE_MOCK })
afterEach(() => {
  if (_savedFrigateMock === undefined) delete process.env.FRIGATE_MOCK
  else process.env.FRIGATE_MOCK = _savedFrigateMock
})

const FRIGATE_URL = 'http://frigate.local:5000'

// --- Mock only the mqtt transport layer ---
const mockSubscribe = vi.fn()
const mockEnd = vi.fn()
const handlers = new Map<string, (...args: unknown[]) => void>()

const mockClient = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    handlers.set(event, handler)
    return mockClient
  }),
  subscribe: mockSubscribe,
  end: mockEnd,
}

vi.mock('mqtt', () => ({
  default: {
    connect: vi.fn(() => mockClient),
  },
}))

// --- Helpers ---

function mockFetchJson(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

/** Simulate the MQTT broker delivering a message to the client. */
function deliverMqttMessage(topic: string, payload: string) {
  const messageHandler = handlers.get('message')
  if (!messageHandler) throw new Error('No message handler registered on MQTT client')
  messageHandler(topic, Buffer.from(payload))
}

/** Simulate the MQTT broker confirming connection. */
function simulateMqttConnect() {
  const connectHandler = handlers.get('connect')
  if (!connectHandler) throw new Error('No connect handler registered on MQTT client')
  connectHandler()
}

describe('MQTT → cache invalidation → fresh fetch (integration)', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.FRIGATE_URL
  const originalMqttUrl = process.env.MQTT_URL

  beforeEach(() => {
    clearFrigateCache()
    handlers.clear()
    mockSubscribe.mockReset()
    mockClient.on.mockClear()
    process.env.FRIGATE_URL = FRIGATE_URL
    process.env.MQTT_URL = 'mqtt://test:test@localhost:1883'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearFrigateCache()
    if (originalEnv === undefined) delete process.env.FRIGATE_URL
    else process.env.FRIGATE_URL = originalEnv
    if (originalMqttUrl === undefined) delete process.env.MQTT_URL
    else process.env.MQTT_URL = originalMqttUrl
  })

  it('cached response is served until MQTT message arrives, then fetch is called again', async () => {
    // 1. Set up Frigate fetch mock — returns different data on each call
    const firstResponse = [{ id: 'event-1', label: 'person' }]
    const secondResponse = [{ id: 'event-2', label: 'car' }]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(firstResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(secondResponse),
      })
    globalThis.fetch = fetchMock

    // 2. Import real modules (handler, client)
    const { startMqttSubscriber } = await import('./mqtt')
    const { getEvents } = await import('./frigate/client')

    // 3. Start the MQTT subscriber (uses real handler wiring)
    startMqttSubscriber()
    simulateMqttConnect()

    // 4. First API call — cache miss → hits Frigate
    const result1 = await getEvents()
    expect(result1.ok).toBe(true)
    if (result1.ok) expect(result1.data).toEqual(firstResponse)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 5. Second API call — cache hit → no fetch
    const result2 = await getEvents()
    expect(result2.ok).toBe(true)
    if (result2.ok) expect(result2.data).toEqual(firstResponse) // same cached data
    expect(fetchMock).toHaveBeenCalledTimes(1) // still only 1 fetch

    // 6. MQTT message arrives on frigate/events
    deliverMqttMessage('frigate/events', JSON.stringify({ type: 'new' }))

    // 7. Cache should be cleared — next call hits Frigate again
    expect(frigateCache.size).toBe(0)
    const result3 = await getEvents()
    expect(result3.ok).toBe(true)
    if (result3.ok) expect(result3.data).toEqual(secondResponse) // fresh data
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('frigate/reviews topic also invalidates the cache', async () => {
    const fetchMock = mockFetchJson([{ id: 'event-1' }])
    globalThis.fetch = fetchMock

    const { startMqttSubscriber } = await import('./mqtt')
    const { getEvents } = await import('./frigate/client')

    startMqttSubscriber()
    simulateMqttConnect()

    // Populate cache
    await getEvents()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // MQTT message on reviews topic
    deliverMqttMessage('frigate/reviews', '{}')
    expect(frigateCache.size).toBe(0)

    // Next call must fetch again
    await getEvents()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('multiple rapid MQTT messages do not cause errors', async () => {
    const fetchMock = mockFetchJson([])
    globalThis.fetch = fetchMock

    const { startMqttSubscriber } = await import('./mqtt')
    const { getEvents } = await import('./frigate/client')

    startMqttSubscriber()
    simulateMqttConnect()

    await getEvents()

    // Rapid-fire MQTT messages (simulates burst of Frigate events)
    for (let i = 0; i < 10; i++) {
      deliverMqttMessage('frigate/events', `{"seq":${i}}`)
    }

    // Cache is cleared, no errors thrown
    expect(frigateCache.size).toBe(0)

    // Fetch still works after the burst
    const result = await getEvents()
    expect(result.ok).toBe(true)
  })

  it('cache invalidation does not affect concurrent in-flight requests', async () => {
    // Simulate a slow Frigate response
    let resolveSlowFetch: (value: unknown) => void
    const slowPromise = new Promise((resolve) => {
      resolveSlowFetch = resolve
    })

    const fetchMock = vi.fn()
      .mockReturnValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: 'fast' }]),
      })
      .mockReturnValueOnce({
        ok: true,
        status: 200,
        json: () => slowPromise,
      })

    globalThis.fetch = fetchMock

    const { startMqttSubscriber } = await import('./mqtt')
    const { getEvents } = await import('./frigate/client')

    startMqttSubscriber()
    simulateMqttConnect()

    // First call populates cache
    await getEvents()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // MQTT clears cache
    deliverMqttMessage('frigate/events', '{}')

    // Start a new fetch (in-flight)
    const inFlightPromise = getEvents()

    // Another MQTT message arrives while fetch is in-flight
    deliverMqttMessage('frigate/events', '{}')

    // Resolve the slow fetch
    resolveSlowFetch!([{ id: 'slow-result' }])
    const result = await inFlightPromise
    expect(result.ok).toBe(true)
  })

  it('handler is the same function wired to MQTT client on(message)', async () => {
    const { startMqttSubscriber, onFrigateMessage } = await import('./mqtt')

    startMqttSubscriber()

    // Verify the message handler registered on the mock client IS onFrigateMessage
    const messageHandler = handlers.get('message')
    expect(messageHandler).toBe(onFrigateMessage)
  })
})
