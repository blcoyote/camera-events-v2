import { describe, it, expect } from 'vitest'
import { isNonZeroBox } from './boundingBox'

describe('isNonZeroBox', () => {
  it('returns false for null input', () => {
    expect(isNonZeroBox(null)).toBe(false)
  })

  it('returns false for an all-zero box', () => {
    expect(isNonZeroBox([0, 0, 0, 0])).toBe(false)
  })

  it('returns true when only one coordinate is non-zero', () => {
    expect(isNonZeroBox([0, 0.5, 0, 0])).toBe(true)
  })

  it('returns true when all coordinates are non-zero', () => {
    expect(isNonZeroBox([0.1, 0.2, 0.3, 0.4])).toBe(true)
  })
})
