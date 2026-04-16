import { describe, expect, it, vi } from 'vitest'
import {
  parseIdTokenClaims,
  validateIdTokenClaims,
  getAppOrigin,
} from './google-oauth'

describe('parseIdTokenClaims', () => {
  it('extracts sub, firstName, email, avatarUrl from full claims', () => {
    const claims = {
      sub: '123456789',
      given_name: 'John',
      email: 'john@example.com',
      picture: 'https://example.com/avatar.jpg',
    }

    const result = parseIdTokenClaims(claims)

    expect(result).toEqual({
      sub: '123456789',
      firstName: 'John',
      email: 'john@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
    })
  })

  it('handles missing given_name gracefully', () => {
    const claims = {
      sub: '123456789',
      email: 'john@example.com',
      picture: 'https://example.com/avatar.jpg',
    }

    const result = parseIdTokenClaims(claims)

    expect(result.firstName).toBe('')
  })

  it('handles missing picture gracefully', () => {
    const claims = {
      sub: '123456789',
      given_name: 'John',
      email: 'john@example.com',
    }

    const result = parseIdTokenClaims(claims)

    expect(result.avatarUrl).toBe('')
  })

  it('handles both given_name and picture missing', () => {
    const claims = {
      sub: '123456789',
      email: 'john@example.com',
    }

    const result = parseIdTokenClaims(claims)

    expect(result).toEqual({
      sub: '123456789',
      firstName: '',
      email: 'john@example.com',
      avatarUrl: '',
    })
  })

  it('returns empty sub when sub claim is missing', () => {
    const claims = { email: 'a@b.com' }

    const result = parseIdTokenClaims(claims)

    expect(result.sub).toBe('')
  })

  it('coerces non-string claim values via String()', () => {
    const claims = {
      sub: 12345,
      email: true,
      given_name: null,
      picture: undefined,
    }

    const result = parseIdTokenClaims(
      claims as unknown as Record<string, unknown>,
    )

    expect(result.sub).toBe('12345')
    expect(result.email).toBe('true')
    expect(result.firstName).toBe('')
    expect(result.avatarUrl).toBe('')
  })
})

describe('validateIdTokenClaims', () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600

  it('accepts valid claims', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
    const claims = {
      iss: 'https://accounts.google.com',
      aud: 'test-client-id',
      exp: futureExp,
    }
    expect(validateIdTokenClaims(claims)).toBe(true)
    vi.unstubAllEnvs()
  })

  it('rejects wrong issuer', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
    const claims = {
      iss: 'https://evil.com',
      aud: 'test-client-id',
      exp: futureExp,
    }
    expect(validateIdTokenClaims(claims)).toBe(false)
    vi.unstubAllEnvs()
  })

  it('rejects wrong audience', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
    const claims = {
      iss: 'https://accounts.google.com',
      aud: 'wrong-id',
      exp: futureExp,
    }
    expect(validateIdTokenClaims(claims)).toBe(false)
    vi.unstubAllEnvs()
  })

  it('rejects expired token', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
    const pastExp = Math.floor(Date.now() / 1000) - 60
    const claims = {
      iss: 'https://accounts.google.com',
      aud: 'test-client-id',
      exp: pastExp,
    }
    expect(validateIdTokenClaims(claims)).toBe(false)
    vi.unstubAllEnvs()
  })

  it('rejects missing exp', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
    const claims = { iss: 'https://accounts.google.com', aud: 'test-client-id' }
    expect(validateIdTokenClaims(claims)).toBe(false)
    vi.unstubAllEnvs()
  })
})

describe('getAppOrigin', () => {
  it('returns APP_URL when set', () => {
    vi.stubEnv('APP_URL', 'https://myapp.example.com')
    expect(getAppOrigin('http://localhost:3000')).toBe(
      'https://myapp.example.com',
    )
    vi.unstubAllEnvs()
  })

  it('falls back to request origin when APP_URL is not set', () => {
    vi.stubEnv('APP_URL', '')
    expect(getAppOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    vi.unstubAllEnvs()
  })
})
