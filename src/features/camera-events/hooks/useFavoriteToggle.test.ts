// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockToggleFavoriteFn =
  vi.fn<
    (opts: { data: { eventId: string } }) => Promise<{ favorited: boolean }>
  >()
vi.mock('../server/favorites-fns', () => ({
  toggleFavoriteFn: mockToggleFavoriteFn,
}))

const mockInvalidate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

// Import hook AFTER mocks
const { useFavoriteToggle } = await import('./useFavoriteToggle')

// ─── Tests ───────────────────────────────────────────────────────────────────

const EVENT_ID = '1713095000.123456-abcdef'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useFavoriteToggle', () => {
  describe('initial state', () => {
    it('returns initialFavorited=false when seeded false', () => {
      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))
      expect(result.current.favorited).toBe(false)
      expect(result.current.pending).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('returns initialFavorited=true when seeded true', () => {
      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, true))
      expect(result.current.favorited).toBe(true)
    })
  })

  describe('successful toggle', () => {
    it('sets pending=true, then resolves with the server response', async () => {
      mockToggleFavoriteFn.mockResolvedValue({ favorited: true })

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))

      let togglePromise: Promise<void>
      act(() => {
        togglePromise = result.current.toggle()
      })

      // pending immediately after toggle call
      expect(result.current.pending).toBe(true)

      await act(async () => {
        await togglePromise!
      })

      expect(result.current.favorited).toBe(true)
      expect(result.current.pending).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('calls router.invalidate() exactly once on success', async () => {
      mockToggleFavoriteFn.mockResolvedValue({ favorited: true })

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))
      await act(async () => {
        await result.current.toggle()
      })

      expect(mockInvalidate).toHaveBeenCalledOnce()
    })

    it('calls toggleFavoriteFn with the correct eventId', async () => {
      mockToggleFavoriteFn.mockResolvedValue({ favorited: true })

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))
      await act(async () => {
        await result.current.toggle()
      })

      expect(mockToggleFavoriteFn).toHaveBeenCalledWith({
        data: { eventId: EVENT_ID },
      })
    })
  })

  describe('error path', () => {
    it('reverts favorited to pre-click value on error', async () => {
      mockToggleFavoriteFn.mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, true))
      await act(async () => {
        await result.current.toggle()
      })

      expect(result.current.favorited).toBe(true) // reverted
    })

    it('sets a non-null error string on failure', async () => {
      mockToggleFavoriteFn.mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))
      await act(async () => {
        await result.current.toggle()
      })

      expect(result.current.error).not.toBeNull()
      expect(typeof result.current.error).toBe('string')
    })

    it('sets pending=false after error', async () => {
      mockToggleFavoriteFn.mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))
      await act(async () => {
        await result.current.toggle()
      })

      expect(result.current.pending).toBe(false)
    })

    it('does NOT call router.invalidate() on error', async () => {
      mockToggleFavoriteFn.mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))
      await act(async () => {
        await result.current.toggle()
      })

      expect(mockInvalidate).not.toHaveBeenCalled()
    })
  })

  describe('debounce guard', () => {
    it('ignores a second toggle() call while pending', async () => {
      let resolve!: (v: { favorited: boolean }) => void
      mockToggleFavoriteFn.mockReturnValue(
        new Promise<{ favorited: boolean }>((r) => {
          resolve = r
        }),
      )

      const { result } = renderHook(() => useFavoriteToggle(EVENT_ID, false))

      act(() => {
        result.current.toggle()
      })

      // Call toggle again while pending — should be ignored
      act(() => {
        result.current.toggle()
      })

      // Resolve the first call
      await act(async () => {
        resolve({ favorited: true })
        await Promise.resolve()
      })

      // Should only have been called once
      expect(mockToggleFavoriteFn).toHaveBeenCalledOnce()
    })
  })
})
