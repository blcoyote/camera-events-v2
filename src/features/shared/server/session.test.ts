import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_MAX_AGE_SECONDS } from '#/features/shared/utils/sessionTtl'
import { sealStoredSession, unsealStoredSession } from './session-seal'
import type { StoredSession } from './session-seal'
import {
  SESSION_COOKIE_NAME,
  SESSION_CONFIG_BASE,
  getSessionConfig,
  getAppSession,
  startNewAppSession,
  clearAppSession,
  requireSession,
  resolveIsAuthenticated,
} from './session'
import type { SessionData } from './session'

const getCookieMock = vi.fn<(name: string) => string | undefined>()
const setCookieMock = vi.fn()
const deleteCookieMock = vi.fn()

vi.mock('@tanstack/react-start/server-only', () => ({}))

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (...args: [string]) => getCookieMock(...args),
  setCookie: (...args: [string, string, unknown?]) => setCookieMock(...args),
  deleteCookie: (...args: [string, unknown?]) => deleteCookieMock(...args),
}))

const TEST_SECRET = 'a'.repeat(40)

async function sealTestSession(
  session: StoredSession<SessionData>,
): Promise<string> {
  return sealStoredSession(session, TEST_SECRET, SESSION_MAX_AGE_SECONDS)
}

describe('SESSION_COOKIE_NAME', () => {
  it('is google-sso', async () => {
    expect(SESSION_COOKIE_NAME).toBe('google-sso')
  })
})

describe('SESSION_CONFIG_BASE', () => {
  it('uses the session cookie name', async () => {
    expect(SESSION_CONFIG_BASE.name).toBe(SESSION_COOKIE_NAME)
  })

  it('uses the session max age', async () => {
    expect(SESSION_CONFIG_BASE.maxAge).toBe(SESSION_MAX_AGE_SECONDS)
  })

  it('has the correct cookie security flags', async () => {
    expect(SESSION_CONFIG_BASE.cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  })

  it('sets secure flag based on NODE_ENV', async () => {
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

  it('throws when SESSION_SECRET is undefined', async () => {
    expect(() => getSessionConfig()).toThrow(
      /SESSION_SECRET environment variable is required and must be at least 32 characters/,
    )
  })

  it('throws when SESSION_SECRET is shorter than 32 characters', async () => {
    process.env.SESSION_SECRET = 'a'.repeat(31)
    expect(() => getSessionConfig()).toThrow(
      /SESSION_SECRET environment variable is required and must be at least 32 characters/,
    )
  })

  it('does not throw when SESSION_SECRET is exactly 32 characters and returns a config with password set', async () => {
    const secret = 'a'.repeat(32)
    process.env.SESSION_SECRET = secret
    expect(() => getSessionConfig()).not.toThrow()
    const config = getSessionConfig()
    expect(config.password).toBe(secret)
  })

  it('returns a config that spreads SESSION_CONFIG_BASE', async () => {
    process.env.SESSION_SECRET = 'x'.repeat(40)
    const config = getSessionConfig()
    expect(config.name).toBe(SESSION_CONFIG_BASE.name)
    expect(config.cookie).toEqual(SESSION_CONFIG_BASE.cookie)
  })
})

describe('getAppSession', () => {
  const original = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
    vi.useRealTimers()
  })

  it('returns empty data and does not set a cookie when there is no cookie', async () => {
    getCookieMock.mockReturnValue(undefined)

    const session = await getAppSession()

    expect(session.data).toEqual({})
    expect(setCookieMock).not.toHaveBeenCalled()
  })

  it('returns the stored data for a valid cookie', async () => {
    const stored: StoredSession<SessionData> = {
      id: 'existing-id',
      createdAt: Date.now(),
      data: {
        sub: 'google-sub-1',
        firstName: 'Ada',
        email: 'ada@example.com',
        avatarUrl: '',
      },
    }
    getCookieMock.mockReturnValue(await sealTestSession(stored))

    const session = await getAppSession()

    expect(session.data).toEqual(stored.data)
    expect(setCookieMock).not.toHaveBeenCalled()
  })

  it('returns empty data for a garbage cookie', async () => {
    getCookieMock.mockReturnValue('not-a-valid-sealed-value')

    const session = await getAppSession()

    expect(session.data).toEqual({})
  })

  it('returns empty data once createdAt has aged past maxAge', async () => {
    const createdAt = 1_700_000_000_000
    const stored: StoredSession<SessionData> = {
      id: 'expiring-id',
      createdAt,
      data: { sub: 'google-sub-1' },
    }
    getCookieMock.mockReturnValue(await sealTestSession(stored))

    vi.useFakeTimers()
    vi.setSystemTime(createdAt + SESSION_MAX_AGE_SECONDS * 1000 + 1)

    const session = await getAppSession()

    expect(session.data).toEqual({})
  })

  it('update() on an empty session sets a cookie that round-trips and carries the merged data', async () => {
    getCookieMock.mockReturnValue(undefined)

    const now = 1_700_000_100_000
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const session = await getAppSession()
    await session.update({ sub: 'new-sub', firstName: 'Grace' })

    expect(setCookieMock).toHaveBeenCalledTimes(1)
    const [name, value, options] = setCookieMock.mock.calls[0] as [
      string,
      string,
      { httpOnly: boolean; sameSite: string; path: string; expires: Date },
    ]

    expect(name).toBe('google-sso')
    expect(value.startsWith('Fe26.2**')).toBe(true)
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
    expect(options.expires).toEqual(
      new Date(now + SESSION_MAX_AGE_SECONDS * 1000),
    )

    const roundTripped = await unsealStoredSession<SessionData>(
      value,
      TEST_SECRET,
      SESSION_MAX_AGE_SECONDS,
      now,
    )
    expect(roundTripped?.data).toEqual({
      sub: 'new-sub',
      firstName: 'Grace',
    })
    expect(roundTripped?.createdAt).toBe(now)
  })

  it('update() on an existing session preserves id/createdAt and merges data', async () => {
    const createdAt = 1_700_000_000_000
    const stored: StoredSession<SessionData> = {
      id: 'preserved-id',
      createdAt,
      data: { sub: 'original-sub', firstName: 'Ada' },
    }
    getCookieMock.mockReturnValue(await sealTestSession(stored))

    vi.useFakeTimers()
    vi.setSystemTime(createdAt + 500)

    const session = await getAppSession()
    await session.update({ firstName: 'Updated' })

    const [, value] = setCookieMock.mock.calls[0] as [string, string]
    const roundTripped = await unsealStoredSession<SessionData>(
      value,
      TEST_SECRET,
      SESSION_MAX_AGE_SECONDS,
      createdAt + 500,
    )

    expect(roundTripped?.id).toBe('preserved-id')
    expect(roundTripped?.createdAt).toBe(createdAt)
    expect(roundTripped?.data).toEqual({
      sub: 'original-sub',
      firstName: 'Updated',
    })
  })

  it('clear() clears the cookie', async () => {
    getCookieMock.mockReturnValue(undefined)

    const session = await getAppSession()
    await session.clear()

    expect(deleteCookieMock).toHaveBeenCalledTimes(1)
  })
})

describe('startNewAppSession', () => {
  const original = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
    vi.useRealTimers()
  })

  it('ignores an existing cookie and starts a fresh session with a new id and createdAt = now', async () => {
    const existing: StoredSession<SessionData> = {
      id: 'old-id',
      createdAt: 1_000_000_000_000,
      data: { sub: 'old-sub' },
    }
    getCookieMock.mockReturnValue(await sealTestSession(existing))

    const now = 1_700_000_200_000
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const newData: SessionData = {
      sub: 'fresh-sub',
      firstName: 'Fresh',
      email: 'fresh@example.com',
      avatarUrl: '',
    }
    await startNewAppSession(newData)

    expect(setCookieMock).toHaveBeenCalledTimes(1)
    const [, value, options] = setCookieMock.mock.calls[0] as [
      string,
      string,
      { expires: Date },
    ]

    const roundTripped = await unsealStoredSession<SessionData>(
      value,
      TEST_SECRET,
      SESSION_MAX_AGE_SECONDS,
      now,
    )

    expect(roundTripped?.id).not.toBe('old-id')
    expect(roundTripped?.createdAt).toBe(now)
    expect(roundTripped?.data).toEqual(newData)
    expect(options.expires).toEqual(
      new Date(now + SESSION_MAX_AGE_SECONDS * 1000),
    )
  })
})

