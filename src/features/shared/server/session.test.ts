import { mockEvent, sealSession, useSession } from 'h3-v2'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionData } from './session'
import {
  SESSION_CONFIG_BASE,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSessionConfig,
  resolveIsAuthenticatedFromRequest,
} from './session'

/**
 * Seals session data using the exact same h3-v2 seal path that
 * `useSession` (from `@tanstack/react-start/server`) uses in production,
 * so tests exercise a real round-trip rather than a hand-rolled encoding.
 */
async function sealSessionData(
  data: Partial<SessionData>,
  config: { password: string; maxAge?: number },
): Promise<string> {
  const event = mockEvent('http://localhost/')
  const session = await useSession<Partial<SessionData>>(event, config)
  await session.update(data)
  return sealSession(event, config)
}

function buildRequestWithCookie(cookieHeader: string | undefined): Request {
  return new Request('http://localhost/', {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
}

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

describe('resolveIsAuthenticatedFromRequest', () => {
  const original = process.env.SESSION_SECRET
  const secret = 's'.repeat(40)

  beforeEach(() => {
    process.env.SESSION_SECRET = secret
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
  })

  it('returns true for a validly sealed cookie round-tripped through the real seal path', async () => {
    const sealed = await sealSessionData(
      {
        sub: 'user-123',
        firstName: 'Ada',
        email: 'ada@example.com',
        avatarUrl: 'https://example.com/a.png',
      },
      { password: secret, maxAge: SESSION_MAX_AGE_SECONDS },
    )
    const request = buildRequestWithCookie(
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(sealed)}`,
    )

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(true)
  })

  it('returns false when the Cookie header is missing entirely', async () => {
    const request = buildRequestWithCookie(undefined)

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(
      false,
    )
  })

  it('returns false when the google-sso cookie is absent among other cookies', async () => {
    const request = buildRequestWithCookie('other=value; another=thing')

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(
      false,
    )
  })

  it('returns false for a malformed/garbage cookie value', async () => {
    const request = buildRequestWithCookie(
      `${SESSION_COOKIE_NAME}=not-a-sealed-value`,
    )

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(
      false,
    )
  })

  it('returns false when the seal has been tampered with', async () => {
    const sealed = await sealSessionData(
      { sub: 'user-123', firstName: 'Ada', email: '', avatarUrl: '' },
      { password: secret, maxAge: SESSION_MAX_AGE_SECONDS },
    )
    const tampered = sealed.slice(0, -1) + (sealed.at(-1) === 'a' ? 'b' : 'a')
    const request = buildRequestWithCookie(
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(tampered)}`,
    )

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(
      false,
    )
  })

  it('returns false when the cookie was sealed with a different password', async () => {
    const otherPassword = 'x'.repeat(40)
    const sealed = await sealSessionData(
      { sub: 'user-123', firstName: 'Ada', email: '', avatarUrl: '' },
      { password: otherPassword, maxAge: SESSION_MAX_AGE_SECONDS },
    )
    const request = buildRequestWithCookie(
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(sealed)}`,
    )

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(
      false,
    )
  })

  it('returns false when the sealed session has an empty sub', async () => {
    const sealed = await sealSessionData(
      { sub: '', firstName: 'Ada', email: '', avatarUrl: '' },
      { password: secret, maxAge: SESSION_MAX_AGE_SECONDS },
    )
    const request = buildRequestWithCookie(
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(sealed)}`,
    )

    await expect(resolveIsAuthenticatedFromRequest(request)).resolves.toBe(
      false,
    )
  })
})
