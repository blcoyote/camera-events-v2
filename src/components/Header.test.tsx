import { describe, expect, it } from 'vitest'
import { getHeaderAuthState } from './Header'
import type { SessionData } from '../server/session'

describe('getHeaderAuthState', () => {
  it('returns showSignIn true and no user info when user is null', () => {
    const state = getHeaderAuthState(null)

    expect(state.showSignIn).toBe(true)
    expect(state.userName).toBeNull()
    expect(state.avatarUrl).toBeNull()
    expect(state.initials).toBeNull()
    expect(state.signInHref).toBe('/api/auth/google')
  })

  it('returns user info with avatar when logged in', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'John',
      email: 'john@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
    }
    const state = getHeaderAuthState(user)

    expect(state.showSignIn).toBe(false)
    expect(state.userName).toBe('John')
    expect(state.avatarUrl).toBe('https://example.com/avatar.jpg')
    expect(state.initials).toBe('J')
    expect(state.signOutAction).toBe('/api/auth/logout')
  })

  it('returns initials fallback when avatarUrl is empty', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'Jane',
      email: 'jane@example.com',
      avatarUrl: '',
    }
    const state = getHeaderAuthState(user)

    expect(state.avatarUrl).toBe('')
    expect(state.initials).toBe('J')
  })

  it('returns "?" initials when firstName is empty', () => {
    const user: SessionData = {
      sub: '123',
      firstName: '',
      email: 'anon@example.com',
      avatarUrl: '',
    }
    const state = getHeaderAuthState(user)

    expect(state.initials).toBe('?')
  })

  it('returns no nav links when unauthenticated', () => {
    const state = getHeaderAuthState(null)
    expect(state.navLinks).toEqual([])
  })

  it('returns Camera Events and Settings nav links when authenticated', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'Jane',
      email: 'jane@example.com',
      avatarUrl: '',
    }
    const state = getHeaderAuthState(user)
    expect(state.navLinks).toEqual([
      { label: 'Camera Events', to: '/camera-events' },
      { label: 'Settings', to: '/settings' },
    ])
  })
})
