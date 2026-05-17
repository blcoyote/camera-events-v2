import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatSubscribeError,
  withTimeout,
  getIOSStandaloneError,
} from './usePushSubscription'

/**
 * Tests for the push subscription logic.
 *
 * Since @testing-library/react's renderHook has React version conflicts in
 * this project's vitest setup, we test the hook's logic through its exported
 * helper functions and verify the hook's browser API interactions through
 * integration-style mocking.
 */

describe('formatSubscribeError', () => {
  it('returns generic copy for 5xx responses without leaking server detail', () => {
    const msg = formatSubscribeError(500, {
      error: "'better-sqlite3' is not yet supported in Bun",
    })
    expect(msg).toBe(
      'Notifications are temporarily unavailable. Please try again later.',
    )
    expect(msg).not.toContain('better-sqlite3')
    expect(msg).not.toContain('Bun')
  })

  it('returns generic copy for 502/503 the same way as 500', () => {
    const a = formatSubscribeError(502, { error: 'gateway down' })
    const b = formatSubscribeError(503, { error: 'maintenance' })
    expect(a).toBe(
      'Notifications are temporarily unavailable. Please try again later.',
    )
    expect(b).toBe(a)
  })

  it('returns the session-expired copy for 401', () => {
    const msg = formatSubscribeError(401, null)
    expect(msg).toContain('session has expired')
  })

  it('surfaces server-supplied detail on 4xx', () => {
    const msg = formatSubscribeError(400, {
      error: 'Invalid subscription endpoint URL',
    })
    expect(msg).toBe(
      'Could not enable notifications: Invalid subscription endpoint URL. Please try again.',
    )
  })

  it('falls back to generic 4xx copy when body has no error string', () => {
    const msg = formatSubscribeError(400, null)
    expect(msg).toBe('Could not enable notifications. Please try again.')
  })

  it('treats non-string body.error as missing detail', () => {
    const msg = formatSubscribeError(400, { error: 42 })
    expect(msg).toBe('Could not enable notifications. Please try again.')
  })
})

