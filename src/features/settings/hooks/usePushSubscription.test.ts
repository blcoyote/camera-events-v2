// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  formatSubscribeError,
  usePushSubscription,
} from './usePushSubscription'

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

describe('usePushSubscription', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Default mock ServiceWorkerRegistration: no existing subscription. */
  function makeRegistration(
    overrides: {
      subscribe?: ReturnType<typeof vi.fn>
      getSubscription?: ReturnType<typeof vi.fn>
    } = {},
  ) {
    return {
      pushManager: {
        subscribe: overrides.subscribe ?? vi.fn(),
        getSubscription:
          overrides.getSubscription ?? vi.fn().mockResolvedValue(null),
      },
    }
  }

  /**
   * Stubs `PushManager` (so `isSupported` is true) and `navigator` (so
   * `navigator.serviceWorker.ready` resolves to the given registration).
   * `vi.stubGlobal('navigator', ...)` replaces the whole object rather than
   * patching jsdom's built-in `navigator` in place — jsdom's own navigator
   * has non-configurable accessor properties that make patching individual
   * fields awkward, so a full replacement (restored by `vi.unstubAllGlobals`
   * in `afterEach`) is the clean option here, matching the pattern already
   * used in `pushResync.test.ts`.
   */
  function stubBrowserSupport(options: {
    registration?: ReturnType<typeof makeRegistration>
    brave?: unknown
  }) {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(options.registration ?? makeRegistration()),
      },
      brave: options.brave,
    })
  }

  function stubVapidFetchOk(fetchMock: ReturnType<typeof vi.fn>) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ publicKey: 'test-vapid-key' }),
    })
  }

  describe('mount-time detection effect', () => {
    it('stays unsupported and never calls fetch when PushManager is undefined', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())

      await waitFor(() => {
        expect(result.current.isSupported).toBe(false)
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('detects support, push-enabled, and an existing subscription', async () => {
      const existingSub = { endpoint: 'https://push.example.com/existing' }
      const registration = makeRegistration({
        getSubscription: vi.fn().mockResolvedValue(existingSub),
      })
      stubBrowserSupport({ registration })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())

      await waitFor(() => {
        expect(result.current.isSubscribed).toBe(true)
      })
      expect(result.current.isSupported).toBe(true)
      expect(result.current.isPushEnabled).toBe(true)
    })
  })

  describe('subscribe', () => {
    it('sets a blocked-in-settings error and never calls pushManager.subscribe when permission is denied', async () => {
      const registration = makeRegistration()
      stubBrowserSupport({ registration })
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('denied'),
      })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      await act(async () => {
        await result.current.subscribe()
      })

      expect(result.current.error).toBe(
        'Notifications are blocked in your browser settings.',
      )
      expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
    })

    it('subscribes successfully: existing subscription is stored and error is cleared', async () => {
      const mockSubscription = {
        endpoint: 'https://push.example.com/sub1',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub1',
          keys: { p256dh: 'p-key', auth: 'a-key' },
        }),
        unsubscribe: vi.fn().mockResolvedValue(true),
      }
      const registration = makeRegistration({
        subscribe: vi.fn().mockResolvedValue(mockSubscription),
      })
      stubBrowserSupport({ registration })
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      await act(async () => {
        await result.current.subscribe()
      })

      expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true }),
      )
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/push/subscribe',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            endpoint: 'https://push.example.com/sub1',
            keys: { p256dh: 'p-key', auth: 'a-key' },
          }),
        }),
      )
      expect(result.current.isSubscribed).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('rolls back the local subscription and surfaces the real formatSubscribeError message on server rejection', async () => {
      const mockSubscription = {
        endpoint: 'https://push.example.com/sub1',
        toJSON: () => ({
          endpoint: 'https://push.example.com/sub1',
          keys: { p256dh: 'p-key', auth: 'a-key' },
        }),
        unsubscribe: vi.fn().mockResolvedValue(true),
      }
      const registration = makeRegistration({
        subscribe: vi.fn().mockResolvedValue(mockSubscription),
      })
      stubBrowserSupport({ registration })
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'bad endpoint' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      await act(async () => {
        await result.current.subscribe()
      })

      // Proves the rollback happened, not just that an error was set.
      expect(mockSubscription.unsubscribe).toHaveBeenCalledOnce()
      // Asserting the exact formatSubscribeError(400, ...) output (not a
      // substring the test could satisfy by accident) proves the real
      // function ran rather than a duplicated/copied error string.
      expect(result.current.error).toBe(
        formatSubscribeError(400, { error: 'bad endpoint' }),
      )
      expect(result.current.error).toContain('bad endpoint')
      expect(result.current.isSubscribed).toBe(false)
    })

    it('shows the Brave-specific message when navigator.brave is set and pushManager.subscribe aborts', async () => {
      const abortErr = new DOMException('Registration failed', 'AbortError')
      const registration = makeRegistration({
        subscribe: vi.fn().mockRejectedValue(abortErr),
      })
      stubBrowserSupport({ registration, brave: {} })
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      await act(async () => {
        await result.current.subscribe()
      })

      expect(result.current.error).toContain('Brave blocks push notifications')
    })

    it('falls back to the generic error message for the same AbortError when navigator.brave is undefined', async () => {
      const abortErr = new DOMException('Registration failed', 'AbortError')
      const registration = makeRegistration({
        subscribe: vi.fn().mockRejectedValue(abortErr),
      })
      stubBrowserSupport({ registration, brave: undefined })
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      await act(async () => {
        await result.current.subscribe()
      })

      // Note: jsdom's DOMException does not extend Error (unlike real
      // browsers, where the DOM spec has DOMException inherit from Error),
      // so the hook's `err instanceof Error` check is false here and it
      // falls through to the hard-coded 'Failed to subscribe' fallback
      // rather than `err.message`. What matters for this test is that the
      // Brave-specific branch was NOT taken — proving `isBrave` genuinely
      // gates the message rather than the DOMException/AbortError check
      // alone (see the previous test, where the exact same error triggers
      // the Brave copy once `isBrave` is true).
      expect(result.current.error).toBe('Failed to subscribe')
      expect(result.current.error).not.toContain('Brave')
    })
  })

  describe('unsubscribe', () => {
    it('calls the subscription unsubscribe(), POSTs the endpoint, and resets isSubscribed', async () => {
      const existingSub = {
        endpoint: 'https://push.example.com/existing',
        unsubscribe: vi.fn().mockResolvedValue(true),
      }
      const registration = makeRegistration({
        getSubscription: vi.fn().mockResolvedValue(existingSub),
      })
      stubBrowserSupport({ registration })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isSubscribed).toBe(true))

      await act(async () => {
        await result.current.unsubscribe()
      })

      expect(existingSub.unsubscribe).toHaveBeenCalledOnce()
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/push/unsubscribe',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            endpoint: 'https://push.example.com/existing',
          }),
        }),
      )
      expect(result.current.isSubscribed).toBe(false)
    })
  })

  describe('sendTest', () => {
    it('resolves to the server-reported sent count on success', async () => {
      const registration = makeRegistration()
      stubBrowserSupport({ registration })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sent: 2 }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      let sent: number | undefined
      await act(async () => {
        sent = await result.current.sendTest()
      })

      expect(sent).toBe(2)
      expect(result.current.error).toBeNull()
    })

    it('resolves to 0 and sets an error when the server responds not-ok', async () => {
      const registration = makeRegistration()
      stubBrowserSupport({ registration })
      const fetchMock = vi.fn()
      stubVapidFetchOk(fetchMock)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => usePushSubscription())
      await waitFor(() => expect(result.current.isPushEnabled).toBe(true))

      let sent: number | undefined
      await act(async () => {
        sent = await result.current.sendTest()
      })

      expect(sent).toBe(0)
      expect(result.current.error).not.toBeNull()
    })
  })
})
