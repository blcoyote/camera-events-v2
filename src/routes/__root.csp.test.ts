import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { THEME_INIT_SCRIPT } from './__root'

// If this fails, the theme script changed. Update EXPECTED_CSP_HASH AND the
// script-src hash in BOTH docker-compose.yml and docker-compose.test.yml to
// match.
const EXPECTED_CSP_HASH = 'sha256-pcok2ZRCrHSL6Gi2i9yWkE5tEYIMq2buHTVQr1P7nQU='

/**
 * Extract the `script-src` directive value from a compose file's
 * Content-Security-Policy label. Scoped to the actual CSP line so the
 * `style-src 'unsafe-inline'` directive (intentionally kept for Tailwind)
 * is never mistaken for a `script-src` regression.
 */
function scriptSrcDirective(composeContent: string): string {
  const cspLine = composeContent
    .split('\n')
    .find((line) => line.includes('Content-Security-Policy='))
  if (!cspLine) throw new Error('Content-Security-Policy label not found')
  const match = cspLine.match(/script-src ([^;]*)/)
  if (!match) throw new Error('script-src directive not found')
  return match[1]
}

function readCompose(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('THEME_INIT_SCRIPT CSP hash', () => {
  it('hashes THEME_INIT_SCRIPT to EXPECTED_CSP_HASH', () => {
    const hash =
      'sha256-' +
      createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')

    expect(hash).toBe(EXPECTED_CSP_HASH)
  })

  it.each([
    ['docker-compose.yml', '../../docker-compose.yml'],
    ['docker-compose.test.yml', '../../docker-compose.test.yml'],
  ])(
    '%s script-src allow-lists the hash and drops unsafe-inline',
    (_name, path) => {
      const directive = scriptSrcDirective(readCompose(path))

      expect(directive).toContain(EXPECTED_CSP_HASH)
      expect(directive).not.toContain("'unsafe-inline'")
    },
  )
})
