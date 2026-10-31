// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'

// Fresh runtime per test: Paraglide's getLocale persists only on its first call.
async function load() {
  vi.resetModules()
  await import('./client-locale')
  return (await import('#/paraglide/runtime.js')).getLocale
}

describe('client locale', () => {
  afterEach(() => {
    document.documentElement.lang = ''
    document.cookie = 'PARAGLIDE_LOCALE=; Max-Age=0; path=/'
  })

  it('resolves da from <html lang="da">', async () => {
    document.documentElement.lang = 'da'
    expect((await load())()).toBe('da')
  })

  it('ignores unsupported languages and falls back to the base locale', async () => {
    document.documentElement.lang = 'nb'
    expect((await load())()).toBe('en')
  })

  it('never writes the locale cookie, so Automatic stays automatic', async () => {
    document.documentElement.lang = 'da'
    ;(await load())()
    expect(document.cookie).not.toContain('PARAGLIDE_LOCALE')
  })
})
