// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useSessionRefresh,
  needsSessionRefresh,
  SESSION_LAST_REFRESH_KEY,
  SESSION_REFRESH_THRESHOLD_MS,
  SESSION_EXPIRY_REFRESH_WINDOW_MS,
  SESSION_REFRESH_MIN_INTERVAL_MS,
} from './useSessionRefresh'

// ---------------------------------------------------------------------------
// needsSessionRefresh — pure function, exhaustively tested
// The hook calls window.location.reload() when this returns true and the user
// is authenticated. Testing the reload call itself is not feasible in jsdom
// because window.location.reload is non-configurable after spy restoration.
// The listener wiring is verified separately below.
// ---------------------------------------------------------------------------

describe('SESSION_REFRESH_THRESHOLD_MS', () => {
  it('is 1 hour in milliseconds', () => {
    expect(SESSION_REFRESH_THRESHOLD_MS).toBe(60 * 60 * 1000)
  })
})

describe('needsSessionRefresh', () => {
  it('returns false when elapsed time is less than the threshold', () => {
    const now = 1_000_000
    const last = now - SESSION_REFRESH_THRESHOLD_MS + 1000
    expect(needsSessionRefresh(last, now)).toBe(false)
  })

  it('returns false when elapsed time equals the threshold exactly', () => {
    const now = 1_000_000
    const last = now - SESSION_REFRESH_THRESHOLD_MS
    expect(needsSessionRefresh(last, now)).toBe(false)
  })

  it('returns true when elapsed time exceeds the threshold by 1ms', () => {
    const now = 1_000_000
    const last = now - SESSION_REFRESH_THRESHOLD_MS - 1
    expect(needsSessionRefresh(last, now)).toBe(true)
  })

  it('returns true when lastRefresh is 0 (never set)', () => {
    expect(needsSessionRefresh(0, SESSION_REFRESH_THRESHOLD_MS + 1)).toBe(true)
  })

  it('returns true when elapsed time is a full day over the threshold', () => {
    const now = 1_000_000_000
    const last = now - SESSION_REFRESH_THRESHOLD_MS - 24 * 60 * 60 * 1000
    expect(needsSessionRefresh(last, now)).toBe(true)
  })

  describe('proactive refresh near expiry', () => {
    // Refreshing only after an idle gap is reactive: a session can still lapse
    // while the app is used briefly and often. When the cookie is close to
    // expiring, refresh regardless of how recently we last did.
    const now = 1_000_000_000
    const recent = now - SESSION_REFRESH_MIN_INTERVAL_MS - 1

    it('returns true when the session expires inside the refresh window', () => {
      const expiresAt = now + SESSION_EXPIRY_REFRESH_WINDOW_MS - 1
      expect(needsSessionRefresh(recent, now, expiresAt)).toBe(true)
    })

    it('returns false when the session expires beyond the refresh window', () => {
      const expiresAt = now + SESSION_EXPIRY_REFRESH_WINDOW_MS + 1
      expect(needsSessionRefresh(recent, now, expiresAt)).toBe(false)
    })

    it('returns false when expiry is exactly at the window boundary', () => {
      const expiresAt = now + SESSION_EXPIRY_REFRESH_WINDOW_MS
      expect(needsSessionRefresh(recent, now, expiresAt)).toBe(false)
    })

    it('returns true for an already-expired session', () => {
      expect(needsSessionRefresh(recent, now, now - 1000)).toBe(true)
    })

    it('ignores a null expiry (session predates the expiresAt field)', () => {
      expect(needsSessionRefresh(recent, now, null)).toBe(false)
    })
  })

  describe('minimum interval guard', () => {
    // Without this floor, a cookie that fails to renew would reload the app on
    // every foreground for the whole final day of its life.
    const now = 1_000_000_000

    it('returns false near expiry when we refreshed within the minimum interval', () => {
      const justRefreshed = now - SESSION_REFRESH_MIN_INTERVAL_MS + 1
      const expiresAt = now + 1000
      expect(needsSessionRefresh(justRefreshed, now, expiresAt)).toBe(false)
    })

    it('returns true near expiry once the minimum interval has passed', () => {
      const older = now - SESSION_REFRESH_MIN_INTERVAL_MS - 1
      const expiresAt = now + 1000
      expect(needsSessionRefresh(older, now, expiresAt)).toBe(true)
    })

    it('is shorter than the idle threshold so it only gates the expiry path', () => {
      expect(SESSION_REFRESH_MIN_INTERVAL_MS).toBeLessThan(
        SESSION_REFRESH_THRESHOLD_MS,
      )
    })
  })
})

