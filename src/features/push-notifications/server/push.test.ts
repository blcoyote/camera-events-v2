import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock web-push before importing the module under test
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

// Mock push-store
vi.mock('./push-store', () => ({
  getPushStore: vi.fn(() => ({
    removeSubscriptionByEndpoint: vi.fn(),
  })),
}))

describe('push module', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  describe('when VAPID keys are missing', () => {
    beforeEach(() => {
      delete process.env.VAPID_PUBLIC_KEY
      delete process.env.VAPID_PRIVATE_KEY
      delete process.env.VAPID_SUBJECT
    })

    it('isPushEnabled returns false', async () => {
      const { isPushEnabled } = await import('./push')
      expect(isPushEnabled()).toBe(false)
    })

    it('getVapidPublicKey returns null', async () => {
      const { getVapidPublicKey } = await import('./push')
      expect(getVapidPublicKey()).toBeNull()
    })

    it('sendPushNotification throws', async () => {
      const { sendPushNotification } = await import('./push')
      await expect(
        sendPushNotification(
          {
            endpoint: 'https://push.example.com',
            keys: { p256dh: 'k', auth: 'a' },
          },
          { title: 'Test', body: 'Hello', url: '/' },
        ),
      ).rejects.toThrow('Push notifications are not configured')
    })

    it('logs a warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await import('./push')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('VAPID'))
      consoleSpy.mockRestore()
    })
  })

  describe('when VAPID keys are configured', () => {
    beforeEach(() => {
      process.env.VAPID_PUBLIC_KEY = 'test-public-key'
      process.env.VAPID_PRIVATE_KEY = 'test-private-key'
      process.env.VAPID_SUBJECT = 'mailto:test@example.com'
    })

    it('isPushEnabled returns true', async () => {
      const { isPushEnabled } = await import('./push')
      expect(isPushEnabled()).toBe(true)
    })

    it('getVapidPublicKey returns the public key', async () => {
      const { getVapidPublicKey } = await import('./push')
      expect(getVapidPublicKey()).toBe('test-public-key')
    })

    it('sendPushNotification calls web-push with correct payload', async () => {
      const webPush = (await import('web-push')).default
      const sendMock = vi
        .mocked(webPush.sendNotification)
        .mockResolvedValue({} as any)

      const { sendPushNotification } = await import('./push')

      const subscription = {
        endpoint: 'https://push.example.com/sub1',
        keys: { p256dh: 'p256dh-val', auth: 'auth-val' },
      }
      const payload = { title: 'Test', body: 'Hello', url: '/' }

      await sendPushNotification(subscription, payload)

      expect(sendMock).toHaveBeenCalledWith(
        subscription,
        JSON.stringify(payload),
      )
    })

    it('removes subscription on 410 response', async () => {
      const webPush = (await import('web-push')).default
      const error = new Error('Gone') as any
      error.statusCode = 410
      vi.mocked(webPush.sendNotification).mockRejectedValue(error)

      const { getPushStore } = await import('./push-store')
      const mockRemove = vi.fn()
      vi.mocked(getPushStore).mockReturnValue({
        removeSubscriptionByEndpoint: mockRemove,
      } as any)

      const { sendPushNotification } = await import('./push')

      await sendPushNotification(
        {
          endpoint: 'https://push.example.com/expired',
          keys: { p256dh: 'k', auth: 'a' },
        },
        { title: 'Test', body: 'Hello', url: '/' },
      )

      expect(mockRemove).toHaveBeenCalledWith(
        'https://push.example.com/expired',
      )
    })

    it('re-throws non-410 errors', async () => {
      const webPush = (await import('web-push')).default
      const error = new Error('Server Error') as any
      error.statusCode = 500
      vi.mocked(webPush.sendNotification).mockRejectedValue(error)

      const { sendPushNotification } = await import('./push')

      await expect(
        sendPushNotification(
          {
            endpoint: 'https://push.example.com/sub1',
            keys: { p256dh: 'k', auth: 'a' },
          },
          { title: 'Test', body: 'Hello', url: '/' },
        ),
      ).rejects.toThrow('Server Error')
    })
  })
})
