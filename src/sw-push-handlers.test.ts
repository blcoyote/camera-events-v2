import { describe, it, expect } from 'vitest'
import {
  parsePushPayload,
  buildNotificationOptions,
  getNotificationClickUrl,
} from './sw-push-handlers'

describe('parsePushPayload', () => {
  it('parses a valid payload', () => {
    const result = parsePushPayload({
      title: 'Test',
      body: 'Hello world',
      url: '/camera-events/123',
    })
    expect(result).toMatchObject({
      title: 'Test',
      body: 'Hello world',
      url: '/camera-events/123',
    })
  })

  it('parses icon when provided', () => {
    const result = parsePushPayload({
      title: 'Test',
      body: 'body',
      url: '/',
      icon: '/logo192.png',
    })
    expect(result.icon).toBe('/logo192.png')
  })

  it('returns undefined icon when not provided', () => {
    const result = parsePushPayload({ title: 'Test', body: '', url: '/' })
    expect(result.icon).toBeUndefined()
  })

  it('returns defaults for null data', () => {
    const result = parsePushPayload(null)
    expect(result).toMatchObject({ title: 'Notification', body: '', url: '/' })
  })

  it('returns defaults for undefined data', () => {
    const result = parsePushPayload(undefined)
    expect(result).toMatchObject({ title: 'Notification', body: '', url: '/' })
  })

  it('returns defaults for non-object data', () => {
    const result = parsePushPayload('not an object')
    expect(result).toMatchObject({ title: 'Notification', body: '', url: '/' })
  })

  it('falls back individual fields to defaults when missing', () => {
    const result = parsePushPayload({ title: 'Only Title' })
    expect(result).toMatchObject({ title: 'Only Title', body: '', url: '/' })
  })

  it('falls back title to default when empty string', () => {
    const result = parsePushPayload({
      title: '',
      body: 'content',
      url: '/page',
    })
    expect(result.title).toBe('Notification')
  })

  it('falls back url to default when empty string', () => {
    const result = parsePushPayload({ title: 'T', body: 'B', url: '' })
    expect(result.url).toBe('/')
  })
})

describe('buildNotificationOptions', () => {
  it('builds options with body, icon, and data.url', () => {
    const result = buildNotificationOptions({
      title: 'Test',
      body: 'Hello',
      url: '/events/42',
    })
    expect(result).toEqual({
      body: 'Hello',
      icon: '/logo192.png',
      tag: 'camera-event',
      renotify: true,
      data: { url: '/events/42' },
    })
  })

  it('uses custom icon when provided', () => {
    const result = buildNotificationOptions({
      title: 'Test',
      body: 'Hello',
      url: '/events/42',
      icon: '/custom-icon.png',
    })
    expect(result.icon).toBe('/custom-icon.png')
  })

  it('falls back to default icon when icon is undefined', () => {
    const result = buildNotificationOptions({
      title: 'Test',
      body: 'Hello',
      url: '/',
      icon: undefined,
    })
    expect(result.icon).toBe('/logo192.png')
  })
})

describe('getNotificationClickUrl', () => {
  it('extracts url from notification data', () => {
    const result = getNotificationClickUrl({ url: '/camera-events/123' })
    expect(result).toBe('/camera-events/123')
  })

  it('returns "/" when data is null', () => {
    expect(getNotificationClickUrl(null)).toBe('/')
  })

  it('returns "/" when data is undefined', () => {
    expect(getNotificationClickUrl(undefined)).toBe('/')
  })

  it('returns "/" when data has no url property', () => {
    expect(getNotificationClickUrl({ other: 'value' })).toBe('/')
  })

  it('returns "/" when url is not a string', () => {
    expect(getNotificationClickUrl({ url: 42 })).toBe('/')
  })

  it('rejects absolute URLs (open redirect)', () => {
    expect(getNotificationClickUrl({ url: 'https://attacker.com' })).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(getNotificationClickUrl({ url: '//evil.com/path' })).toBe('/')
  })

  it('rejects backslash-based URLs', () => {
    expect(getNotificationClickUrl({ url: '/\\evil.com' })).toBe('/')
  })

  it('allows valid relative paths', () => {
    expect(getNotificationClickUrl({ url: '/events/42' })).toBe('/events/42')
    expect(getNotificationClickUrl({ url: '/' })).toBe('/')
  })
})
