import { describe, expect, it } from 'vitest'
import { getFrontPageContent } from './index'
import type { SessionData } from '../server/session'

describe('getFrontPageContent', () => {
  it('returns login CTA when user is null', () => {
    const content = getFrontPageContent(null)
    expect(content.ctaText).toBe('Sign in with Google')
    expect(content.ctaHref).toBe('/api/auth/google')
    expect(content.welcomeText).toBeNull()
  })

  it('returns camera events CTA when user is authenticated', () => {
    const user: SessionData = {
      sub: '123',
      firstName: 'John',
      email: 'john@example.com',
      avatarUrl: '',
    }
    const content = getFrontPageContent(user)
    expect(content.ctaText).toBe('Go to Camera Events')
    expect(content.ctaHref).toBe('/camera-events')
    expect(content.welcomeText).toBe('Welcome back, John.')
  })

  it('returns generic welcome when firstName is empty', () => {
    const user: SessionData = {
      sub: '123',
      firstName: '',
      email: 'anon@example.com',
      avatarUrl: '',
    }
    const content = getFrontPageContent(user)
    expect(content.welcomeText).toBe('Welcome back.')
    expect(content.ctaHref).toBe('/camera-events')
  })
})
