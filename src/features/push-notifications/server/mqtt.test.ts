import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'
import { notifyUsersForCamera } from './push-notify'
import { notifyUsersForCameraAvailability } from './availability-notify'
import { waitForPersistedEvent } from './event-verify'
import type { DetectionInfo } from './event-batcher'
import type { FrigateReviewMessage } from './review-alert'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

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

vi.mock('./event-verify', () => ({
  waitForPersistedEvent: vi.fn(),
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

    expect(
      logSpy.mock.calls.some(
        (call) =>
          String(call[0]).includes('front_porch') &&
          String(call[0]).includes('2 detection(s)'),
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

describe('frigate/events no longer notifies', () => {
  const notifyMock = vi.mocked(notifyUsersForCamera)

  beforeEach(() => {
    vi.useFakeTimers()
    notifyMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears the cache but never dispatches a notification for a "new" event', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const { frigateCache } =
      await import('#/features/shared/server/frigate/cache')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    frigateCache.set('k', { ok: true, data: 'cached' })

    onFrigateMessage(
      'frigate/events',
      Buffer.from(
        JSON.stringify({
          type: 'new',
          after: {
            id: 'x',
            camera: 'events_only_cam',
            label: 'person',
            start_time: 1713182400,
          },
        }),
      ),
    )
    await vi.advanceTimersByTimeAsync(60_000)

    expect(frigateCache.size).toBe(0)
    expect(notifyMock).not.toHaveBeenCalled()
    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('Ignored')),
    ).toBe(false)
    logSpy.mockRestore()
  })
})

function makeReviewPayload(
  overrides: {
    type?: string
    id?: string
    camera?: string
    severity?: string
    detections?: string[]
  } = {},
): Buffer {
  const {
    type = 'new',
    id = 'review-1',
    camera = 'front_porch',
    severity = 'alert',
    detections = ['1713182400.123-abc'],
  } = overrides
  return Buffer.from(
    JSON.stringify({
      type,
      before: {},
      after: { id, camera, severity, data: { detections } },
    }),
  )
}

function makeFrigateEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1713182400.123-abc',
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
    start_time: 1713182400.123,
    end_time: 1713182460,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: true,
    has_snapshot: true,
    retain_indefinitely: false,
    plus_id: null,
    box: null,
    top_score: 0.9,
    data: {
      attributes: [],
      box: [0, 0, 0, 0],
      region: [0, 0, 0, 0],
      score: 0.9,
      top_score: 0.9,
      type: 'object',
    },
    ...overrides,
  }
}

describe('handleReviewAlert', () => {
  const notifyMock = vi.mocked(notifyUsersForCamera)
  const verifyMock = vi.mocked(waitForPersistedEvent)

  beforeEach(async () => {
    notifyMock.mockClear()
    verifyMock.mockReset()
    const { _resetReviewGate } = await import('./mqtt')
    _resetReviewGate()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const msg: FrigateReviewMessage = {
    type: 'new',
    reviewId: 'review-1',
    camera: 'handle_cam_ok',
    severity: 'alert',
    detections: ['1713182400.123-abc'],
  }

  it('feeds the verified event into the batcher using the review camera', async () => {
    const { handleReviewAlert } = await import('./mqtt')
    const verify = vi.fn().mockResolvedValue(
      makeFrigateEvent({
        camera: 'other_cam',
        label: 'dog',
        has_clip: false,
        has_snapshot: true,
      }),
    )

    await handleReviewAlert(msg, verify)

    expect(verify).toHaveBeenCalledWith(msg.detections)
    expect(notifyMock).toHaveBeenCalledWith(
      'handle_cam_ok',
      [
        {
          id: '1713182400.123-abc',
          camera: 'handle_cam_ok',
          label: 'dog',
          startTime: 1713182400.123,
          hasSnapshot: true,
          hasClip: false,
        },
      ],
      { burstStart: true },
    )
  })

  it('does not notify and logs a skip when no saved event is found', async () => {
    const { handleReviewAlert } = await import('./mqtt')
    const logSpy = vi.mocked(console.log)

    await handleReviewAlert(
      { ...msg, camera: 'handle_cam_null' },
      vi.fn().mockResolvedValue(null),
    )

    expect(notifyMock).not.toHaveBeenCalled()
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0]).includes('alert skipped — no saved event'),
      ),
    ).toBe(true)
  })

  it('does not notify and does not reject when verification throws', async () => {
    const { handleReviewAlert } = await import('./mqtt')

    await expect(
      handleReviewAlert(
        { ...msg, camera: 'handle_cam_throw' },
        vi.fn().mockRejectedValue(new Error('boom')),
      ),
    ).resolves.toBeUndefined()

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('releases the review on failure so a later alert update can retry', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    verifyMock.mockResolvedValue(null)
    const payload = makeReviewPayload({
      id: 'retry-review',
      camera: 'retry_cam',
    })

    onFrigateMessage('frigate/reviews', payload)
    await vi.waitFor(() => expect(verifyMock).toHaveBeenCalledTimes(1))
    // allow handleReviewAlert to finish and release
    await new Promise((r) => setTimeout(r, 0))

    onFrigateMessage('frigate/reviews', payload)
    await vi.waitFor(() => expect(verifyMock).toHaveBeenCalledTimes(2))
  })
})

