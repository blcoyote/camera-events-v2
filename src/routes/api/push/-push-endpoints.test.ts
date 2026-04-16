import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleVapidPublicKey,
  handleSubscribe,
  handleUnsubscribe,
  handleTest,
  handleGetPreferences,
  handleSetPreference,
} from '#/features/push-notifications/server/push-handlers'
import {
  isPushEnabled,
  getVapidPublicKey,
  sendPushNotification,
} from '#/features/push-notifications/server/push'
import { getPushStore } from '#/features/push-notifications/server/push-store'
import { getCameras } from '#/features/shared/server/frigate/client'

vi.mock('#/features/push-notifications/server/push', () => ({
  isPushEnabled: vi.fn(),
  getVapidPublicKey: vi.fn(),
  sendPushNotification: vi.fn(),
}))

vi.mock('#/features/push-notifications/server/push-store', () => ({
  getPushStore: vi.fn(),
}))

vi.mock('#/features/shared/server/frigate/client', () => ({
  getCameras: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('handleVapidPublicKey', () => {
  it('returns publicKey when configured', () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    vi.mocked(getVapidPublicKey).mockReturnValue('test-public-key')

    const result = handleVapidPublicKey()
    expect(result).toEqual({
      status: 200,
      body: { publicKey: 'test-public-key' },
    })
  })

  it('returns 503 when not configured', () => {
    vi.mocked(isPushEnabled).mockReturnValue(false)

    const result = handleVapidPublicKey()
    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      error: expect.stringContaining('not configured'),
    })
  })
})

describe('handleSubscribe', () => {
  it('returns 401 when unauthenticated', async () => {
    const result = await handleSubscribe(null, {
      endpoint: 'https://push.example.com',
      keys: { p256dh: 'k', auth: 'a' },
    })
    expect(result.status).toBe(401)
  })

  it('returns 503 when push not configured', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(false)

    const result = await handleSubscribe('user1', {
      endpoint: 'https://push.example.com',
      keys: { p256dh: 'k', auth: 'a' },
    })
    expect(result.status).toBe(503)
  })

  it('upserts subscription for authenticated user', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    const mockSave = vi.fn()
    vi.mocked(getPushStore).mockReturnValue({
      saveSubscription: mockSave,
    } as any)

    const result = await handleSubscribe('user1', {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'p-key', auth: 'a-key' },
    })

    expect(result.status).toBe(200)
    expect(mockSave).toHaveBeenCalledWith(
      'user1',
      'https://push.example.com/sub1',
      'p-key',
      'a-key',
    )
  })

  it('returns 400 when body is invalid', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)

    const result = await handleSubscribe('user1', {
      endpoint: '',
      keys: { p256dh: '', auth: '' },
    })
    expect(result.status).toBe(400)
  })

  it('returns 400 for non-HTTPS endpoint', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)

    const result = await handleSubscribe('user1', {
      endpoint: 'http://push.example.com/sub1',
      keys: { p256dh: 'p-key', auth: 'a-key' },
    })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({
      error: expect.stringContaining('HTTPS'),
    })
  })

  it('returns 400 for invalid endpoint URL', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)

    const result = await handleSubscribe('user1', {
      endpoint: 'not-a-url',
      keys: { p256dh: 'p-key', auth: 'a-key' },
    })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({
      error: expect.stringContaining('endpoint URL'),
    })
  })
})

describe('handleUnsubscribe', () => {
  it('returns 401 when unauthenticated', async () => {
    const result = await handleUnsubscribe(null, {
      endpoint: 'https://push.example.com',
    })
    expect(result.status).toBe(401)
  })

  it('removes subscription for authenticated user', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    const mockRemove = vi.fn()
    vi.mocked(getPushStore).mockReturnValue({
      removeSubscription: mockRemove,
    } as any)

    const result = await handleUnsubscribe('user1', {
      endpoint: 'https://push.example.com/sub1',
    })

    expect(result.status).toBe(200)
    expect(mockRemove).toHaveBeenCalledWith(
      'user1',
      'https://push.example.com/sub1',
    )
  })

  it('returns 400 when endpoint is missing', async () => {
    const result = await handleUnsubscribe('user1', {})
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({
      error: expect.stringContaining('endpoint'),
    })
  })

  it('returns 400 when endpoint is not a string', async () => {
    const result = await handleUnsubscribe('user1', { endpoint: 123 })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({
      error: expect.stringContaining('endpoint'),
    })
  })
})

