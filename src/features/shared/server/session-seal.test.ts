import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStoredSession,
  sealStoredSession,
  unsealStoredSession,
} from './session-seal'
import type { StoredSession } from './session-seal'

const TEST_PASSWORD = 'test-session-secret-at-least-32-characters-long'
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

/**
 * Sealed by the legacy h3/iron-webcrypto session implementation with
 * `password = TEST_PASSWORD` and the production `maxAge = 30 days`, while
 * `Date.now()` was pinned to `H3_FIXTURE_CREATED_AT` (so iron's own
 * `ttl = maxAge * 1000` embeds an expiration of `createdAt + 30 days`,
 * matching what real production cookies carry). Used to prove our
 * reimplementation stays byte-compatible with existing user cookies, and
 * that they unseal rather than silently logging everyone out.
 */
const H3_FIXTURE_SEALED =
  'Fe26.2**3ada362d64655846b1dd40daf80eb0d779a88b368e99956ba52692da07495803*sSNgw8zrDlRGPDYzTZ8axQ*FmrCKTSvgj4q10HDub2x-q945I_sWBxL6WYKcUyuoBz93fZQregNkK9nKtI73q1Lb62XsI6y1n3GD8Ikpc2K7NlmdOlEz9NPtZ-58YNFewzv7Y0Bqt46aVnP2m7zfmeiu1XwOE6AJAruK5ZEFdfnjkWe7YPT6QYK2sQcbNUJUn8XxUqWwAyz-Fjgw7rocuyBVX3NVG9UoVKaKvIUc4ClXssFA-jpf0tquk3ZhXEYwdg*1792592000000*a098140f09004ad19b56a1746a8019accee8154e1609781ff0ea721df9ecfc40*3mVa3OFIQdTI1soIJZlkY0r1pJ2bf-wHjokDeh8QMAg'

const H3_FIXTURE_CREATED_AT = 1790000000000

type FixtureData = {
  sub: string
  firstName: string
  email: string
  avatarUrl: string
}

describe('unsealStoredSession', () => {
  describe('legacy h3 fixture (production 30-day maxAge)', () => {
    // iron-webcrypto validates its own embedded expiration against the real
    // clock (Date.now()), independent of the `nowMs` argument passed to
    // unsealStoredSession — so the system clock must be pinned to the same
    // instant used as `nowMs` for these assertions to be meaningful.
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('unseals a legacy h3/iron cookie byte-for-byte compatibly', async () => {
      vi.setSystemTime(H3_FIXTURE_CREATED_AT + 1000)

      const result = await unsealStoredSession<FixtureData>(
        H3_FIXTURE_SEALED,
        TEST_PASSWORD,
        THIRTY_DAYS_SECONDS,
        H3_FIXTURE_CREATED_AT + 1000,
      )

      expect(result).toEqual({
        id: '00000000-0000-4000-8000-000000000001',
        createdAt: H3_FIXTURE_CREATED_AT,
        data: {
          sub: 'google-sub-123',
          firstName: 'Ada',
          email: 'ada@example.com',
          avatarUrl: '',
        },
      })
    })

    it('returns null once the stored maxAge has elapsed since createdAt', async () => {
      const nowMs = H3_FIXTURE_CREATED_AT + THIRTY_DAYS_SECONDS * 1000 + 1
      vi.setSystemTime(nowMs)

      const result = await unsealStoredSession<FixtureData>(
        H3_FIXTURE_SEALED,
        TEST_PASSWORD,
        THIRTY_DAYS_SECONDS,
        nowMs,
      )

      expect(result).toBeNull()
    })

    it('returns null for the wrong password', async () => {
      vi.setSystemTime(H3_FIXTURE_CREATED_AT + 1000)

      const result = await unsealStoredSession<FixtureData>(
        H3_FIXTURE_SEALED,
        'a-completely-different-password-of-32-chars-plus',
        THIRTY_DAYS_SECONDS,
        H3_FIXTURE_CREATED_AT + 1000,
      )

      expect(result).toBeNull()
    })

    it('returns null when the sealed value has been tampered with', async () => {
      vi.setSystemTime(H3_FIXTURE_CREATED_AT + 1000)

      const midpoint = Math.floor(H3_FIXTURE_SEALED.length / 2)
      const tamperedChar = H3_FIXTURE_SEALED[midpoint] === 'a' ? 'b' : 'a'
      const tampered =
        H3_FIXTURE_SEALED.slice(0, midpoint) +
        tamperedChar +
        H3_FIXTURE_SEALED.slice(midpoint + 1)

      const result = await unsealStoredSession<FixtureData>(
        tampered,
        TEST_PASSWORD,
        THIRTY_DAYS_SECONDS,
        H3_FIXTURE_CREATED_AT + 1000,
      )

      expect(result).toBeNull()
    })
  })

  it('returns null for a garbage string', async () => {
    const result = await unsealStoredSession<FixtureData>(
      'not-a-sealed-value-at-all',
      TEST_PASSWORD,
      THIRTY_DAYS_SECONDS,
    )

    expect(result).toBeNull()
  })

  it('round-trips a freshly sealed session', async () => {
    const session: StoredSession<FixtureData> = {
      id: 'round-trip-id',
      createdAt: 1000,
      data: { sub: 'abc' },
    }

    const sealed = await sealStoredSession(session, TEST_PASSWORD, 100)
    const result = await unsealStoredSession<FixtureData>(
      sealed,
      TEST_PASSWORD,
      100,
      1500,
    )

    expect(result).toEqual(session)
  })
})

describe('sealStoredSession', () => {
  it('produces an Fe26.2-prefixed iron seal', async () => {
    const session: StoredSession<FixtureData> = {
      id: 'some-id',
      createdAt: 0,
      data: {},
    }

    const sealed = await sealStoredSession(session, TEST_PASSWORD, 100)

    expect(sealed.startsWith('Fe26.2**')).toBe(true)
  })
})

describe('createStoredSession', () => {
  it('creates a session with a random id, the given createdAt, and empty data', () => {
    const session = createStoredSession<FixtureData>(12345)

    expect(session.createdAt).toBe(12345)
    expect(session.data).toEqual({})
    expect(session.id).toEqual(expect.any(String))
    expect(session.id.length).toBeGreaterThan(0)
  })

  it('defaults createdAt to Date.now() when omitted', () => {
    const before = Date.now()
    const session = createStoredSession<FixtureData>()
    const after = Date.now()

    expect(session.createdAt).toBeGreaterThanOrEqual(before)
    expect(session.createdAt).toBeLessThanOrEqual(after)
  })

  it('generates distinct ids across calls', () => {
    const a = createStoredSession<FixtureData>()
    const b = createStoredSession<FixtureData>()

    expect(a.id).not.toBe(b.id)
  })
})
