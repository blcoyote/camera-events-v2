// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { useTheme as UseThemeFn } from './useTheme'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
})

let useTheme: typeof UseThemeFn

beforeEach(async () => {
  vi.resetModules()
  localStorageMock.clear()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })

  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''

  const mod = await import('./useTheme')
  useTheme = mod.useTheme
})

afterEach(() => {
  cleanup()
})

describe('useTheme', () => {
  it("mode is 'auto' on initial render", () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.mode).toBe('auto')
  })

  it("setTheme('light') changes mode to 'light' and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(result.current.mode).toBe('light')
    expect(window.localStorage.getItem('theme')).toBe('light')
  })

  it("setTheme('dark') changes mode to 'dark' and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.mode).toBe('dark')
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('cycleTheme cycles light -> dark -> auto -> light across three calls', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })
    expect(result.current.mode).toBe('light')

    act(() => {
      result.current.cycleTheme()
    })
    expect(result.current.mode).toBe('dark')

    act(() => {
      result.current.cycleTheme()
    })
    expect(result.current.mode).toBe('auto')

    act(() => {
      result.current.cycleTheme()
    })
    expect(result.current.mode).toBe('light')
  })

  it("reads localStorage on mount and applies stored 'dark' value", () => {
    window.localStorage.setItem('theme', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('dark')
  })

  it("ignores unknown localStorage values and defaults to 'auto'", () => {
    window.localStorage.setItem('theme', 'not-a-valid-mode')

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('auto')
  })
})
