import { describe, expect, it } from 'vitest'
import { getHomeRedirect } from './index'
import type { SessionData } from '#/features/shared/server/session'

describe('getHomeRedirect', () => {
  it('returns null when user is null (no redirect)', () => {
    expect(getHomeRedirect(null)).toBeNull()
  })

  it('returns /camera-events when user is authenticated', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'John',
      email: 'john@example.com',
      avatarUrl: '',
    }
    expect(getHomeRedirect(user)).toBe('/camera-events')
  })
})
