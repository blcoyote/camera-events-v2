import { describe, expect, it } from 'vitest'
import {
  createStoredSession,
  sealStoredSession,
  unsealStoredSession,
} from './session-seal'
import type { StoredSession } from './session-seal'

const TEST_PASSWORD = 'test-session-secret-at-least-32-characters-long'
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

/**
 * Sealed by the old h3/iron-webcrypto session implementation with
 * `password = TEST_PASSWORD` and iron `ttl = 0` (no iron-level expiry —
 * h3 relies entirely on its own maxAge check). Used to prove our
 * reimplementation stays byte-compatible with existing user cookies.
 */
const H3_FIXTURE_SEALED =
  'Fe26.2**2408add8e1e1eea0b1abeee3c882220514ff968f7f9a9169c3d79c1e7ae380a5*baZJzpguBTqhZun85g4H5Q*3QgP2mySSNlodk1UkT6z9acaQweKgTNmVpjc0KueZ3Pz9BFby4DSZyQLrZySkYBSJTT_Ih9VJtNCX9P3CIvw-ShYO0ba-XtZrHU6pfTZXiK-zC87cA_wovZ6LOKvkZ6EnEShXB-ndVUxt3YfiwFHIPHvpAz0kcaXIY0gpZI_oVfbubfFnyrU7LnsoN6plTuSLm7xAIq43HlxOJqgcgzvoqI0z-Fu9P36ae95uTvL0ig**49fd17bbe6ed16f1d3b2fd6ec837b8886ae5798cda80e51bd5c94b3e390a6de4*-CxwYVI7olYCYa7P3oP32KJXt7gPBfOKhDlb3BEPCHQ'

const H3_FIXTURE_CREATED_AT = 1790000000000

type FixtureData = {
  sub: string
  firstName: string
  email: string
  avatarUrl: string
}

describe('unsealStoredSession', () => {
  it('unseals a legacy h3/iron cookie byte-for-byte compatibly', async () => {
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
    const result = await unsealStoredSession<FixtureData>(
      H3_FIXTURE_SEALED,
      TEST_PASSWORD,
      THIRTY_DAYS_SECONDS,
      H3_FIXTURE_CREATED_AT + THIRTY_DAYS_SECONDS * 1000 + 1,
    )

    expect(result).toBeNull()
  })

  it('returns null for the wrong password', async () => {
    const result = await unsealStoredSession<FixtureData>(
      H3_FIXTURE_SEALED,
      'a-completely-different-password-of-32-chars-plus',
      THIRTY_DAYS_SECONDS,
      H3_FIXTURE_CREATED_AT + 1000,
    )

    expect(result).toBeNull()
  })

  it('returns null for a garbage string', async () => {
    const result = await unsealStoredSession<FixtureData>(
      'not-a-sealed-value-at-all',
      TEST_PASSWORD,
      THIRTY_DAYS_SECONDS,
    )

    expect(result).toBeNull()
  })

  it('returns null when the sealed value has been tampered with', async () => {
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
