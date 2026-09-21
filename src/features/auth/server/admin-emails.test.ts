import { describe, expect, it } from 'vitest'
import { parseAdminEmails, isAdminEmail } from './admin-emails'

describe('parseAdminEmails', () => {
  it('returns an empty array for undefined', () => {
    expect(parseAdminEmails(undefined)).toEqual([])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseAdminEmails('')).toEqual([])
  })

  it('returns an empty array for a whitespace-only string', () => {
    expect(parseAdminEmails('   ')).toEqual([])
  })

  it('splits on commas', () => {
    expect(parseAdminEmails('a@x.com,b@y.com')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('trims surrounding whitespace on each entry', () => {
    expect(parseAdminEmails(' a@x.com , b@y.com ')).toEqual([
      'a@x.com',
      'b@y.com',
    ])
  })

  it('lowercases every entry', () => {
    expect(parseAdminEmails('Admin@X.COM')).toEqual(['admin@x.com'])
  })

  it('drops empty segments from stray/trailing commas', () => {
    expect(parseAdminEmails('a@x.com,,b@y.com,')).toEqual([
      'a@x.com',
      'b@y.com',
    ])
  })

  it('de-duplicates, preserving first-seen order', () => {
    expect(parseAdminEmails('a@x.com,A@X.com')).toEqual(['a@x.com'])
  })
})

describe('isAdminEmail', () => {
  it('returns true for an exact match', () => {
    expect(isAdminEmail('admin@x.com', ['admin@x.com'])).toBe(true)
  })

  it('is case-insensitive on the input email', () => {
    expect(isAdminEmail('Admin@X.com', ['admin@x.com'])).toBe(true)
  })

  it('trims the input email before comparing', () => {
    expect(isAdminEmail('  admin@x.com  ', ['admin@x.com'])).toBe(true)
  })

  it('returns false for an empty allowlist', () => {
    expect(isAdminEmail('admin@x.com', [])).toBe(false)
  })

  it('returns false when the allowlist contains only an empty string', () => {
    expect(isAdminEmail('admin@x.com', [''])).toBe(false)
  })

  it('returns false for an empty input email', () => {
    expect(isAdminEmail('', ['admin@x.com'])).toBe(false)
  })

  it('returns false for a whitespace-only input email', () => {
    expect(isAdminEmail('   ', ['admin@x.com'])).toBe(false)
  })

  it('returns false for a whitespace-only input email even when the allowlist contains an empty string', () => {
    expect(isAdminEmail('   ', [''])).toBe(false)
  })

  it('returns false for a non-matching email', () => {
    expect(isAdminEmail('someone-else@x.com', ['admin@x.com'])).toBe(false)
  })

  it('does not match on a prefixed substring', () => {
    expect(isAdminEmail('evil-admin@x.com', ['admin@x.com'])).toBe(false)
  })

  it('does not match on a suffixed/domain-wildcard substring', () => {
    expect(isAdminEmail('admin@x.com.evil.com', ['admin@x.com'])).toBe(false)
  })
})
