import { describe, expect, it } from 'vitest'
import { translateLabel } from './labels'

describe('translateLabel', () => {
  it.each([
    ['car', 'da', 'Bil'],
    ['car', 'en', 'Car'],
    ['license_plate', 'da', 'Nummerplade'],
    ['license_plate', 'en', 'License plate'],
    ['raccoon', 'da', 'Raccoon'],
    ['some_thing', 'en', 'Some thing'],
  ] as const)('%s in %s is %s', (label, locale, expected) => {
    expect(translateLabel(label, locale)).toBe(expected)
  })

  it('does not throw on prototype keys', () => {
    expect(typeof translateLabel('__proto__', 'en')).toBe('string')
  })
})
