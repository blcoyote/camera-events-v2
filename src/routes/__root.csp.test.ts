import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { THEME_INIT_SCRIPT } from './__root'

// If this fails, the theme script changed. Update EXPECTED_CSP_HASH AND the
// script-src hash in BOTH docker-compose.yml and docker-compose.test.yml to
// match.
const EXPECTED_CSP_HASH = 'sha256-pcok2ZRCrHSL6Gi2i9yWkE5tEYIMq2buHTVQr1P7nQU='

describe('THEME_INIT_SCRIPT CSP hash', () => {
  it('matches the hash configured in docker-compose.yml script-src', () => {
    const hash =
      'sha256-' +
      createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')

    expect(hash).toBe(EXPECTED_CSP_HASH)
  })

  it('is present in docker-compose.yml script-src', () => {
    const compose = readFileSync(
      new URL('../../docker-compose.yml', import.meta.url),
      'utf8',
    )

    expect(compose).toContain(EXPECTED_CSP_HASH)
  })

  it('is present in docker-compose.test.yml script-src', () => {
    const composeTest = readFileSync(
      new URL('../../docker-compose.test.yml', import.meta.url),
      'utf8',
    )

    expect(composeTest).toContain(EXPECTED_CSP_HASH)
  })
})
