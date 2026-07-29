import { describe, expect, it } from 'vitest'
import { SESSION_MAX_AGE_SECONDS, computeSessionExpiry } from './sessionTtl'

describe('SESSION_MAX_AGE_SECONDS', () => {
  it('is 30 days in seconds', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60)
  })
})

describe('computeSessionExpiry', () => {
  it('returns now plus the max age in milliseconds', () => {
    const now = 1_700_000_000_000
    expect(computeSessionExpiry(now)).toBe(now + SESSION_MAX_AGE_SECONDS * 1000)
  })

  it('returns a value 30 days ahead of the given instant', () => {
    const now = 1_700_000_000_000
    expect(computeSessionExpiry(now) - now).toBe(30 * 24 * 60 * 60 * 1000)
  })
})
