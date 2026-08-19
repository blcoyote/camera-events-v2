// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useRefetchOnFocus } from './useRefetchOnFocus'

describe('useRefetchOnFocus', () => {
  let originalVisibilityState: PropertyDescriptor | undefined

  beforeEach(() => {
    originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    )
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
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

  it('does not call onRefresh immediately on mount', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    renderHook(() => useRefetchOnFocus({ onRefresh, minIntervalMs: 10_000 }))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('calls onRefresh when the page becomes visible after minIntervalMs has elapsed since mount', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000

    renderHook(() => useRefetchOnFocus({ onRefresh, minIntervalMs }))

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('visible')
    fireVisibilityChange()

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not call onRefresh when visibilitychange fires while visibilityState is hidden', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000

    renderHook(() => useRefetchOnFocus({ onRefresh, minIntervalMs }))

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('hidden')
    fireVisibilityChange()

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('throttles rapid visibility-to-visible transitions within minIntervalMs, then fires again after the interval elapses', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000

    renderHook(() => useRefetchOnFocus({ onRefresh, minIntervalMs }))

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // A second visible transition well within the throttle window is ignored.
    setVisibilityState('hidden')
    fireVisibilityChange()
    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // A third transition after the interval has elapsed fires again.
    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('hidden')
    fireVisibilityChange()
    setVisibilityState('visible')
    fireVisibilityChange()
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('calls the latest onRefresh reference, not a stale one captured at mount, when the callback prop changes without unmounting', () => {
    const onRefreshA = vi.fn().mockResolvedValue(undefined)
    const onRefreshB = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 10_000

    const { rerender } = renderHook(
      (props: { onRefresh: () => Promise<void> }) =>
        useRefetchOnFocus({ onRefresh: props.onRefresh, minIntervalMs }),
      { initialProps: { onRefresh: onRefreshA } },
    )

    // Swap the callback identity without unmounting, exactly as a parent
    // component re-rendering with a fresh closure would do.
    rerender({ onRefresh: onRefreshB })

    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('visible')
    fireVisibilityChange()

    expect(onRefreshB).toHaveBeenCalledTimes(1)
    expect(onRefreshA).not.toHaveBeenCalled()
  })

  it('removes the visibilitychange listener on unmount', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useRefetchOnFocus({ onRefresh, minIntervalMs: 10_000 }),
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
  })

  it('respects a custom minIntervalMs distinct from the 10s default', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const minIntervalMs = 2_000

    renderHook(() => useRefetchOnFocus({ onRefresh, minIntervalMs }))

    // Elapse past the custom 2s interval but well under the 10s default —
    // if the default were used instead, this would not fire.
    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibilityState('visible')
    fireVisibilityChange()

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