describe('handleTest', () => {
  it('returns 401 when unauthenticated', async () => {
    const result = await handleTest(null)
    expect(result.status).toBe(401)
  })

  it('returns 503 when push not configured', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(false)

    const result = await handleTest('user1')
    expect(result.status).toBe(503)
  })

  it('sends test notification to all user subscriptions', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    vi.mocked(sendPushNotification).mockResolvedValue(undefined)
    vi.mocked(getPushStore).mockReturnValue({
      getSubscriptionsByUserId: vi.fn(() => [
        { endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
        { endpoint: 'https://push.example.com/2', p256dh: 'k2', auth: 'a2' },
      ]),
    } as any)

    const result = await handleTest('user1')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ sent: 2 })
    expect(sendPushNotification).toHaveBeenCalledTimes(2)
    expect(sendPushNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example.com/1',
        keys: { p256dh: 'k1', auth: 'a1' },
      },
      {
        title: 'Test Notification',
        body: 'Push notifications are working!',
        url: '/',
      },
    )
  })

  it('returns sent: 0 when user has no subscriptions', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    vi.mocked(getPushStore).mockReturnValue({
      getSubscriptionsByUserId: vi.fn(() => []),
    } as any)

    const result = await handleTest('user1')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ sent: 0 })
  })
})

describe('handleGetPreferences', () => {
  it('returns 401 when unauthenticated', async () => {
    const result = await handleGetPreferences(null)
    expect(result.status).toBe(401)
  })

  it('returns 502 when getCameras fails', async () => {
    vi.mocked(getCameras).mockResolvedValue({ ok: false, error: 'timeout' })

    const result = await handleGetPreferences('user1')
    expect(result.status).toBe(502)
  })

  it('returns camera list with preferences merged', async () => {
    vi.mocked(getCameras).mockResolvedValue({
      ok: true,
      data: ['backyard', 'driveway', 'front_porch'],
    })
    vi.mocked(getPushStore).mockReturnValue({
      getDisabledCameras: vi.fn(() => ['driveway']),
    } as any)

    const result = await handleGetPreferences('user1')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      cameras: [
        { name: 'backyard', enabled: true },
        { name: 'driveway', enabled: false },
        { name: 'front_porch', enabled: true },
      ],
    })
  })

  it('returns all cameras as enabled when no preferences set', async () => {
    vi.mocked(getCameras).mockResolvedValue({
      ok: true,
      data: ['front_porch', 'garage'],
    })
    vi.mocked(getPushStore).mockReturnValue({
      getDisabledCameras: vi.fn(() => []),
    } as any)

    const result = await handleGetPreferences('user1')
    expect(result.status).toBe(200)
    const cameras = (result.body as any).cameras
    expect(cameras.every((c: any) => c.enabled)).toBe(true)
  })
})

describe('handleSetPreference', () => {
  it('returns 401 when unauthenticated', async () => {
    const result = await handleSetPreference(null, {
      camera: 'x',
      enabled: true,
    })
    expect(result.status).toBe(401)
  })

  it('returns 400 when camera is missing', async () => {
    const result = await handleSetPreference('user1', { enabled: true })
    expect(result.status).toBe(400)
  })

  it('returns 400 when enabled is missing', async () => {
    const result = await handleSetPreference('user1', { camera: 'front_porch' })
    expect(result.status).toBe(400)
  })

  it('returns 400 when enabled is not a boolean', async () => {
    const result = await handleSetPreference('user1', {
      camera: 'x',
      enabled: 'yes',
    })
    expect(result.status).toBe(400)
  })

  it('calls setPreference and returns ok', async () => {
    const mockSetPref = vi.fn()
    vi.mocked(getPushStore).mockReturnValue({
      setPreference: mockSetPref,
    } as any)

    const result = await handleSetPreference('user1', {
      camera: 'front_porch',
      enabled: false,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
    expect(mockSetPref).toHaveBeenCalledWith('user1', 'front_porch', false)
  })
})
