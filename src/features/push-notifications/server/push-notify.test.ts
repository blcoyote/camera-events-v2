import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatCameraName,
  formatLabel,
  formatTime,
  buildCameraPayload,
  cameraNotificationTag,
  notifyUsersForCamera,
  endpointHost,
} from './push-notify'
import type { FrigateEventInfo } from './event-batcher'
import { isPushEnabled, sendPushNotification } from './push'
import { SendThrottle } from './send-throttle'
import { getPushStore } from './push-store'

vi.mock('./push', () => ({
  isPushEnabled: vi.fn(),
  sendPushNotification: vi.fn(),
}))

vi.mock('./push-store', () => ({
  getPushStore: vi.fn(),
}))

function makeEvent(
  overrides: Partial<FrigateEventInfo> = {},
): FrigateEventInfo {
  return {
    id: '1713182400.123-abc',
    camera: 'front_porch',
    label: 'person',
    startTime: 1713182400,
    ...overrides,
  }
}

describe('formatCameraName', () => {
  it('replaces underscores and title-cases', () => {
    expect(formatCameraName('front_porch')).toBe('Front Porch')
  })

  it('handles single-word names', () => {
    expect(formatCameraName('driveway')).toBe('Driveway')
  })

  it('handles names with multiple underscores', () => {
    expect(formatCameraName('back_yard_gate')).toBe('Back Yard Gate')
  })
})

describe('formatLabel', () => {
  it('capitalizes the first letter', () => {
    expect(formatLabel('person')).toBe('Person')
    expect(formatLabel('car')).toBe('Car')
  })

  it('handles already-capitalized labels', () => {
    expect(formatLabel('Dog')).toBe('Dog')
  })
})

