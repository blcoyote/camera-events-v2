// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { usePullToRefresh } from './usePullToRefresh'

const DEFAULT_THRESHOLD = 80
const DEFAULT_MAX_PULL = 120

function dispatchTouch(
  type: 'touchstart' | 'touchmove' | 'touchend',
  touches: Array<{ clientX: number; clientY: number }>,
) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: touches,
    configurable: true,
  })
  window.dispatchEvent(event)
}

function touchStart(clientX: number, clientY: number) {
  act(() => {
    dispatchTouch('touchstart', [{ clientX, clientY }])
  })
}

function touchMove(clientX: number, clientY: number) {
  act(() => {
    dispatchTouch('touchmove', [{ clientX, clientY }])
  })
}

function touchEnd() {
  act(() => {
    dispatchTouch('touchend', [])
  })
}

/**
 * A single touchmove is not enough to accumulate pull distance: the first
 * move past the 5px dead zone only locks the gesture's direction and
 * returns without applying any distance (see usePullToRefresh.ts). Call
 * this once, right after touchStart, before any move whose distance you
 * want reflected in pullDistance.
 */
function lockVertical(startX: number, startY: number) {
  touchMove(startX, startY + 6)
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'ontouchstart', {
    value: null,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'ontouchstart')
})

describe('usePullToRefresh', () => {
  it('does not attach touch listeners and never calls onRefresh when disabled', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, disabled: true }),
    )

    touchStart(100, 100)
    lockVertical(100, 100)
    touchMove(100, 300)
    touchEnd()

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.pullDistance).toBe(0)
  })

  it('calls onRefresh and toggles isRefreshing when a downward drag exceeds the threshold', async () => {
    let resolveRefresh: () => void = () => {}
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }))

    touchStart(100, 100)
    lockVertical(100, 100)
    touchMove(100, 300) // deltaY = 200 -> dampened = 100, past default threshold of 80
    expect(result.current.pullDistance).toBe(100)

    touchEnd()

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(result.current.isRefreshing).toBe(true)

    await act(async () => {
      resolveRefresh()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.isRefreshing).toBe(false)
  })

  it('does not call onRefresh and resets pullDistance when the drag stays below the threshold', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }))

    touchStart(100, 100)
    lockVertical(100, 100)
    touchMove(100, 120) // deltaY = 20 -> dampened = 10, below default threshold of 80
    expect(result.current.pullDistance).toBe(10)

    touchEnd()

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.pullDistance).toBe(0)
  })

  it('damps pullDistance by 0.5x while dragging and caps it at maxPull', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }))

    touchStart(100, 100)
    lockVertical(100, 100)

    touchMove(100, 200) // deltaY = 100 -> dampened = 50 (below maxPull)
    expect(result.current.pullDistance).toBe(50)

    touchMove(100, 700) // deltaY = 600 -> dampened would be 300, capped at DEFAULT_MAX_PULL
    expect(result.current.pullDistance).toBe(DEFAULT_MAX_PULL)
  })

  it('ignores a predominantly horizontal drag, even if a later vertical move would cross the threshold', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }))

    touchStart(100, 100)
    touchMove(150, 102) // deltaX = 50, deltaY = 2 -> locks as horizontal, returns
    expect(result.current.pullDistance).toBe(0)

    touchMove(150, 400) // isHorizontalRef is true -> gesture deactivated
    expect(result.current.pullDistance).toBe(0)

    touchMove(150, 600) // no longer active -> bails immediately
    touchEnd()

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.pullDistance).toBe(0)
  })

  it('detaches listeners when disabled toggles on and reattaches when it toggles off', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ disabled }: { disabled: boolean }) =>
        usePullToRefresh({ onRefresh, disabled }),
      { initialProps: { disabled: false } },
    )

    rerender({ disabled: true })

    touchStart(100, 100)
    lockVertical(100, 100)
    touchMove(100, 300)
    touchEnd()

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.pullDistance).toBe(0)

    rerender({ disabled: false })

    touchStart(100, 100)
    lockVertical(100, 100)
    touchMove(100, 300) // deltaY = 200 -> dampened = 100, past default threshold
    touchEnd()

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('removes all touch listeners on unmount', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => usePullToRefresh({ onRefresh }))
    unmount()

    const removedTypes = removeEventListenerSpy.mock.calls.map(
      (call) => call[0],
    )
    expect(removedTypes).toContain('touchstart')
    expect(removedTypes).toContain('touchmove')
    expect(removedTypes).toContain('touchend')

    removeEventListenerSpy.mockRestore()
  })

  it('respects a custom threshold and maxPull instead of the defaults', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 30, maxPull: 50 }),
    )

    touchStart(100, 100)
    lockVertical(100, 100)

    touchMove(100, 300) // deltaY = 200 -> dampened would be 100, capped at custom maxPull of 50
    expect(result.current.pullDistance).toBe(50)
    expect(result.current.pullDistance).not.toBe(DEFAULT_MAX_PULL)

    touchEnd()

    // 50 >= custom threshold of 30, well below the default threshold of 80
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(DEFAULT_THRESHOLD).toBeGreaterThan(30)
  })
})
