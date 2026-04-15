import { describe, expect, it } from 'vitest'
import {
  SESSION_CONFIG_BASE,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from './session'

describe('SESSION_COOKIE_NAME', () => {
  it('is google-sso', () => {
    expect(SESSION_COOKIE_NAME).toBe('google-sso')
  })
})

describe('SESSION_MAX_AGE_SECONDS', () => {
  it('is 7 days in seconds', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60)
  })
})

describe('SESSION_CONFIG_BASE', () => {
  it('uses the session cookie name', () => {
    expect(SESSION_CONFIG_BASE.name).toBe(SESSION_COOKIE_NAME)
  })

  it('uses the session max age', () => {
    expect(SESSION_CONFIG_BASE.maxAge).toBe(SESSION_MAX_AGE_SECONDS)
  })

  it('has the correct cookie security flags', () => {
    expect(SESSION_CONFIG_BASE.cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  })

  it('sets secure flag based on NODE_ENV', () => {
    // In test environment, NODE_ENV is not 'production'
    expect(SESSION_CONFIG_BASE.cookie.secure).toBe(false)
  })
})
