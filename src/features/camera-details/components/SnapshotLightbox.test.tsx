// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {
  clampTranslation,
  distance,
  midpoint,
  SnapshotLightbox,
} from './SnapshotLightbox'

afterEach(() => {
  cleanup()
})

describe('SnapshotLightbox rendering', () => {
  it('uses the bare src when showBoundingBox is omitted', () => {
    render(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot"
        alt="snap"
        open
        onClose={() => {}}
      />,
    )
    const img = screen.getByRole('img', { name: 'snap' })
    expect(img).toHaveAttribute('src', '/api/events/abc.1/snapshot')
  })

  it('appends ?bbox=true to a paramless src when showBoundingBox is true', () => {
    render(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot"
        alt="snap"
        open
        showBoundingBox
        onClose={() => {}}
      />,
    )
    const img = screen.getByRole('img', { name: 'snap' })
    expect(img).toHaveAttribute('src', '/api/events/abc.1/snapshot?bbox=true')
  })

  it('appends &bbox=true when src already has query params', () => {
    render(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot?download=true"
        alt="snap"
        open
        showBoundingBox
        onClose={() => {}}
      />,
    )
    const img = screen.getByRole('img', { name: 'snap' })
    expect(img).toHaveAttribute(
      'src',
      '/api/events/abc.1/snapshot?download=true&bbox=true',
    )
  })
})

describe('SnapshotLightbox utilities', () => {
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
})
