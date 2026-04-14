import { describe, expect, it } from 'vitest'
import { getHeaderAuthState } from './Header'
import type { SessionData } from '../server/session'

describe('getHeaderAuthState', () => {
  it('returns showSignIn true and no userName when user is null', () => {
    const state = getHeaderAuthState(null)

    expect(state.showSignIn).toBe(true)
    expect(state.userName).toBeNull()
    expect(state.signInHref).toBe('/api/auth/google')
  })

  it('returns showSignIn false and userName when logged in', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'John',
      email: 'john@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
    }
    const state = getHeaderAuthState(user)

    expect(state.showSignIn).toBe(false)
    expect(state.userName).toBe('John')
    expect(state.signOutAction).toBe('/api/auth/logout')
  })

  it('returns only Home nav link when unauthenticated', () => {
    const state = getHeaderAuthState(null)
    expect(state.navLinks).toEqual([
      { label: 'Home', to: '/' },
    ])
  })

  it('returns Home, Camera Events, and Settings nav links when authenticated', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'Jane',
      email: 'jane@example.com',
      avatarUrl: '',
    }
    const state = getHeaderAuthState(user)
    expect(state.navLinks).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Camera Events', to: '/camera-events' },
      { label: 'Settings', to: '/settings' },
    ])
  })
})
