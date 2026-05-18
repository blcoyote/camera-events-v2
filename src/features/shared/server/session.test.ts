import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SESSION_CONFIG_BASE,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSessionConfig,
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

describe('getSessionConfig', () => {
  const original = process.env.SESSION_SECRET

  beforeEach(() => {
    delete process.env.SESSION_SECRET
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
  })

  it('throws when SESSION_SECRET is undefined', () => {
    expect(() => getSessionConfig()).toThrow(
      /SESSION_SECRET environment variable is required and must be at least 32 characters/,
    )
  })

  it('throws when SESSION_SECRET is shorter than 32 characters', () => {
    process.env.SESSION_SECRET = 'a'.repeat(31)
    expect(() => getSessionConfig()).toThrow(
      /SESSION_SECRET environment variable is required and must be at least 32 characters/,
    )
  })

  it('does not throw when SESSION_SECRET is exactly 32 characters and returns a config with password set', () => {
    const secret = 'a'.repeat(32)
    process.env.SESSION_SECRET = secret
    expect(() => getSessionConfig()).not.toThrow()
    const config = getSessionConfig()
    expect(config.password).toBe(secret)
  })

  it('returns a config that spreads SESSION_CONFIG_BASE', () => {
    process.env.SESSION_SECRET = 'x'.repeat(40)
    const config = getSessionConfig()
    expect(config.name).toBe(SESSION_CONFIG_BASE.name)
    expect(config.cookie).toEqual(SESSION_CONFIG_BASE.cookie)
  })
})
