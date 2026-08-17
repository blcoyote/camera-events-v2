// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLiveSnapshot } from './useLiveSnapshot'

class FakeImage {
  onload: (() => void) | null = null
  src = ''
  static instances: FakeImage[] = []
  constructor() {
    FakeImage.instances.push(this)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeImage.instances = []
  vi.stubGlobal('Image', FakeImage)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useLiveSnapshot', () => {
  it('returns the base snapshot URL for the camera initially', () => {
    const { result } = renderHook(() => useLiveSnapshot('front_porch'))
    expect(result.current).toBe('/api/cameras/front_porch/latest')
  })

  it('keeps showing the current image while the next one preloads', () => {
    const { result } = renderHook(() => useLiveSnapshot('front_porch'))
    const initial = result.current

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(FakeImage.instances).toHaveLength(1)
    expect(result.current).toBe(initial)
  })

  it('swaps to the new snapshot once it finishes loading', () => {
    const { result } = renderHook(() => useLiveSnapshot('front_porch'))

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => {
      FakeImage.instances[0].onload?.()
    })

    expect(result.current).toContain('/api/cameras/front_porch/latest?t=')
    expect(result.current).not.toBe('/api/cameras/front_porch/latest')
  })

  it('ignores a stale preload that resolves after a newer one', () => {
    const { result } = renderHook(() => useLiveSnapshot('front_porch'))

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const [first, second] = FakeImage.instances

    act(() => {
      second.onload?.()
    })
    const afterSecond = result.current

    act(() => {
      first.onload?.()
    })

    expect(result.current).toBe(afterSecond)
  })
})
