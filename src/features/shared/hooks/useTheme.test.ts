// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { THEME_STORAGE_KEY } from './themeMode'
import { __resetThemeStoreForTests, useTheme } from './useTheme'

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
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
})
