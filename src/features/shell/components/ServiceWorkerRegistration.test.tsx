// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration'

describe('ServiceWorkerRegistration', () => {
  let mockUpdate: ReturnType<typeof vi.fn>
  let mockRegistration: {
    update: ReturnType<typeof vi.fn>
    waiting: null
    installing: null
    addEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
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
})