describe('onFrigateMessage — frigate/reviews wiring', () => {
  const notifyMock = vi.mocked(notifyUsersForCamera)
  const verifyMock = vi.mocked(waitForPersistedEvent)

  beforeEach(async () => {
    notifyMock.mockClear()
    verifyMock.mockReset()
    clearFrigateCache()
    const { _resetReviewGate } = await import('./mqtt')
    _resetReviewGate()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('verifies and notifies for an alert review', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    verifyMock.mockResolvedValue(makeFrigateEvent({ id: 'wired-ev' }))

    onFrigateMessage(
      'frigate/reviews',
      makeReviewPayload({ id: 'wired-1', camera: 'wired_cam' }),
    )

    await vi.waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'wired_cam',
        [expect.objectContaining({ id: 'wired-ev', camera: 'wired_cam' })],
        { burstStart: true },
      ),
    )
    expect(verifyMock).toHaveBeenCalledWith(['1713182400.123-abc'])
  })

  it('verifies only once across repeated alert updates of the same review', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    verifyMock.mockResolvedValue(makeFrigateEvent())

    onFrigateMessage(
      'frigate/reviews',
      makeReviewPayload({ id: 'dup-1', camera: 'dup_cam' }),
    )
    onFrigateMessage(
      'frigate/reviews',
      makeReviewPayload({ type: 'update', id: 'dup-1', camera: 'dup_cam' }),
    )
    onFrigateMessage(
      'frigate/reviews',
      makeReviewPayload({ type: 'update', id: 'dup-1', camera: 'dup_cam' }),
    )
    await new Promise((r) => setTimeout(r, 0))

    expect(verifyMock).toHaveBeenCalledTimes(1)
  })

  it('never verifies a detection-severity review', async () => {
    const { onFrigateMessage } = await import('./mqtt')

    onFrigateMessage(
      'frigate/reviews',
      makeReviewPayload({ id: 'det-1', severity: 'detection' }),
    )
    await new Promise((r) => setTimeout(r, 0))

    expect(verifyMock).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('logs "Ignored" for a malformed payload and does not throw', async () => {
    const { onFrigateMessage } = await import('./mqtt')
    const logSpy = vi.mocked(console.log)

    expect(() =>
      onFrigateMessage('frigate/reviews', Buffer.from('not json')),
    ).not.toThrow()

    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0]).includes(
          '[mqtt] Ignored frigate/reviews message (malformed payload)',
        ),
      ),
    ).toBe(true)
    expect(verifyMock).not.toHaveBeenCalled()
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
