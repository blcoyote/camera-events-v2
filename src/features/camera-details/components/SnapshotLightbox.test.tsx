import { describe, expect, it } from 'vitest'
import { clampTranslation, distance, midpoint } from './SnapshotLightbox'

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
