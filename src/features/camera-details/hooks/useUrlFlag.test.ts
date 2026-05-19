// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseRouterState = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useRouterState: (opts: { select: (s: unknown) => unknown }) =>
    mockUseRouterState(opts),
}))

const { useUrlFlag } = await import('./useUrlFlag')

beforeEach(() => {
  mockUseRouterState.mockReset()
})

function withSearch(search: Record<string, unknown>) {
  mockUseRouterState.mockImplementation(
    (opts: { select: (s: unknown) => unknown }) =>
      opts.select({ location: { search } }),
  )
}

describe('useUrlFlag', () => {
  it('returns false when the URL has no matching query param', () => {
    withSearch({})
    const { result } = renderHook(() => useUrlFlag('clip', 'inline'))
    expect(result.current).toBe(false)
  })

  it('returns false when the param key exists but the value is wrong', () => {
    withSearch({ clip: 'other' })
    const { result } = renderHook(() => useUrlFlag('clip', 'inline'))
    expect(result.current).toBe(false)
  })

  it('returns false when a different key matches the expected value', () => {
    withSearch({ other: 'inline' })
    const { result } = renderHook(() => useUrlFlag('clip', 'inline'))
    expect(result.current).toBe(false)
  })

  it('returns true when both key and value match', () => {
    withSearch({ clip: 'inline' })
    const { result } = renderHook(() => useUrlFlag('clip', 'inline'))
    expect(result.current).toBe(true)
  })

  it('does not access window.location during the hook call (SSR safety)', () => {
    // Snapshot then null out window.location; if the hook reads it, this throws.
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new Proxy(
        {},
        {
          get() {
            throw new Error('hook should not read window.location')
          },
        },
      ),
    })
    try {
      withSearch({ clip: 'inline' })
      const { result } = renderHook(() => useUrlFlag('clip', 'inline'))
      expect(result.current).toBe(true)
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('subscribes via useRouterState (not popstate) — uses router state select callback', () => {
    withSearch({ clip: 'inline' })
    renderHook(() => useUrlFlag('clip', 'inline'))
    expect(mockUseRouterState).toHaveBeenCalledOnce()
    const opts = mockUseRouterState.mock.calls[0]?.[0] as {
      select: (s: unknown) => unknown
    }
    expect(typeof opts.select).toBe('function')
  })
})
