// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { readStoredLanguage, clearStoredLanguage } from './languagePreference'

afterEach(() => {
  document.cookie = 'PARAGLIDE_LOCALE=; Max-Age=0; path=/'
})

describe('languagePreference', () => {
  it('returns null without a cookie', () => {
    expect(readStoredLanguage()).toBeNull()
  })

  it.each(['en', 'da'] as const)('reads %s', (l) => {
    document.cookie = `PARAGLIDE_LOCALE=${l}; path=/`
    expect(readStoredLanguage()).toBe(l)
  })

  it('ignores unsupported values', () => {
    document.cookie = 'PARAGLIDE_LOCALE=fr; path=/'
    expect(readStoredLanguage()).toBeNull()
  })

  it('clears the cookie', () => {
    document.cookie = 'PARAGLIDE_LOCALE=da; path=/'
    clearStoredLanguage()
    expect(readStoredLanguage()).toBeNull()
  })
})