describe('clearAppSession', () => {
  const original = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
  })

  it('calls deleteCookie with the session cookie name and cookie options', async () => {
    await clearAppSession()

    expect(deleteCookieMock).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      SESSION_CONFIG_BASE.cookie,
    )
  })
})

describe('requireSession', () => {
  const original = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
  })

  it('throws Unauthorized when there is no sub', async () => {
    getCookieMock.mockReturnValue(undefined)

    await expect(requireSession()).rejects.toThrow('Unauthorized')
  })

  it('returns the sub when the session has one', async () => {
    const stored: StoredSession<SessionData> = {
      id: 'id-1',
      createdAt: Date.now(),
      data: { sub: 'the-sub' },
    }
    getCookieMock.mockReturnValue(await sealTestSession(stored))

    await expect(requireSession()).resolves.toBe('the-sub')
  })
})

describe('resolveIsAuthenticated', () => {
  const original = process.env.SESSION_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
  })

  it('returns false when SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET

    await expect(resolveIsAuthenticated()).resolves.toBe(false)
  })

  it('returns true when the session has a sub', async () => {
    process.env.SESSION_SECRET = TEST_SECRET
    const stored: StoredSession<SessionData> = {
      id: 'id-2',
      createdAt: Date.now(),
      data: { sub: 'authed-sub' },
    }
    getCookieMock.mockReturnValue(await sealTestSession(stored))

    await expect(resolveIsAuthenticated()).resolves.toBe(true)
  })

  it('returns false when there is no sub', async () => {
    process.env.SESSION_SECRET = TEST_SECRET
    getCookieMock.mockReturnValue(undefined)

    await expect(resolveIsAuthenticated()).resolves.toBe(false)
  })
})