describe('formatTime', () => {
  it('formats a unix timestamp to HH:MM', () => {
    // 1713182400 = 2024-04-15T12:00:00Z
    const result = formatTime(1713182400)
    // Just check format — the exact time depends on the test machine's locale
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('cameraNotificationTag', () => {
  it('namespaces the tag per camera so cameras alert independently', () => {
    expect(cameraNotificationTag('front_porch')).toBe('camera-front_porch')
    expect(cameraNotificationTag('driveway')).toBe('camera-driveway')
  })
})

describe('buildCameraPayload', () => {
  it('links a single event to its detail page', () => {
    const payload = buildCameraPayload('front_porch', [makeEvent()], true)

    expect(payload.title).toBe('Front Porch')
    expect(payload.body).toContain('Person detected at')
    expect(payload.url).toBe('/camera-events/1713182400.123-abc')
    expect(payload.icon).toBe('/icon-192.png')
  })

  it('links multiple events to the events list', () => {
    const payload = buildCameraPayload(
      'front_porch',
      [makeEvent({ id: 'e1' }), makeEvent({ id: 'e2' })],
      true,
    )

    expect(payload.url).toBe('/camera-events')
  })

  it('tags the payload per camera so the SW can group and patch it', () => {
    const payload = buildCameraPayload('front_porch', [makeEvent()], true)

    expect(payload.tag).toBe('camera-front_porch')
  })

  it('carries the structured event the SW merges on', () => {
    const events = [
      makeEvent({ id: 'e1', label: 'person', startTime: 1713182400 }),
      makeEvent({ id: 'e2', label: 'car', startTime: 1713182500 }),
    ]
    const payload = buildCameraPayload('front_porch', events, true)

    expect(payload.event).toEqual({
      camera: 'front_porch',
      count: 2,
      labels: ['Person', 'Car'],
      timestamp: 1713182500,
      burstStart: true,
    })
  })

  it('marks continuation flushes as non-burst-start', () => {
    const payload = buildCameraPayload('front_porch', [makeEvent()], false)

    expect(payload.event?.burstStart).toBe(false)
  })

  it('deduplicates labels while preserving first-seen order', () => {
    const events = [
      makeEvent({ id: 'e1', label: 'car' }),
      makeEvent({ id: 'e2', label: 'person' }),
      makeEvent({ id: 'e3', label: 'car' }),
    ]
    const payload = buildCameraPayload('front_porch', events, true)

    expect(payload.event?.labels).toEqual(['Car', 'Person'])
    expect(payload.event?.count).toBe(3)
  })

  it('uses the latest start time as the payload timestamp', () => {
    const events = [
      makeEvent({ id: 'e1', startTime: 1713182400 }),
      makeEvent({ id: 'e2', startTime: 1713182500 }),
    ]
    const payload = buildCameraPayload('front_porch', events, true)

    expect(payload.event?.timestamp).toBe(1713182500)
  })

  describe('server-rendered body fallback (for service workers that predate merging)', () => {
    it('describes a single event with its label and time', () => {
      const payload = buildCameraPayload(
        'front_porch',
        [makeEvent({ label: 'car' })],
        true,
      )

      expect(payload.body).toMatch(/Car detected at \d{2}:\d{2}/)
    })

    it('summarises multiple events with a count and labels', () => {
      const events = [
        makeEvent({ id: 'e1', label: 'person' }),
        makeEvent({ id: 'e2', label: 'car' }),
        makeEvent({ id: 'e3', label: 'dog' }),
      ]
      const payload = buildCameraPayload('front_porch', events, true)

      expect(payload.body).toContain('3 new events')
      expect(payload.body).toContain('Person, Car, Dog')
    })

    it('truncates label lists beyond three with +N more', () => {
      const events = [
        makeEvent({ id: 'e1', label: 'person' }),
        makeEvent({ id: 'e2', label: 'car' }),
        makeEvent({ id: 'e3', label: 'dog' }),
        makeEvent({ id: 'e4', label: 'cat' }),
        makeEvent({ id: 'e5', label: 'bird' }),
      ]
      const payload = buildCameraPayload('driveway', events, true)

      expect(payload.body).toContain('+2 more')
    })
  })
})

describe('endpointHost', () => {
  it('extracts the host from an FCM endpoint', () => {
    expect(endpointHost('https://fcm.googleapis.com/fcm/send/abc123')).toBe(
      'fcm.googleapis.com',
    )
  })

  it('extracts the host from a Mozilla push endpoint', () => {
    expect(
      endpointHost('https://updates.push.services.mozilla.com/wpush/v2/xyz'),
    ).toBe('updates.push.services.mozilla.com')
  })

  it('returns "unknown" for an unparseable endpoint', () => {
    expect(endpointHost('not a url')).toBe('unknown')
  })
})

describe('notifyUsersForCamera', () => {
  const isPushEnabledMock = vi.mocked(isPushEnabled)
  const sendPushNotificationMock = vi.mocked(sendPushNotification)
  const getPushStoreMock = vi.mocked(getPushStore)

  function makeStore(
    overrides: {
      getAllSubscribedUserIds?: () => string[]
      isCameraEnabledForUser?: (userId: string, camera: string) => boolean
      getSubscriptionsByUserId?: (
        userId: string,
      ) => Array<{ endpoint: string; p256dh: string; auth: string }>
    } = {},
  ) {
    return {
      getAllSubscribedUserIds: vi.fn(
        overrides.getAllSubscribedUserIds ?? (() => []),
      ),
      isCameraEnabledForUser: vi.fn(
        overrides.isCameraEnabledForUser ?? (() => true),
      ),
      getSubscriptionsByUserId: vi.fn(
        overrides.getSubscriptionsByUserId ?? (() => []),
      ),
    }
  }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    isPushEnabledMock.mockReset()
    sendPushNotificationMock.mockReset()
    getPushStoreMock.mockReset()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it('returns early without calling getPushStore when isPushEnabled returns false', async () => {
    isPushEnabledMock.mockReturnValue(false)
    await notifyUsersForCamera('front_porch', [makeEvent()], {
      burstStart: true,
    })
    expect(getPushStoreMock).not.toHaveBeenCalled()
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('returns early without calling getPushStore when events array is empty', async () => {
    isPushEnabledMock.mockReturnValue(true)
    await notifyUsersForCamera('front_porch', [], { burstStart: true })
    expect(getPushStoreMock).not.toHaveBeenCalled()
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('calls sendPushNotification once per subscription with a single event payload', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subs = [
      { endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' },
      { endpoint: 'https://push.example/b', p256dh: 'p2', auth: 'a2' },
    ]
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1'],
      isCameraEnabledForUser: () => true,
      getSubscriptionsByUserId: () => subs,
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    const event = makeEvent()
    await notifyUsersForCamera('front_porch', [event], { burstStart: true })

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    const expectedPayload = buildCameraPayload('front_porch', [event], true)
    expect(sendPushNotificationMock).toHaveBeenNthCalledWith(
      1,
      {
        endpoint: 'https://push.example/a',
        keys: { p256dh: 'p1', auth: 'a1' },
      },
      expectedPayload,
    )
    expect(sendPushNotificationMock).toHaveBeenNthCalledWith(
      2,
      {
        endpoint: 'https://push.example/b',
        keys: { p256dh: 'p2', auth: 'a2' },
      },
      expectedPayload,
    )
  })

  it('logs the user, device count, and host when dispatching to a subscribed user', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subs = [
      { endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' },
      { endpoint: 'https://push.example/b', p256dh: 'p2', auth: 'a2' },
    ]
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1'],
      isCameraEnabledForUser: () => true,
      getSubscriptionsByUserId: () => subs,
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    await notifyUsersForCamera('front_porch', [makeEvent()], {
      burstStart: true,
    })

    const loggedMessages = consoleLogSpy.mock.calls.map(
      (call: unknown[]) => call[0],
    )
    expect(
      loggedMessages.some(
        (msg: unknown) =>
          typeof msg === 'string' &&
          msg.includes('user-1') &&
          msg.includes('2'),
      ),
    ).toBe(true)
    expect(
      loggedMessages.some(
        (msg: unknown) =>
          typeof msg === 'string' && msg.includes('push.example'),
      ),
    ).toBe(true)
  })

  it('calls sendPushNotification with bundled payload when multiple events', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subs = [
      { endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' },
    ]
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1'],
      isCameraEnabledForUser: () => true,
      getSubscriptionsByUserId: () => subs,
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    const events = [
      makeEvent({ id: 'e1', label: 'person' }),
      makeEvent({ id: 'e2', label: 'car' }),
    ]
    await notifyUsersForCamera('front_porch', events, { burstStart: true })

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    const expectedPayload = buildCameraPayload('front_porch', events, true)
    expect(sendPushNotificationMock).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/a',
        keys: { p256dh: 'p1', auth: 'a1' },
      },
      expectedPayload,
    )
  })

  it('skips users where isCameraEnabledForUser returns false', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subsByUser: Record<
      string,
      Array<{ endpoint: string; p256dh: string; auth: string }>
    > = {
      'user-allowed': [
        { endpoint: 'https://push.example/allowed', p256dh: 'p', auth: 'a' },
      ],
      'user-blocked': [
        { endpoint: 'https://push.example/blocked', p256dh: 'p', auth: 'a' },
      ],
    }
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-allowed', 'user-blocked'],
      isCameraEnabledForUser: (userId) => userId === 'user-allowed',
      getSubscriptionsByUserId: (userId) => subsByUser[userId] ?? [],
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    await notifyUsersForCamera('front_porch', [makeEvent()], {
      burstStart: true,
    })

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendPushNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/allowed' }),
      expect.anything(),
    )
    expect(store.getSubscriptionsByUserId).not.toHaveBeenCalledWith(
      'user-blocked',
    )
  })

  it('logs a skip message when a user has the camera disabled', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subsByUser: Record<
      string,
      Array<{ endpoint: string; p256dh: string; auth: string }>
    > = {
      'user-allowed': [
        { endpoint: 'https://push.example/allowed', p256dh: 'p', auth: 'a' },
      ],
      'user-blocked': [
        { endpoint: 'https://push.example/blocked', p256dh: 'p', auth: 'a' },
      ],
    }
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-allowed', 'user-blocked'],
      isCameraEnabledForUser: (userId) => userId === 'user-allowed',
      getSubscriptionsByUserId: (userId) => subsByUser[userId] ?? [],
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    await notifyUsersForCamera('front_porch', [makeEvent()], {
      burstStart: true,
    })

    const loggedMessages = consoleLogSpy.mock.calls.map(
      (call: unknown[]) => call[0],
    )
    expect(
      loggedMessages.some(
        (msg: unknown) =>
          typeof msg === 'string' &&
          msg.includes('user-blocked') &&
          /disabled|skip/i.test(msg),
      ),
    ).toBe(true)
  })

  it('catches and logs errors from sendPushNotification without rethrowing', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subs = [
      { endpoint: 'https://push.example/fail', p256dh: 'p1', auth: 'a1' },
      { endpoint: 'https://push.example/ok', p256dh: 'p2', auth: 'a2' },
    ]
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1'],
      isCameraEnabledForUser: () => true,
      getSubscriptionsByUserId: () => subs,
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    await expect(
      notifyUsersForCamera('front_porch', [makeEvent()], { burstStart: true }),
    ).resolves.toBeUndefined()

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://push.example/fail'),
      'boom',
    )
  })

  describe('burst flag', () => {
    it('passes the flush kind through to the payload', async () => {
      isPushEnabledMock.mockReturnValue(true)
      const store = makeStore({
        getAllSubscribedUserIds: () => ['user-1'],
        getSubscriptionsByUserId: () => [
          { endpoint: 'https://fcm.googleapis.com/a', p256dh: 'p', auth: 'a' },
        ],
      })
      getPushStoreMock.mockResolvedValue(store as never)
      sendPushNotificationMock.mockResolvedValue(undefined)

      await notifyUsersForCamera('front_porch', [makeEvent()], {
        burstStart: false,
      })

      const payload = sendPushNotificationMock.mock.calls[0][1]
      expect(payload.event?.burstStart).toBe(false)
    })
  })

  describe('Apple update throttling', () => {
    const APPLE = 'https://web.push.apple.com/device-a'
    const FCM = 'https://fcm.googleapis.com/fcm/send/device-b'

    function storeWithBothDevices() {
      return makeStore({
        getAllSubscribedUserIds: () => ['user-1'],
        getSubscriptionsByUserId: () => [
          { endpoint: APPLE, p256dh: 'p1', auth: 'a1' },
          { endpoint: FCM, p256dh: 'p2', auth: 'a2' },
        ],
      })
    }

    function endpointsSentTo() {
      return sendPushNotificationMock.mock.calls.map(
        (call) => (call[0] as { endpoint: string }).endpoint,
      )
    }

    it('sends burst starts to every device without throttling', async () => {
      isPushEnabledMock.mockReturnValue(true)
      getPushStoreMock.mockResolvedValue(storeWithBothDevices() as never)
      sendPushNotificationMock.mockResolvedValue(undefined)
      const throttle = new SendThrottle(300_000)

      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: true },
        { throttle, now: 0 },
      )

      expect(endpointsSentTo()).toEqual([APPLE, FCM])
    })

    it('suppresses rapid updates to Apple devices but not to others', async () => {
      isPushEnabledMock.mockReturnValue(true)
      getPushStoreMock.mockResolvedValue(storeWithBothDevices() as never)
      sendPushNotificationMock.mockResolvedValue(undefined)
      const throttle = new SendThrottle(300_000)

      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: false },
        { throttle, now: 0 },
      )
      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: false },
        { throttle, now: 30_000 },
      )

      // Apple got the first update only; the Android device got both.
      expect(endpointsSentTo()).toEqual([APPLE, FCM, FCM])
    })

    it('lets an Apple device through again once the interval has elapsed', async () => {
      isPushEnabledMock.mockReturnValue(true)
      getPushStoreMock.mockResolvedValue(storeWithBothDevices() as never)
      sendPushNotificationMock.mockResolvedValue(undefined)
      const throttle = new SendThrottle(300_000)

      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: false },
        { throttle, now: 0 },
      )
      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: false },
        { throttle, now: 300_000 },
      )

      expect(endpointsSentTo().filter((e) => e === APPLE)).toHaveLength(2)
    })

    it('makes a burst start reseed the Apple interval', async () => {
      isPushEnabledMock.mockReturnValue(true)
      getPushStoreMock.mockResolvedValue(storeWithBothDevices() as never)
      sendPushNotificationMock.mockResolvedValue(undefined)
      const throttle = new SendThrottle(300_000)

      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: true },
        { throttle, now: 0 },
      )
      await notifyUsersForCamera(
        'front_porch',
        [makeEvent()],
        { burstStart: false },
        { throttle, now: 60_000 },
      )

      // The alert at t=0 counts as a send, so the follow-up is suppressed.
      expect(endpointsSentTo().filter((e) => e === APPLE)).toHaveLength(1)
    })

    it('throttles each camera separately for the same device', async () => {
      isPushEnabledMock.mockReturnValue(true)
      getPushStoreMock.mockResolvedValue(storeWithBothDevices() as never)
      sendPushNotificationMock.mockResolvedValue(undefined)
      const throttle = new SendThrottle(300_000)

      await notifyUsersForCamera(
        'front_porch',
        [makeEvent({ camera: 'front_porch' })],
        { burstStart: false },
        { throttle, now: 0 },
      )
      await notifyUsersForCamera(
        'driveway',
        [makeEvent({ camera: 'driveway' })],
        { burstStart: false },
        { throttle, now: 0 },
      )

      expect(endpointsSentTo().filter((e) => e === APPLE)).toHaveLength(2)
    })
  })
})
