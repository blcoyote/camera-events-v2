import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleVapidPublicKey,
  handleSubscribe,
  handleUnsubscribe,
  handleTest,
} from './-push-handlers'
import { isPushEnabled, getVapidPublicKey, sendPushNotification } from '#/server/push'
import { getPushStore } from '#/server/push-store'

vi.mock('#/server/push', () => ({
  isPushEnabled: vi.fn(),
  getVapidPublicKey: vi.fn(),
  sendPushNotification: vi.fn(),
}))

vi.mock('#/server/push-store', () => ({
  getPushStore: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('handleVapidPublicKey', () => {
  it('returns publicKey when configured', () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    vi.mocked(getVapidPublicKey).mockReturnValue('test-public-key')

    const result = handleVapidPublicKey()
    expect(result).toEqual({ status: 200, body: { publicKey: 'test-public-key' } })
  })

  it('returns 503 when not configured', () => {
    vi.mocked(isPushEnabled).mockReturnValue(false)

    const result = handleVapidPublicKey()
    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({ error: expect.stringContaining('not configured') })
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
    vi.mocked(getPushStore).mockReturnValue({ saveSubscription: mockSave } as any)

    const result = await handleSubscribe('user1', {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'p-key', auth: 'a-key' },
    })

    expect(result.status).toBe(200)
    expect(mockSave).toHaveBeenCalledWith('user1', 'https://push.example.com/sub1', 'p-key', 'a-key')
  })

  it('returns 400 when body is invalid', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)

    const result = await handleSubscribe('user1', { endpoint: '', keys: { p256dh: '', auth: '' } })
    expect(result.status).toBe(400)
  })
})

describe('handleUnsubscribe', () => {
  it('returns 401 when unauthenticated', async () => {
    const result = await handleUnsubscribe(null, { endpoint: 'https://push.example.com' })
    expect(result.status).toBe(401)
  })

  it('removes subscription for authenticated user', async () => {
    vi.mocked(isPushEnabled).mockReturnValue(true)
    const mockRemove = vi.fn()
    vi.mocked(getPushStore).mockReturnValue({ removeSubscription: mockRemove } as any)

    const result = await handleUnsubscribe('user1', { endpoint: 'https://push.example.com/sub1' })

    expect(result.status).toBe(200)
    expect(mockRemove).toHaveBeenCalledWith('user1', 'https://push.example.com/sub1')
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
      { endpoint: 'https://push.example.com/1', keys: { p256dh: 'k1', auth: 'a1' } },
      { title: 'Test Notification', body: 'Push notifications are working!', url: '/' },
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
