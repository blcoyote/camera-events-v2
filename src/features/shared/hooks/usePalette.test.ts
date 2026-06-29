// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { usePalette as UsePaletteFn } from './usePalette'

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

let usePalette: typeof UsePaletteFn

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
  document.documentElement.removeAttribute('data-palette')

  const mod = await import('./usePalette')
  usePalette = mod.usePalette
})

afterEach(() => {
  cleanup()
})

describe('usePalette', () => {
  it("palette is 'ocean' on initial render", () => {
    const { result } = renderHook(() => usePalette())
    expect(result.current.palette).toBe('ocean')
  })

  it("setPalette('sunset') changes palette and persists to localStorage", () => {
    const { result } = renderHook(() => usePalette())

    act(() => {
      result.current.setPalette('sunset')
    })

    expect(result.current.palette).toBe('sunset')
    expect(window.localStorage.getItem('palette')).toBe('sunset')
  })

  it("setPalette('sunset') sets the data-palette attribute on <html>", () => {
    const { result } = renderHook(() => usePalette())

    act(() => {
      result.current.setPalette('sunset')
    })

    expect(document.documentElement.getAttribute('data-palette')).toBe('sunset')
  })

  it("setPalette('ocean') removes the data-palette attribute (default is implicit)", () => {
    const { result } = renderHook(() => usePalette())

    act(() => {
      result.current.setPalette('sunset')
    })
    expect(document.documentElement.getAttribute('data-palette')).toBe('sunset')

    act(() => {
      result.current.setPalette('ocean')
    })
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false)
    expect(window.localStorage.getItem('palette')).toBe('ocean')
  })

  it("reads localStorage on mount and applies stored 'slate' value", () => {
    window.localStorage.setItem('palette', 'slate')

    const { result } = renderHook(() => usePalette())

    expect(result.current.palette).toBe('slate')
    expect(document.documentElement.getAttribute('data-palette')).toBe('slate')
  })

  it("ignores unknown localStorage values and defaults to 'ocean'", () => {
    window.localStorage.setItem('palette', 'not-a-valid-palette')

    const { result } = renderHook(() => usePalette())

    expect(result.current.palette).toBe('ocean')
  })
})
