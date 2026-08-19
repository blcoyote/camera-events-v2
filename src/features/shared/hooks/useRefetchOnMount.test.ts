// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useRefetchOnMount } from './useRefetchOnMount'

describe('useRefetchOnMount', () => {
  afterEach(() => {
    cleanup()
  })

  it('calls onRefresh exactly once when the hook mounts', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    renderHook(() => useRefetchOnMount({ onRefresh }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not call onRefresh synchronously during the render phase (only after mount, via the effect)', () => {
    let calledDuringRender = false
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    function useTestHarness() {
      // This runs synchronously during render, before effects flush.
      if (onRefresh.mock.calls.length > 0) {
        calledDuringRender = true
      }
      useRefetchOnMount({ onRefresh })
    }

    renderHook(() => useTestHarness())

    expect(calledDuringRender).toBe(false)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not re-fire when the onRefresh callback identity changes on rerender without unmounting', () => {
    const onRefreshA = vi.fn().mockResolvedValue(undefined)
    const onRefreshB = vi.fn().mockResolvedValue(undefined)

    const { rerender } = renderHook(
      (props: { onRefresh: () => Promise<void> }) =>
        useRefetchOnMount({ onRefresh: props.onRefresh }),
      { initialProps: { onRefresh: onRefreshA } },
    )

    expect(onRefreshA).toHaveBeenCalledTimes(1)

    // Simulate a parent component passing a fresh closure on every render,
    // which is normal React behavior and must not re-trigger the mount effect.
    rerender({ onRefresh: onRefreshB })
    rerender({ onRefresh: onRefreshB })

    expect(onRefreshA).toHaveBeenCalledTimes(1)
    expect(onRefreshB).not.toHaveBeenCalled()
  })
})
