// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { THEME_STORAGE_KEY } from './themeMode'
import { __resetThemeStoreForTests, useTheme } from './useTheme'

type ChangeHandler = (e: { matches: boolean }) => void

interface MediaStub {
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  addListener?: ReturnType<typeof vi.fn>
  removeListener?: ReturnType<typeof vi.fn>
  fire: (matches: boolean) => void
}

function stubMatchMedia(matches: boolean, opts: { legacy?: boolean } = {}) {
  let handler: ChangeHandler | undefined
  const capture = (_type: unknown, h?: ChangeHandler) => {
    handler = h
  }
  const capturePlain = (h: ChangeHandler) => {
    handler = h
  }
  const stub: MediaStub = {
    addEventListener: vi.fn(capture),
    removeEventListener: vi.fn(() => {
      handler = undefined
    }),
    fire: (m) => handler?.({ matches: m }),
  }
  const mql: Record<string, unknown> = { matches }
  if (opts.legacy) {
    stub.addListener = vi.fn(capturePlain)
    stub.removeListener = vi.fn(() => {
      handler = undefined
    })
    mql.addListener = stub.addListener
    mql.removeListener = stub.removeListener
  } else {
    mql.addEventListener = stub.addEventListener
    mql.removeEventListener = stub.removeEventListener
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return stub
}

describe('useTheme', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    __resetThemeStoreForTests()
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''
    stubMatchMedia(false)
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it('defaults to auto and resolves light when system is light', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.mode).toBe('auto')
    expect(result.current.resolved).toBe('light')
  })

  it('resolves auto to dark when the system prefers dark', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('loads a stored mode on mount and applies it to the DOM', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to auto for an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    const { result } = renderHook(() => useTheme())
    expect(result.current.mode).toBe('auto')
  })

  it('setTheme persists, applies the class and updates resolved', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('shares mode between two hook instances', () => {
    const a = renderHook(() => useTheme())
    const b = renderHook(() => useTheme())
    act(() => a.result.current.setTheme('light'))
    expect(b.result.current.mode).toBe('light')
  })

  it('cycleTheme goes light → dark → auto → light', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      act(() => result.current.cycleTheme())
      seen.push(result.current.mode)
    }
    expect(seen).toEqual(['dark', 'auto', 'light'])
  })

  it('does not crash when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useTheme())
    expect(result.current.mode).toBe('auto')
    act(() => result.current.setTheme('dark'))
    expect(result.current.mode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  describe('live system changes', () => {
    it('in auto, a dark change event adds the dark class and updates resolved', () => {
      const media = stubMatchMedia(false)
      const { result } = renderHook(() => useTheme())
      expect(result.current.resolved).toBe('light')
      act(() => media.fire(true))
      expect(result.current.resolved).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      act(() => media.fire(false))
      expect(result.current.resolved).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('refreshes resolved when re-entering auto after the system changed', () => {
      const { result } = renderHook(() => useTheme())
      act(() => result.current.setTheme('light'))
      expect(result.current.resolved).toBe('light')
      // System flips to dark while in light mode (no listener registered).
      stubMatchMedia(true)
      act(() => result.current.setTheme('auto'))
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(result.current.resolved).toBe('dark')
    })

    it('in light mode, leaves no change listener registered', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      const media = stubMatchMedia(false)
      renderHook(() => useTheme())
      // The pre-hydration render is always auto, so a listener may be added
      // briefly; it must be removed again once the stored mode loads.
      expect(media.removeEventListener).toHaveBeenCalledTimes(
        media.addEventListener.mock.calls.length,
      )
      media.fire(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('removes the listener when mode leaves auto', () => {
      const media = stubMatchMedia(false)
      const { result } = renderHook(() => useTheme())
      expect(media.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      )
      act(() => result.current.setTheme('dark'))
      expect(media.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      )
    })

    it('removes the listener on unmount', () => {
      const media = stubMatchMedia(false)
      const { unmount } = renderHook(() => useTheme())
      unmount()
      expect(media.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      )
    })

    it('falls back to legacy addListener/removeListener when addEventListener is absent', () => {
      const media = stubMatchMedia(false, { legacy: true })
      const { result, unmount } = renderHook(() => useTheme())
      expect(media.addListener).toHaveBeenCalledWith(expect.any(Function))
      act(() => media.fire(true))
      expect(result.current.resolved).toBe('dark')
      unmount()
      expect(media.removeListener).toHaveBeenCalledWith(expect.any(Function))
    })
  })
})
