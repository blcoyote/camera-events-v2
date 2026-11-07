// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTabBarViewportRepair } from './useTabBarViewportRepair'

type VV = EventTarget & {
  offsetTop: number
  height: number
  scale: number
}

const originalVisualViewport = Object.getOwnPropertyDescriptor(
  window,
  'visualViewport',
)
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
const originalStandalone = Object.getOwnPropertyDescriptor(
  navigator,
  'standalone',
)

let vv: VV
let navBottom: number
let navHeight: number
let nav: HTMLElement

function setVisualViewport(value: VV | undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value,
  })
}

function setStandalone(on: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: on && query === '(display-mode: standalone)',
      media: query,
    }),
  })
}

function makeVV(): VV {
  const t = new EventTarget() as VV
  t.offsetTop = 0
  t.height = 800
  t.scale = 1
  return t
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
}

function fireVisibility() {
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vv = makeVV()
  navBottom = 800
  navHeight = 56
  setVisualViewport(vv)
  setStandalone(true)
  setVisibility('visible')
  nav = document.createElement('nav')
  document.body.appendChild(nav)
  nav.getBoundingClientRect = () =>
    ({
      bottom: navBottom,
      height: navHeight,
      top: navBottom - navHeight,
    }) as DOMRect
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  nav.remove()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  for (const [key, desc, target] of [
    ['visualViewport', originalVisualViewport, window],
    ['matchMedia', originalMatchMedia, window],
    ['standalone', originalStandalone, navigator],
  ] as const) {
    if (desc) Object.defineProperty(target, key, desc)
    else delete (target as unknown as Record<string, unknown>)[key]
  }
  delete (document as unknown as Record<string, unknown>).visibilityState
})

function mount() {
  const ref = { current: nav }
  return renderHook(() => useTabBarViewportRepair(ref))
}

function flush() {
  vi.advanceTimersByTime(20)
}

describe('useTabBarViewportRepair', () => {
  it('does nothing when not standalone', () => {
    setStandalone(false)
    const add = vi.spyOn(document, 'addEventListener')
    const winAdd = vi.spyOn(window, 'addEventListener')
    navBottom = 500
    mount()
    expect(add.mock.calls.map((c) => c[0])).not.toContain('visibilitychange')
    expect(winAdd.mock.calls.map((c) => c[0])).not.toEqual(
      expect.arrayContaining(['pageshow']),
    )
    expect(winAdd.mock.calls.map((c) => c[0])).not.toContain('scroll')
    fireVisibility()
    vi.advanceTimersByTime(1000)
    expect(nav.style.transform).toBe('')
  })

  it('does nothing when visualViewport is unavailable', () => {
    setVisualViewport(undefined)
    const add = vi.spyOn(window, 'addEventListener')
    mount()
    expect(add.mock.calls.map((c) => c[0])).not.toContain('scroll')
  })

  it('treats navigator.standalone as installed', () => {
    setStandalone(false)
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    })
    navBottom = 500
    mount()
    fireVisibility()
    flush()
    expect(nav.style.transform).toBe('translateY(300px)')
  })

  it('applies translateY when the nav is above the viewport bottom after visibilitychange', () => {
    navBottom = 500
    mount()
    expect(nav.style.transform).toBe('')
    fireVisibility()
    flush()
    expect(nav.style.transform).toBe('translateY(300px)')
  })

  it('ignores visibilitychange while hidden', () => {
    navBottom = 500
    mount()
    setVisibility('hidden')
    fireVisibility()
    vi.advanceTimersByTime(1000)
    expect(nav.style.transform).toBe('')
  })

  it('re-checks once more after 300ms', () => {
    mount()
    fireVisibility()
    flush()
    expect(nav.style.transform).toBe('')
    navBottom = 600
    vi.advanceTimersByTime(300)
    expect(nav.style.transform).toBe('translateY(200px)')
  })

  it('clears a previous transform when back in sync', () => {
    nav.style.transform = 'translateY(300px)'
    mount()
    fireVisibility()
    flush()
    expect(nav.style.transform).toBe('')
  })

  it('skips while an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    navBottom = 500
    mount()
    fireVisibility()
    vi.advanceTimersByTime(1000)
    expect(nav.style.transform).toBe('')
    input.remove()
  })

  it('does not transform a hidden (zero-height) nav', () => {
    navHeight = 0
    navBottom = 500
    mount()
    fireVisibility()
    flush()
    expect(nav.style.transform).toBe('')
  })

  it('does not transform when pinch-zoomed', () => {
    vv.scale = 2
    navBottom = 500
    mount()
    fireVisibility()
    flush()
    expect(nav.style.transform).toBe('')
  })

  it.each([
    ['pageshow', () => window.dispatchEvent(new Event('pageshow'))],
    ['visualViewport resize', () => vv.dispatchEvent(new Event('resize'))],
    [
      'orientationchange',
      () => window.dispatchEvent(new Event('orientationchange')),
    ],
  ])('repairs on %s', (_name, fire) => {
    navBottom = 500
    mount()
    fire()
    flush()
    expect(nav.style.transform).toBe('translateY(300px)')
  })

  it('scroll triggers only after the 150ms debounce', () => {
    navBottom = 500
    mount()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(100)
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(100)
    // 200ms since first scroll, but only 100ms since the last
    expect(nav.style.transform).toBe('')
    vi.advanceTimersByTime(50)
    flush()
    expect(nav.style.transform).toBe('translateY(300px)')
  })

  it('registers the scroll listener as passive', () => {
    const add = vi.spyOn(window, 'addEventListener')
    mount()
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
    })
  })

  it('cancels a pending schedule when rescheduled', () => {
    const raf = vi.spyOn(window, 'cancelAnimationFrame')
    mount()
    fireVisibility()
    fireVisibility()
    expect(raf).toHaveBeenCalled()
  })

  it('removes listeners and cancels pending work on unmount', () => {
    navBottom = 500
    const docRemove = vi.spyOn(document, 'removeEventListener')
    const winRemove = vi.spyOn(window, 'removeEventListener')
    const vvRemove = vi.spyOn(vv, 'removeEventListener')
    const { unmount } = mount()
    fireVisibility()
    window.dispatchEvent(new Event('scroll'))
    unmount()
    expect(docRemove).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
    const winTypes = winRemove.mock.calls.map((c) => c[0])
    expect(winTypes).toEqual(
      expect.arrayContaining(['pageshow', 'orientationchange', 'scroll']),
    )
    expect(vvRemove).toHaveBeenCalledWith('resize', expect.any(Function))
    vi.advanceTimersByTime(1000)
    expect(nav.style.transform).toBe('')
  })
})
