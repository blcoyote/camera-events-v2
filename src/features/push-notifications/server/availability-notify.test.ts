import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAvailabilityPayload,
  cameraAvailabilityNotificationTag,
  notifyUsersForCameraAvailability,
} from './availability-notify'
import { isPushEnabled, sendPushNotification } from './push'
import { getPushStore } from './push-store'

vi.mock('./push', () => ({
  isPushEnabled: vi.fn(),
  sendPushNotification: vi.fn(),
}))

vi.mock('./push-store', () => ({
  getPushStore: vi.fn(),
}))

describe('cameraAvailabilityNotificationTag', () => {
  it('namespaces the tag per camera, distinct from the motion-event tag', () => {
    expect(cameraAvailabilityNotificationTag('front_porch')).toBe(
      'camera-availability-front_porch',
    )
    expect(cameraAvailabilityNotificationTag('driveway')).toBe(
      'camera-availability-driveway',
    )
  })
})

describe('buildAvailabilityPayload', () => {
  it('builds an offline payload with the formatted camera name as title', () => {
    const payload = buildAvailabilityPayload('front_porch', 'offline')

    expect(payload.title).toBe('Front Porch')
    expect(payload.body).toBe('Camera went offline — no frames received')
    expect(payload.url).toBe('/cameras')
    expect(payload.icon).toBe('/icon-192.png')
    expect(payload.tag).toBe('camera-availability-front_porch')
  })

  it('builds an online payload with the back-online body text', () => {
    const payload = buildAvailabilityPayload('front_porch', 'online')

    expect(payload.body).toBe('Camera is back online')
  })

  it('tags the online and offline payloads for the same camera identically', () => {
    const offline = buildAvailabilityPayload('front_porch', 'offline')
    const online = buildAvailabilityPayload('front_porch', 'online')

    expect(online.tag).toBe(offline.tag)
  })
})

describe('notifyUsersForCameraAvailability', () => {
  const isPushEnabledMock = vi.mocked(isPushEnabled)
  const sendPushNotificationMock = vi.mocked(sendPushNotification)
  const getPushStoreMock = vi.mocked(getPushStore)

  function makeStore(
    overrides: {
      getAllSubscribedUserIds?: () => string[]
      isCameraAvailabilityEnabledForUser?: (userId: string) => boolean
      getSubscriptionsByUserId?: (
        userId: string,
      ) => Array<{ endpoint: string; p256dh: string; auth: string }>
    } = {},
  ) {
    return {
      getAllSubscribedUserIds: vi.fn(
        overrides.getAllSubscribedUserIds ?? (() => []),
      ),
      isCameraAvailabilityEnabledForUser: vi.fn(
        overrides.isCameraAvailabilityEnabledForUser ?? (() => false),
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

    await notifyUsersForCameraAvailability('front_porch', 'offline')

    expect(getPushStoreMock).not.toHaveBeenCalled()
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('does not send when there are no subscribed users', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const store = makeStore({ getAllSubscribedUserIds: () => [] })
    getPushStoreMock.mockResolvedValue(store as never)

    await notifyUsersForCameraAvailability('front_porch', 'offline')

    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('skips a user whose availability preference is disabled (the default)', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1'],
      isCameraAvailabilityEnabledForUser: () => false,
      getSubscriptionsByUserId: () => [
        { endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' },
      ],
    })
    getPushStoreMock.mockResolvedValue(store as never)

    await notifyUsersForCameraAvailability('front_porch', 'offline')

    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('sends to every subscription of a user with the preference enabled', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subs = [
      { endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' },
      { endpoint: 'https://push.example/b', p256dh: 'p2', auth: 'a2' },
    ]
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1'],
      isCameraAvailabilityEnabledForUser: () => true,
      getSubscriptionsByUserId: () => subs,
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    await notifyUsersForCameraAvailability('front_porch', 'offline')

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(2)
    const expectedPayload = buildAvailabilityPayload('front_porch', 'offline')
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

  it('only sends to the enabled user when one of two users has the preference disabled', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subsByUser: Record<
      string,
      Array<{ endpoint: string; p256dh: string; auth: string }>
    > = {
      'user-enabled': [
        { endpoint: 'https://push.example/enabled', p256dh: 'p', auth: 'a' },
      ],
      'user-disabled': [
        { endpoint: 'https://push.example/disabled', p256dh: 'p', auth: 'a' },
      ],
    }
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-enabled', 'user-disabled'],
      isCameraAvailabilityEnabledForUser: (userId) => userId === 'user-enabled',
      getSubscriptionsByUserId: (userId) => subsByUser[userId] ?? [],
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock.mockResolvedValue(undefined)

    await notifyUsersForCameraAvailability('front_porch', 'online')

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendPushNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/enabled' }),
      expect.anything(),
    )
  })

  it('continues sending to other subscriptions and users when one send rejects', async () => {
    isPushEnabledMock.mockReturnValue(true)
    const subsByUser: Record<
      string,
      Array<{ endpoint: string; p256dh: string; auth: string }>
    > = {
      'user-1': [
        { endpoint: 'https://push.example/fail', p256dh: 'p1', auth: 'a1' },
        { endpoint: 'https://push.example/ok', p256dh: 'p2', auth: 'a2' },
      ],
      'user-2': [
        { endpoint: 'https://push.example/user2', p256dh: 'p3', auth: 'a3' },
      ],
    }
    const store = makeStore({
      getAllSubscribedUserIds: () => ['user-1', 'user-2'],
      isCameraAvailabilityEnabledForUser: () => true,
      getSubscriptionsByUserId: (userId) => subsByUser[userId] ?? [],
    })
    getPushStoreMock.mockResolvedValue(store as never)
    sendPushNotificationMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    await expect(
      notifyUsersForCameraAvailability('front_porch', 'offline'),
    ).resolves.toBeUndefined()

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://push.example/fail'),
      'boom',
    )
  })
})