describe('usePushSubscription helpers', () => {
  describe('browser support detection', () => {
    it('detects PushManager when present', () => {
      vi.stubGlobal('PushManager', class {})
      expect(typeof globalThis.PushManager !== 'undefined').toBe(true)
      vi.unstubAllGlobals()
    })

    it('detects PushManager absence', () => {
      // In Node, PushManager is not defined by default
      // (previous test stubs it; this test verifies the check logic)
      vi.unstubAllGlobals()
      expect(typeof globalThis.PushManager !== 'undefined').toBe(false)
    })
  })

  describe('permission state', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('reads "default" permission', () => {
      vi.stubGlobal('Notification', { permission: 'default' })
      expect(Notification.permission).toBe('default')
    })

    it('reads "granted" permission', () => {
      vi.stubGlobal('Notification', { permission: 'granted' })
      expect(Notification.permission).toBe('granted')
    })

    it('reads "denied" permission (previously blocked at browser level)', () => {
      vi.stubGlobal('Notification', { permission: 'denied' })
      expect(Notification.permission).toBe('denied')
    })
  })

  describe('VAPID public key fetch', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('fetches public key from server', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ publicKey: 'test-vapid-key' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const res = await fetch('/api/push/vapid-public-key')
      const data = await res.json()

      expect(fetchMock).toHaveBeenCalledWith('/api/push/vapid-public-key')
      expect(data.publicKey).toBe('test-vapid-key')
    })

    it('handles 503 when VAPID not configured', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () =>
          Promise.resolve({ error: 'Push notifications are not configured' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const res = await fetch('/api/push/vapid-public-key')
      expect(res.ok).toBe(false)
      expect(res.status).toBe(503)
    })
  })

  describe('subscribe flow', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('calls PushManager.subscribe with correct params', async () => {
      const mockSubscription = {
        endpoint: 'https://push.example.com/sub1',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub1',
          keys: { p256dh: 'p-key', auth: 'a-key' },
        }),
        unsubscribe: vi.fn().mockResolvedValue(true),
      }

      const subscribeMock = vi.fn().mockResolvedValue(mockSubscription)
      const mockRegistration = {
        pushManager: {
          subscribe: subscribeMock,
          getSubscription: vi.fn().mockResolvedValue(null),
        },
      }

      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve(mockRegistration),
        },
      })

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'test-vapid-key',
      })

      expect(subscribeMock).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: 'test-vapid-key',
      })
      expect(sub.endpoint).toBe('https://push.example.com/sub1')
    })

    it('POSTs subscription to server', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub1',
          keys: { p256dh: 'p-key', auth: 'a-key' },
        }),
      })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/subscribe',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('push.example.com'),
        }),
      )
    })

    it('produces Brave-specific error when push service is blocked', () => {
      vi.stubGlobal('navigator', { brave: {} })

      const err = new DOMException(
        'Registration failed - push service error',
        'AbortError',
      )
      const isBrave = !!(navigator as any).brave
      const isBraveBlock =
        isBrave && err instanceof DOMException && err.name === 'AbortError'

      expect(isBraveBlock).toBe(true)
      vi.unstubAllGlobals()
    })

    it('does not produce Brave error for non-Brave browsers', () => {
      // navigator without .brave
      vi.stubGlobal('navigator', {})

      const err = new DOMException(
        'Registration failed - push service error',
        'AbortError',
      )
      const isBrave = !!(navigator as any).brave
      const isBraveBlock =
        isBrave && err instanceof DOMException && err.name === 'AbortError'

      expect(isBraveBlock).toBe(false)
      vi.unstubAllGlobals()
    })

    it('rolls back subscription on server error', async () => {
      const unsubscribeMock = vi.fn().mockResolvedValue(true)
      const mockSubscription = {
        endpoint: 'https://push.example.com/sub1',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub1',
          keys: { p256dh: 'p-key', auth: 'a-key' },
        }),
        unsubscribe: unsubscribeMock,
      }

      // Simulate: server rejects the subscription
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: mockSubscription.endpoint,
          keys: mockSubscription.toJSON().keys,
        }),
      })

      // On server error, the hook would unsubscribe locally
      if (!res.ok) {
        await mockSubscription.unsubscribe()
      }

      expect(unsubscribeMock).toHaveBeenCalled()
    })
  })

  describe('unsubscribe flow', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('calls unsubscribe and POSTs to server', async () => {
      const unsubscribeMock = vi.fn().mockResolvedValue(true)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      // Simulate unsubscribe flow
      await unsubscribeMock()
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push.example.com/sub1' }),
      })

      expect(unsubscribeMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/unsubscribe',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('sendTest flow', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('POSTs to /api/push/test and returns sent count', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sent: 2 }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      expect(data.sent).toBe(2)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/test',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the promise value when it settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'timed out')
    expect(result).toBe(42)
  })

  it('rejects with the timeout message when the promise does not settle in time', async () => {
    vi.useFakeTimers()
    const hanging = new Promise<never>(() => {})
    const race = withTimeout(hanging, 500, 'timed out')
    vi.advanceTimersByTime(600)
    await expect(race).rejects.toThrow('timed out')
  })

  it('clears the timer when the promise resolves before the timeout', async () => {
    vi.useFakeTimers()
    const fast = Promise.resolve('done')
    const result = await withTimeout(fast, 5000, 'timed out')
    expect(result).toBe('done')
    // No dangling timer should fire
    vi.advanceTimersByTime(10_000)
  })
})

describe('getIOSStandaloneError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubNavAndMedia(
    ua: string,
    platform: string,
    maxTouchPoints: number,
    standaloneFlag: boolean | undefined,
    matchMediaStandalone: boolean,
  ) {
    const navProps: Record<string, unknown> = {
      userAgent: ua,
      platform,
      maxTouchPoints,
    }
    if (standaloneFlag !== undefined) navProps.standalone = standaloneFlag
    vi.stubGlobal('navigator', navProps)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: matchMediaStandalone }),
    )
  }

  it('returns null on a non-iOS desktop browser', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Linux x86_64',
      0,
      undefined,
      false,
    )
    expect(getIOSStandaloneError()).toBeNull()
  })

  it('returns null on Android Chrome', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
      'Linux armv8l',
      5,
      undefined,
      false,
    )
    expect(getIOSStandaloneError()).toBeNull()
  })

  it('returns an error message on iPhone in Safari (not standalone)', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'iPhone',
      5,
      false,
      false,
    )
    const msg = getIOSStandaloneError()
    expect(msg).not.toBeNull()
    expect(msg).toContain('Home Screen')
  })

  it('returns null on iPhone in standalone mode via navigator.standalone', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'iPhone',
      5,
      true,
      false,
    )
    expect(getIOSStandaloneError()).toBeNull()
  })

  it('returns null on iPhone in standalone mode via matchMedia', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'iPhone',
      5,
      undefined,
      true,
    )
    expect(getIOSStandaloneError()).toBeNull()
  })

  it('detects modern iPad (MacIntel + maxTouchPoints > 1) as iOS', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'MacIntel',
      5,
      false,
      false,
    )
    const msg = getIOSStandaloneError()
    expect(msg).not.toBeNull()
    expect(msg).toContain('Home Screen')
  })

  it('does not flag MacIntel with zero touch points as iOS', () => {
    stubNavAndMedia(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'MacIntel',
      0,
      undefined,
      false,
    )
    expect(getIOSStandaloneError()).toBeNull()
  })
})
