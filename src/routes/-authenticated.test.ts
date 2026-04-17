import { describe, expect, it } from 'vitest'
import { getAuthRedirect } from './_authenticated'
import type { SessionData } from '#/features/shared/server/session'

describe('getAuthRedirect', () => {
  it('returns null when user is present (no redirect needed)', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'John',
      email: 'john@example.com',
      avatarUrl: '',
    }
    expect(getAuthRedirect(user, '/camera-events')).toBeNull()
  })

  it('returns home page with returnTo when user is null', () => {
    expect(getAuthRedirect(null, '/camera-events')).toBe(
      '/?returnTo=%2Fcamera-events',
    )
  })

  it('handles dynamic paths in returnTo', () => {
    expect(getAuthRedirect(null, '/camera-events/abc-123')).toBe(
      '/?returnTo=%2Fcamera-events%2Fabc-123',
    )
  })

  it('handles /settings path', () => {
    expect(getAuthRedirect(null, '/settings')).toBe('/?returnTo=%2Fsettings')
  })
})
