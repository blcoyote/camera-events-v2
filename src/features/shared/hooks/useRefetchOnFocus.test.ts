// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useRefetchOnFocus contract', () => {
  let originalVisibilityState: PropertyDescriptor | undefined

  beforeEach(() => {
    originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    )
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalVisibilityState) {
      Object.defineProperty(
        document,
        'visibilityState',
        originalVisibilityState,
      )
    } else {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
    }
  })

  function setVisibilityState(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    })
  }

  function fireVisibilityChange() {
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('calls onRefresh when page becomes visible after the throttle interval', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000

    const handler = () => {
      if (document.visibilityState !== 'visible') return
      onRefresh()
    }
    document.addEventListener('visibilitychange', handler)

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('visible')
    fireVisibilityChange()

    expect(onRefresh).toHaveBeenCalledTimes(1)

    document.removeEventListener('visibilitychange', handler)
  })

  it('does not call onRefresh when page becomes hidden', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    const handler = () => {
      if (document.visibilityState !== 'visible') return
      onRefresh()
    }
    document.addEventListener('visibilitychange', handler)

    setVisibilityState('hidden')
    fireVisibilityChange()

    expect(onRefresh).not.toHaveBeenCalled()

    document.removeEventListener('visibilitychange', handler)
  })

  it('throttles rapid visibility changes', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000
    let lastRefetch = Date.now()

    const handler = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefetch < minIntervalMs) return
      lastRefetch = now
      onRefresh()
    }
    document.addEventListener('visibilitychange', handler)

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).toHaveBeenCalledTimes(1)

    setVisibilityState('hidden')
    fireVisibilityChange()
    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('hidden')
    fireVisibilityChange()
    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).toHaveBeenCalledTimes(2)

    document.removeEventListener('visibilitychange', handler)
  })

  it('does not refetch immediately on a fresh page load', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000
    const lastRefetch = Date.now()

    const handler = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefetch < minIntervalMs) return
      onRefresh()
    }
    document.addEventListener('visibilitychange', handler)

    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).not.toHaveBeenCalled()

    document.removeEventListener('visibilitychange', handler)
  })
})
