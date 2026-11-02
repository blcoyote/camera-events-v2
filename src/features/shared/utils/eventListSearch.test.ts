import { describe, it, expect } from 'vitest'
import { validateEventListFilters } from '#/features/shared/utils/eventListSearch'

describe('validateEventListFilters', () => {
  it('keeps valid strings', () => {
    expect(validateEventListFilters({ type: 'car', camera: 'front' })).toEqual({
      type: 'car',
      camera: 'front',
    })
  })

  it('drops non-strings', () => {
    expect(validateEventListFilters({ type: 5, camera: { a: 1 } })).toEqual({
      type: undefined,
      camera: undefined,
    })
  })

  it('drops empty strings', () => {
    expect(validateEventListFilters({ type: '', camera: '' })).toEqual({
      type: undefined,
      camera: undefined,
    })
  })

  it('accepts 64 chars and rejects 65', () => {
    expect(validateEventListFilters({ type: 'x'.repeat(64) }).type).toBe(
      'x'.repeat(64),
    )
    expect(validateEventListFilters({ type: 'x'.repeat(65) }).type).toBe(
      undefined,
    )
  })
})
