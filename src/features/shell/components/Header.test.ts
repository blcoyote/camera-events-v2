import { describe, it, expect } from 'vitest'
import { getHeaderAuthState } from './Header'
import type { SessionData } from '#/features/shared/server/session'

function makeUser(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sub: 'google-sub-123',
    firstName: 'Alice',
    email: 'alice@example.com',
    avatarUrl: 'https://example.com/avatar.png',
    ...overrides,
  }
}

describe('getHeaderAuthState', () => {
  it('returns showSignIn=true and empty navLinks when user is null', () => {
    const state = getHeaderAuthState(null)
    expect(state.showSignIn).toBe(true)
    expect(state.navLinks).toEqual([])
  })

  it('returns null userName and avatarUrl when user is null', () => {
    const state = getHeaderAuthState(null)
    expect(state.userName).toBeNull()
    expect(state.avatarUrl).toBeNull()
  })

  it('returns showSignIn=false and 5 nav links when user is present', () => {
    const state = getHeaderAuthState(makeUser())
    expect(state.showSignIn).toBe(false)
    expect(state.navLinks).toHaveLength(5)
  })

  it('navLinks contains entries for /dashboard, /cameras, /camera-events, /favorites, /settings', () => {
    const state = getHeaderAuthState(makeUser())
    const targets = state.navLinks.map((link) => link.to)
    expect(targets).toEqual([
      '/dashboard',
      '/cameras',
      '/camera-events',
      '/favorites',
      '/settings',
    ])
  })

  it('initials is first char of firstName uppercased', () => {
    const state = getHeaderAuthState(makeUser({ firstName: 'alice' }))
    expect(state.initials).toBe('A')
  })

  it("initials is '?' when firstName is empty string", () => {
    const state = getHeaderAuthState(makeUser({ firstName: '' }))
    expect(state.initials).toBe('?')
  })

  it('signInHref is /api/auth/google', () => {
    const state = getHeaderAuthState(null)
    expect(state.signInHref).toBe('/api/auth/google')
  })

  it('signOutAction is /api/auth/logout', () => {
    const state = getHeaderAuthState(makeUser())
    expect(state.signOutAction).toBe('/api/auth/logout')
  })

  it('mobileTopLinks is empty when user is null', () => {
    const state = getHeaderAuthState(null)
    expect(state.mobileTopLinks).toEqual([])
  })

  it('mobileTopLinks contains /cameras and /camera-events when user is present', () => {
    const state = getHeaderAuthState(makeUser())
    const targets = state.mobileTopLinks.map((l) => l.to)
    expect(targets).toContain('/cameras')
    expect(targets).toContain('/camera-events')
  })

  it('mobileTopLinks has Cameras before Events', () => {
    const state = getHeaderAuthState(makeUser())
    const labels = state.mobileTopLinks.map((l) => l.label)
    expect(labels.indexOf('Cameras')).toBeLessThan(labels.indexOf('Events'))
  })
})
