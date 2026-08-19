// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NotificationSettings } from './NotificationSettings'
import { usePushSubscription } from '../hooks/usePushSubscription'
import type { UsePushSubscriptionReturn } from '../hooks/usePushSubscription'

vi.mock('../hooks/usePushSubscription', () => ({
  usePushSubscription: vi.fn(),
}))

vi.mock('./NotificationSection', () => ({
  NotificationSection: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock('./CameraPreferences', () => ({
  CameraPreferences: ({
    cameras,
    onToggle,
  }: {
    cameras: { name: string; enabled: boolean }[]
    loading: boolean
    onToggle: (camera: string, enabled: boolean) => void
  }) => (
    <div>
      {cameras.map((c) => (
        <button key={c.name} onClick={() => onToggle(c.name, !c.enabled)}>
          {c.name}:{String(c.enabled)}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('./AvailabilityAlertsToggle', () => ({
  AvailabilityAlertsToggle: ({
    enabled,
    onToggle,
  }: {
    enabled: boolean
    onToggle: (enabled: boolean) => void
  }) => (
    <button onClick={() => onToggle(!enabled)}>
      availability:{String(enabled)}
    </button>
  ),
}))

const mockUsePushSubscription = vi.mocked(usePushSubscription)

function makeHookReturn(
  overrides: Partial<UsePushSubscriptionReturn> = {},
): UsePushSubscriptionReturn {
  return {
    isSupported: true,
    isPushEnabled: true,
    permissionState: 'granted',
    isSubscribed: false,
    isLoading: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendTest: vi.fn(),
    ...overrides,
  }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  vi.clearAllMocks()
})

describe('NotificationSettings', () => {
  it('shows an unsupported message and no buttons when isSupported is false', () => {
    mockUsePushSubscription.mockReturnValue(
      makeHookReturn({ isSupported: false }),
    )
    render(<NotificationSettings />)

    expect(
      screen.getByText('Push notifications are not supported in this browser.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a not-available message when isPushEnabled is false', () => {
    mockUsePushSubscription.mockReturnValue(
      makeHookReturn({ isPushEnabled: false }),
    )
    render(<NotificationSettings />)

    expect(
      screen.getByText('Push notifications are not available on this server.'),
    ).toBeInTheDocument()
  })

  it('shows a blocked message with instructions when permission is denied and not subscribed', () => {
    mockUsePushSubscription.mockReturnValue(
      makeHookReturn({ permissionState: 'denied', isSubscribed: false }),
    )
    render(<NotificationSettings />)

    expect(
      screen.getByText('Notifications are blocked in your browser settings.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Chrome', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Safari', { exact: false })).toBeInTheDocument()
  })

  it('shows an Enable Notifications button when not subscribed, and calls subscribe on click', () => {
    const subscribe = vi.fn()
    mockUsePushSubscription.mockReturnValue(
      makeHookReturn({ isSubscribed: false, subscribe }),
    )
    render(<NotificationSettings />)

    const button = screen.getByRole('button', {
      name: 'Enable Notifications',
    })
    fireEvent.click(button)

    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  describe('when subscribed', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cameras: [], enabled: false }),
      })
    })

    it('shows the enabled indicator, and Disable/Send Test buttons', () => {
      const unsubscribe = vi.fn()
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true, unsubscribe }),
      )
      render(<NotificationSettings />)

      expect(screen.getByText('Notifications are enabled')).toBeInTheDocument()

      const disableButton = screen.getByRole('button', {
        name: 'Disable Notifications',
      })
      fireEvent.click(disableButton)
      expect(unsubscribe).toHaveBeenCalledTimes(1)

      expect(
        screen.getByRole('button', { name: 'Send Test Notification' }),
      ).toBeInTheDocument()
    })

    it('reverts an optimistic camera toggle when the preferences PUT resolves ok:false', async () => {
      globalThis.fetch = vi
        .fn()
        .mockImplementation((url: string, options?: RequestInit) => {
          const method = options?.method ?? 'GET'
          if (url === '/api/push/preferences' && method === 'GET') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  cameras: [{ name: 'front_porch', enabled: true }],
                }),
            })
          }
          if (url === '/api/push/preferences' && method === 'PUT') {
            return Promise.resolve({ ok: false })
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enabled: false }),
          })
        })
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true }),
      )
      render(<NotificationSettings />)

      const toggle = await screen.findByRole('button', {
        name: 'front_porch:true',
      })
      fireEvent.click(toggle)

      // Optimistic update flips immediately.
      expect(
        await screen.findByRole('button', { name: 'front_porch:false' }),
      ).toBeInTheDocument()

      // Failed PUT reverts back to the prior value.
      expect(
        await screen.findByRole('button', { name: 'front_porch:true' }),
      ).toBeInTheDocument()
    })

    it('reverts an optimistic camera toggle when the preferences PUT throws', async () => {
      globalThis.fetch = vi
        .fn()
        .mockImplementation((url: string, options?: RequestInit) => {
          const method = options?.method ?? 'GET'
          if (url === '/api/push/preferences' && method === 'GET') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  cameras: [{ name: 'front_porch', enabled: true }],
                }),
            })
          }
          if (url === '/api/push/preferences' && method === 'PUT') {
            return Promise.reject(new Error('network error'))
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enabled: false }),
          })
        })
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true }),
      )
      render(<NotificationSettings />)

      const toggle = await screen.findByRole('button', {
        name: 'front_porch:true',
      })
      fireEvent.click(toggle)

      expect(
        await screen.findByRole('button', { name: 'front_porch:false' }),
      ).toBeInTheDocument()

      expect(
        await screen.findByRole('button', { name: 'front_porch:true' }),
      ).toBeInTheDocument()
    })

    it('reverts an optimistic availability toggle when the PUT resolves ok:false', async () => {
      globalThis.fetch = vi
        .fn()
        .mockImplementation((url: string, options?: RequestInit) => {
          const method = options?.method ?? 'GET'
          if (url === '/api/push/availability-preference' && method === 'GET') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ enabled: true }),
            })
          }
          if (url === '/api/push/availability-preference' && method === 'PUT') {
            return Promise.resolve({ ok: false })
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ cameras: [] }),
          })
        })
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true }),
      )
      render(<NotificationSettings />)

      const toggle = await screen.findByRole('button', {
        name: 'availability:true',
      })
      fireEvent.click(toggle)

      expect(
        await screen.findByRole('button', { name: 'availability:false' }),
      ).toBeInTheDocument()

      expect(
        await screen.findByRole('button', { name: 'availability:true' }),
      ).toBeInTheDocument()
    })
  })

  describe('send test feedback', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cameras: [], enabled: false }),
      })
    })

    it('shows plural feedback when sendTest resolves with more than one device', async () => {
      const sendTest = vi.fn().mockResolvedValue(2)
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true, sendTest }),
      )
      render(<NotificationSettings />)

      fireEvent.click(
        screen.getByRole('button', { name: 'Send Test Notification' }),
      )

      expect(
        await screen.findByText('Test sent to 2 devices.'),
      ).toBeInTheDocument()
    })

    it('shows singular feedback when sendTest resolves with exactly one device', async () => {
      const sendTest = vi.fn().mockResolvedValue(1)
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true, sendTest }),
      )
      render(<NotificationSettings />)

      fireEvent.click(
        screen.getByRole('button', { name: 'Send Test Notification' }),
      )

      expect(
        await screen.findByText('Test sent to 1 device.'),
      ).toBeInTheDocument()
    })

    it('shows no feedback when sendTest resolves with zero devices', async () => {
      // Use a manually-resolved promise (rather than mockResolvedValue) so
      // the test can deterministically await the handler's post-await state
      // update before asserting on its absence — a plain `waitFor` on the
      // call count can resolve before that microtask runs, producing a
      // false pass that wouldn't catch a regression here.
      let resolveSendTest: (value: number) => void = () => {}
      const sendTest = vi.fn(
        () =>
          new Promise<number>((resolve) => {
            resolveSendTest = resolve
          }),
      )
      mockUsePushSubscription.mockReturnValue(
        makeHookReturn({ isSubscribed: true, sendTest }),
      )
      render(<NotificationSettings />)

      fireEvent.click(
        screen.getByRole('button', { name: 'Send Test Notification' }),
      )
      expect(sendTest).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveSendTest(0)
        await Promise.resolve()
      })

      expect(screen.queryByText(/Test sent to/)).not.toBeInTheDocument()
    })
  })

  it('renders the error message and suppresses test-result feedback when error is set', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cameras: [], enabled: false }),
    })
    const sendTest = vi.fn().mockResolvedValue(2)
    mockUsePushSubscription.mockReturnValue(
      makeHookReturn({
        isSubscribed: true,
        sendTest,
        error: 'Something went wrong',
      }),
    )
    render(<NotificationSettings />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Send Test Notification' }),
    )
    await vi.waitFor(() => expect(sendTest).toHaveBeenCalledTimes(1))

    expect(
      screen.queryByText('Test sent to 2 devices.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
