// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration'
import { resyncExistingPushSubscription } from '#/features/shared/utils/pushResync'

vi.mock('#/features/shared/utils/pushResync', () => ({
  resyncExistingPushSubscription: vi.fn().mockResolvedValue(false),
}))

const resyncMock = vi.mocked(resyncExistingPushSubscription)

describe('ServiceWorkerRegistration', () => {
  let mockUpdate: ReturnType<typeof vi.fn>
  let mockRegistration: {
    update: ReturnType<typeof vi.fn>
    waiting: null
    installing: null
    addEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    resyncMock.mockClear()
    mockUpdate = vi.fn().mockResolvedValue(undefined)
    mockRegistration = {
      update: mockUpdate,
      waiting: null,
      installing: null,
      addEventListener: vi.fn(),
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        ready: Promise.resolve({ active: null }),
        controller: null,
        addEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })

  describe('on visibilitychange', () => {
    it('calls registration.update() when document becomes visible', async () => {
      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })

      await vi.waitFor(() => expect(mockUpdate).toHaveBeenCalledOnce())
      mockUpdate.mockClear()

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(mockUpdate).toHaveBeenCalledOnce()
    })

    it('does not call registration.update() when document becomes hidden', async () => {
      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })

      await vi.waitFor(() => expect(mockUpdate).toHaveBeenCalledOnce())
      mockUpdate.mockClear()

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('removes the visibilitychange listener on unmount', () => {
      const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

      const { unmount } = render(<ServiceWorkerRegistration />)
      unmount()

      expect(removeListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      )
    })
  })

  describe('push subscription re-sync', () => {
    it('calls resyncExistingPushSubscription on mount', async () => {
      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })

      await vi.waitFor(() => expect(resyncMock).toHaveBeenCalled())
    })

    it('calls resyncExistingPushSubscription again on visibilitychange to visible', async () => {
      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })

      await vi.waitFor(() => expect(resyncMock).toHaveBeenCalled())
      resyncMock.mockClear()

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(resyncMock).toHaveBeenCalled()
    })
  })
})

describe('ServiceWorkerRegistration toast offset', () => {
  afterEach(() => cleanup())

  it('clears the phone tab bar and drops to 1rem from sm up', async () => {
    const waiting = { postMessage: vi.fn() }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue({
          update: vi.fn().mockResolvedValue(undefined),
          waiting,
          installing: null,
          addEventListener: vi.fn(),
        }),
        ready: Promise.resolve({ active: null }),
        controller: null,
        addEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    })
    const { findByRole } = render(<ServiceWorkerRegistration />)
    const alert = await findByRole('alert')
    expect(alert.className).toContain(
      'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]',
    )
    expect(alert.className).toContain(
      'sm:bottom-[calc(1rem+env(safe-area-inset-bottom))]',
    )
  })
})
