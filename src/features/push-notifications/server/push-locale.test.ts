import { describe, it, expect } from 'vitest'
import { isPushLocale } from './push-locale'

describe('isPushLocale', () => {
  it('accepts en and da only', () => {
    expect(isPushLocale('en')).toBe(true)
    expect(isPushLocale('da')).toBe(true)
    for (const v of ['fr', 'EN', '', null, undefined, 1, {}]) {
      expect(isPushLocale(v)).toBe(false)
    }
  })
})
