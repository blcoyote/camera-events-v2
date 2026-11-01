import { describe, it, expect } from 'vitest'
import { paraglideMiddleware } from '#/paraglide/server.js'
import { getLocale } from '#/paraglide/runtime.js'

function resolve(headers: Record<string, string>) {
  return paraglideMiddleware(
    new Request('http://localhost/', { headers }),
    () => new Response(getLocale()),
  ).then((r) => r.text())
}

describe('server locale resolution', () => {
  it('uses Accept-Language when there is no cookie', async () => {
    expect(await resolve({ 'Accept-Language': 'da-DK,da;q=0.9' })).toBe('da')
  })

  it('falls back to en for unsupported languages', async () => {
    expect(await resolve({ 'Accept-Language': 'nb-NO' })).toBe('en')
  })

  it('lets the cookie win over Accept-Language', async () => {
    expect(
      await resolve({
        Cookie: 'PARAGLIDE_LOCALE=en',
        'Accept-Language': 'da',
      }),
    ).toBe('en')
  })
})
