// @vitest-environment jsdom
import { useRef } from 'react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import {
  clampTranslation,
  distance,
  midpoint,
  useImageGestures,
} from './useImageGestures'

afterEach(() => {
  cleanup()
})

const RECT = {
  width: 300,
  height: 200,
  left: 0,
  top: 0,
  right: 300,
  bottom: 200,
  x: 0,
  y: 0,
  toJSON() {
    return this
  },
} as DOMRect

function TestHarness({ onDismiss }: { onDismiss: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const { transform, dismissY } = useImageGestures({
    imgRef,
    active: true,
    onDismiss,
  })
  return (
    <>
      <img ref={imgRef} data-testid="img" alt="" />
      <div data-testid="state">
        {JSON.stringify({ ...transform, dismissY })}
      </div>
    </>
  )
}

function readState() {
  return JSON.parse(screen.getByTestId('state').textContent) as {
    scale: number
    tx: number
    ty: number
    dismissY: number
  }
}

function renderHarness(onDismiss: () => void = vi.fn()) {
  render(<TestHarness onDismiss={onDismiss} />)
  const img = screen.getByTestId('img')
  img.getBoundingClientRect = () => RECT
  return img
}

describe('clampTranslation', () => {
  const rect = { width: 300, height: 200 } as DOMRect

  it('returns zero translation at scale 1', () => {
    expect(clampTranslation(50, 50, 1, rect)).toEqual({ tx: 0, ty: 0 })
  })

  it('clamps translation within bounds at scale 2', () => {
    const result = clampTranslation(999, 999, 2, rect)
    expect(result.tx).toBe(150)
    expect(result.ty).toBe(100)
  })

  it('clamps negative translation within bounds', () => {
    const result = clampTranslation(-999, -999, 2, rect)
    expect(result.tx).toBe(-150)
    expect(result.ty).toBe(-100)
  })

  it('allows translation within bounds', () => {
    const result = clampTranslation(50, 30, 2, rect)
    expect(result.tx).toBe(50)
    expect(result.ty).toBe(30)
  })
})

describe('distance', () => {
  it('computes distance between two points', () => {
    const a = { clientX: 0, clientY: 0 } as Touch
    const b = { clientX: 3, clientY: 4 } as Touch
    expect(distance(a, b)).toBe(5)
  })
})

describe('midpoint', () => {
  it('computes midpoint between two points', () => {
    const a = { clientX: 0, clientY: 0 } as Touch
    const b = { clientX: 10, clientY: 20 } as Touch
    expect(midpoint(a, b)).toEqual({ x: 5, y: 10 })
  })
})

describe('useImageGestures', () => {
  it('pinches to zoom in, then pans while zoomed, clamped to the image bounds', () => {
    const img = renderHarness()

    fireEvent.touchStart(img, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    })
    fireEvent.touchMove(img, {
      touches: [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    })
    expect(readState()).toEqual({ scale: 2, tx: 0, ty: 0, dismissY: 0 })
    fireEvent.touchEnd(img)

    fireEvent.touchStart(img, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(img, { touches: [{ clientX: 150, clientY: 130 }] })
    expect(readState()).toEqual({ scale: 2, tx: 50, ty: 30, dismissY: 0 })
  })

  it('double-taps to zoom in, then double-taps again to zoom back out', () => {
    const img = renderHarness()

    fireEvent.touchStart(img, { touches: [{ clientX: 100, clientY: 50 }] })
    fireEvent.touchStart(img, { touches: [{ clientX: 100, clientY: 50 }] })
    expect(readState()).toEqual({ scale: 2, tx: 50, ty: 50, dismissY: 0 })

    fireEvent.touchStart(img, { touches: [{ clientX: 100, clientY: 50 }] })
    fireEvent.touchStart(img, { touches: [{ clientX: 100, clientY: 50 }] })
    expect(readState()).toEqual({ scale: 1, tx: 0, ty: 0, dismissY: 0 })
  })

  it('springs back without dismissing when a downward swipe stays under the threshold', () => {
    const onDismiss = vi.fn()
    const img = renderHarness(onDismiss)

    fireEvent.touchStart(img, { touches: [{ clientX: 150, clientY: 50 }] })
    fireEvent.touchMove(img, { touches: [{ clientX: 150, clientY: 100 }] })
    expect(readState().dismissY).toBe(50)

    fireEvent.touchEnd(img)
    expect(readState()).toEqual({ scale: 1, tx: 0, ty: 0, dismissY: 0 })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses and resets the transform when a downward swipe passes the threshold', () => {
    const onDismiss = vi.fn()
    const img = renderHarness(onDismiss)

    fireEvent.touchStart(img, { touches: [{ clientX: 150, clientY: 50 }] })
    fireEvent.touchMove(img, { touches: [{ clientX: 150, clientY: 200 }] })
    expect(readState().dismissY).toBe(150)

    fireEvent.touchEnd(img)
    expect(readState()).toEqual({ scale: 1, tx: 0, ty: 0, dismissY: 0 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('zooms via wheel, clamped to the min/max scale', () => {
    const img = renderHarness()

    fireEvent.wheel(img, { deltaY: -100 })
    expect(readState().scale).toBeCloseTo(1.1)

    for (let i = 0; i < 20; i++) fireEvent.wheel(img, { deltaY: -100 })
    expect(readState().scale).toBe(4)

    fireEvent.wheel(img, { deltaY: 100 })
    expect(readState().scale).toBeCloseTo(3.6)

    for (let i = 0; i < 20; i++) fireEvent.wheel(img, { deltaY: 100 })
    expect(readState().scale).toBe(1)
  })

  it('drags to pan via mouse once zoomed, but ignores drag attempts at scale 1', () => {
    const img = renderHarness()

    fireEvent.mouseDown(img, { clientX: 150, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 140 })
    expect(readState()).toEqual({ scale: 1, tx: 0, ty: 0, dismissY: 0 })
    fireEvent.mouseUp(window)

    fireEvent.touchStart(img, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    })
    fireEvent.touchMove(img, {
      touches: [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    })
    fireEvent.touchEnd(img)
    expect(readState()).toEqual({ scale: 2, tx: 0, ty: 0, dismissY: 0 })

    fireEvent.mouseDown(img, { clientX: 150, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 140 })
    expect(readState()).toEqual({ scale: 2, tx: 50, ty: 40, dismissY: 0 })
    fireEvent.mouseUp(window)
  })
})
