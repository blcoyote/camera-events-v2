import { describe, expect, it } from 'vitest'
import {
  buildOAuthState,
  parseOAuthState,
  OAUTH_SCOPES,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_OPTIONS,
  sanitizeReturnTo,
  redirectTo,
} from './auth'

describe('OAUTH_SCOPES', () => {
  it('includes openid, profile, and email', () => {
    expect(OAUTH_SCOPES).toEqual(['openid', 'profile', 'email'])
  })
})

describe('OAUTH_STATE_COOKIE_NAME', () => {
  it('is oauth_state', () => {
    expect(OAUTH_STATE_COOKIE_NAME).toBe('oauth_state')
  })
})

describe('OAUTH_STATE_COOKIE_OPTIONS', () => {
  it('has httpOnly and sameSite lax', () => {
    expect(OAUTH_STATE_COOKIE_OPTIONS.httpOnly).toBe(true)
    expect(OAUTH_STATE_COOKIE_OPTIONS.sameSite).toBe('lax')
    expect(OAUTH_STATE_COOKIE_OPTIONS.path).toBe('/')
    expect(OAUTH_STATE_COOKIE_OPTIONS.maxAge).toBe(300)
  })
})

describe('sanitizeReturnTo', () => {
  it('allows valid relative paths', () => {
    expect(sanitizeReturnTo('/dashboard')).toBe('/dashboard')
    expect(sanitizeReturnTo('/path?q=1')).toBe('/path?q=1')
  })

  it('rejects absolute URLs', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBeUndefined()
    expect(sanitizeReturnTo('http://evil.com')).toBeUndefined()
  })

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnTo('//evil.com')).toBeUndefined()
  })

  it('rejects paths with backslashes', () => {
    expect(sanitizeReturnTo('/\\evil.com')).toBeUndefined()
  })

  it('returns undefined for empty or undefined input', () => {
    expect(sanitizeReturnTo(undefined)).toBeUndefined()
    expect(sanitizeReturnTo('')).toBeUndefined()
  })
})

describe('redirectTo', () => {
  it('returns a 302 Response with Location header', () => {
    const response = redirectTo('/home')
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/home')
  })
})

describe('buildOAuthState', () => {
  it('encodes state and codeVerifier with no returnTo', () => {
    const state = 'random-state-value'
    const codeVerifier = 'random-verifier-value'

    const encoded = buildOAuthState(state, codeVerifier)
    const decoded = JSON.parse(atob(encoded))

    expect(decoded.state).toBe(state)
    expect(decoded.codeVerifier).toBe(codeVerifier)
    expect(decoded.returnTo).toBeUndefined()
  })

  it('encodes state, codeVerifier, and returnTo', () => {
    const state = 'random-state-value'
    const codeVerifier = 'random-verifier-value'
    const returnTo = '/dashboard'

    const encoded = buildOAuthState(state, codeVerifier, returnTo)
    const decoded = JSON.parse(atob(encoded))

    expect(decoded.state).toBe(state)
    expect(decoded.codeVerifier).toBe(codeVerifier)
    expect(decoded.returnTo).toBe('/dashboard')
  })

  it('round-trips with parseOAuthState', () => {
    const encoded = buildOAuthState('s', 'cv', '/dash')
    const parsed = parseOAuthState(encoded)
    expect(parsed).toEqual({
      state: 's',
      codeVerifier: 'cv',
      returnTo: '/dash',
    })
  })

  it('handles special characters in values', () => {
    const encoded = buildOAuthState('state+/=', 'verifier', '/path?q=hello&x=1')
    const parsed = parseOAuthState(encoded)
    expect(parsed).toEqual({
      state: 'state+/=',
      codeVerifier: 'verifier',
      returnTo: '/path?q=hello&x=1',
    })
  })
})

describe('parseOAuthState', () => {
  it('decodes a valid state cookie value', () => {
    const original = { state: 'abc', codeVerifier: 'def', returnTo: '/dashboard' }
    const encoded = btoa(JSON.stringify(original))

    const result = parseOAuthState(encoded)

    expect(result).toEqual(original)
  })

  it('returns null for invalid base64', () => {
    const result = parseOAuthState('not-valid-json!!!')
    expect(result).toBeNull()
  })

  it('returns null for valid base64 but invalid JSON', () => {
    const result = parseOAuthState(btoa('not json'))
    expect(result).toBeNull()
  })

  it('returns null for missing state field', () => {
    const encoded = btoa(JSON.stringify({ codeVerifier: 'abc' }))
    const result = parseOAuthState(encoded)
    expect(result).toBeNull()
  })

  it('returns null for missing codeVerifier field', () => {
    const encoded = btoa(JSON.stringify({ state: 'abc' }))
    const result = parseOAuthState(encoded)
    expect(result).toBeNull()
  })

  it('strips unknown fields from the result', () => {
    const encoded = btoa(
      JSON.stringify({ state: 'a', codeVerifier: 'b', evil: 'yes', admin: true }),
    )
    const result = parseOAuthState(encoded)
    expect(result).toEqual({ state: 'a', codeVerifier: 'b' })
    expect((result as Record<string, unknown>).evil).toBeUndefined()
    expect((result as Record<string, unknown>).admin).toBeUndefined()
  })
})
