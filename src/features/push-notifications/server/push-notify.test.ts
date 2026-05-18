import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatCameraName,
  formatLabel,
  formatTime,
  buildSinglePayload,
  buildBundledPayload,
  notifyUsersForCamera,
} from './push-notify'
import type { FrigateEventInfo } from './event-batcher'
import { isPushEnabled, sendPushNotification } from './push'
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

describe('buildSinglePayload', () => {
  it('builds a payload linking to the event detail page', () => {
    const payload = buildSinglePayload(makeEvent())
    expect(payload.title).toBe('Front Porch')
    expect(payload.body).toContain('Person detected at')
    expect(payload.url).toBe('/camera-events/1713182400.123-abc')
    expect(payload.icon).toBe('/icon-192.png')
  })

  it('includes the label and time in the body', () => {
    const payload = buildSinglePayload(makeEvent({ label: 'car' }))
    expect(payload.body).toMatch(/Car detected at \d{2}:\d{2}/)
  })

  it('includes a structured event with raw unix timestamp for client-side formatting', () => {
    const payload = buildSinglePayload(makeEvent({ startTime: 1713182400 }))
    expect(payload.event).toEqual({
      kind: 'single',
      label: 'Person',
      timestamp: 1713182400,
    })
  })
})

describe('buildBundledPayload', () => {
  it('builds a payload linking to the events list', () => {
    const events = [
      makeEvent({ id: 'evt1', label: 'person' }),
      makeEvent({ id: 'evt2', label: 'car' }),
      makeEvent({ id: 'evt3', label: 'dog' }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    expect(payload.title).toBe('Front Porch')
    expect(payload.body).toContain('3 new events')
    expect(payload.body).toContain('Person')
    expect(payload.body).toContain('Car')
    expect(payload.body).toContain('Dog')
    expect(payload.url).toBe('/camera-events')
    expect(payload.icon).toBe('/icon-192.png')
  })

  it('deduplicates labels', () => {
    const events = [
      makeEvent({ id: 'evt1', label: 'person' }),
      makeEvent({ id: 'evt2', label: 'person' }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    expect(payload.body).toContain('2 new events')
    // "Person" should appear only once in the summary
    const matches = payload.body.match(/Person/g)
    expect(matches).toHaveLength(1)
  })

  it('truncates labels beyond 3 with +N more', () => {
    const events = [
      makeEvent({ id: 'e1', label: 'person' }),
      makeEvent({ id: 'e2', label: 'car' }),
      makeEvent({ id: 'e3', label: 'dog' }),
      makeEvent({ id: 'e4', label: 'cat' }),
      makeEvent({ id: 'e5', label: 'bird' }),
    ]
    const payload = buildBundledPayload('driveway', events)
    expect(payload.body).toContain('+2 more')
  })

  it('uses the latest start time', () => {
    const events = [
      makeEvent({ id: 'e1', startTime: 1713182400 }),
      makeEvent({ id: 'e2', startTime: 1713182500 }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    // Should use startTime 1713182500 for the time display
    const time = new Date(1713182500 * 1000).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(payload.body).toContain(time)
  })

  it('includes a structured event with raw unix timestamp for client-side formatting', () => {
    const events = [
      makeEvent({ id: 'e1', label: 'person', startTime: 1713182400 }),
      makeEvent({ id: 'e2', label: 'car', startTime: 1713182500 }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    expect(payload.event).toEqual({
      kind: 'bundled',
      count: 2,
      labels: 'Person, Car',
      timestamp: 1713182500,
    })
  })
})

describe('notifyUsersForCamera', () => {
  const isPushEnabledMock = vi.mocked(isPushEnabled)
  const sendPushNotificationMock = vi.mocked(sendPushNotification)
  const getPushStoreMock = vi.mocked(getPushStore)

  function makeStore(overrides: {
    getAllSubscribedUserIds?: () => string[]
    isCameraEnabledForUser?: (userId: string, camera: string) => boolean
    getSubscriptionsByUserId?: (
      userId: string,
    ) => Array<{ endpoint: string; p256dh: string; auth: string }>
  } = {}) {
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

  beforeEach(() => {
    isPushEnabledMock.mockReset()
    sendPushNotificationMock.mockReset()
    getPushStoreMock.mockReset()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('returns early without calling getPushStore when isPushEnabled returns false', async () => {
    isPushEnabledMock.mockReturnValue(false)
    await notifyUsersForCamera('front_porch', [makeEvent()])
    expect(getPushStoreMock).not.toHaveBeenCalled()
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('returns early without calling getPushStore when events array is empty', async () => {
    isPushEnabledMock.mockReturnValue(true)
    await notifyUsersForCamera('front_porch', [])
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
    await notifyUsersForCamera('front_porch', [event])

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    const expectedPayload = buildSinglePayload(event)
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
    await notifyUsersForCamera('front_porch', events)

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    const expectedPayload = buildBundledPayload('front_porch', events)
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

    await notifyUsersForCamera('front_porch', [makeEvent()])

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendPushNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/allowed' }),
      expect.anything(),
    )
    expect(store.getSubscriptionsByUserId).not.toHaveBeenCalledWith(
      'user-blocked',
    )
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
      notifyUsersForCamera('front_porch', [makeEvent()]),
    ).resolves.toBeUndefined()

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://push.example/fail'),
      'boom',
    )
  })
})