// ---------------------------------------------------------------------------
// useSessionRefresh hook
// ---------------------------------------------------------------------------

function mockStandalone(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' ? standalone : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const t0 = new Date('2026-01-01T00:00:00Z').getTime()

describe('useSessionRefresh', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(t0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not write to localStorage in non-standalone mode', () => {
    mockStandalone(false)
    renderHook(() => useSessionRefresh(true))
    expect(localStorage.getItem(SESSION_LAST_REFRESH_KEY)).toBeNull()
  })

  it('writes the current timestamp to localStorage on mount in standalone mode', () => {
    mockStandalone(true)
    renderHook(() => useSessionRefresh(true))
    expect(localStorage.getItem(SESSION_LAST_REFRESH_KEY)).toBe(String(t0))
  })

  it('writes localStorage when unauthenticated too (timestamp is always recorded on load)', () => {
    mockStandalone(true)
    renderHook(() => useSessionRefresh(false))
    expect(localStorage.getItem(SESSION_LAST_REFRESH_KEY)).toBe(String(t0))
  })

  it('updates the stored timestamp when isAuthenticated changes', () => {
    mockStandalone(true)
    const { rerender } = renderHook(
      ({ auth }: { auth: boolean }) => useSessionRefresh(auth),
      { initialProps: { auth: false } },
    )
    vi.setSystemTime(t0 + 1000)
    rerender({ auth: true })
    expect(localStorage.getItem(SESSION_LAST_REFRESH_KEY)).toBe(
      String(t0 + 1000),
    )
  })

  it('registers a visibilitychange listener in standalone mode', () => {
    mockStandalone(true)
    const spy = vi.spyOn(document, 'addEventListener')
    renderHook(() => useSessionRefresh(true))
    expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('does not register a visibilitychange listener in non-standalone mode', () => {
    mockStandalone(false)
    const spy = vi.spyOn(document, 'addEventListener')
    renderHook(() => useSessionRefresh(true))
    expect(spy).not.toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
  })

  it('removes the visibilitychange listener on unmount', () => {
    mockStandalone(true)
    const spy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useSessionRefresh(true))
    unmount()
    expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('reflects the elapsed-time logic: stored t0 needs refresh after threshold', () => {
    mockStandalone(true)
    renderHook(() => useSessionRefresh(true))

    const storedMs = Number(localStorage.getItem(SESSION_LAST_REFRESH_KEY))
    const laterMs = t0 + SESSION_REFRESH_THRESHOLD_MS + 1000

    expect(needsSessionRefresh(storedMs, laterMs)).toBe(true)
  })

  it('reflects the elapsed-time logic: stored t0 does not need refresh within threshold', () => {
    mockStandalone(true)
    renderHook(() => useSessionRefresh(true))

    const storedMs = Number(localStorage.getItem(SESSION_LAST_REFRESH_KEY))
    const soonMs = t0 + SESSION_REFRESH_THRESHOLD_MS - 1000

    expect(needsSessionRefresh(storedMs, soonMs)).toBe(false)
  })

  it('accepts an expiresAt argument and re-runs the effect when it changes', () => {
    mockStandalone(true)
    const spy = vi.spyOn(document, 'addEventListener')
    const { rerender } = renderHook(
      ({ expiresAt }: { expiresAt: number | undefined }) =>
        useSessionRefresh(true, expiresAt),
      { initialProps: { expiresAt: t0 + 60_000 } },
    )
    const callsAfterMount = spy.mock.calls.filter(
      ([event]) => event === 'visibilitychange',
    ).length

    rerender({ expiresAt: t0 + 120_000 })

    const callsAfterRerender = spy.mock.calls.filter(
      ([event]) => event === 'visibilitychange',
    ).length
    expect(callsAfterMount).toBe(1)
    expect(callsAfterRerender).toBe(2)
  })
})
