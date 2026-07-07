import { describe, it, expect } from 'vitest'
import { isTestAuthEnabled } from './test-auth-guard'

describe('isTestAuthEnabled', () => {
  it('returns true when E2E_TEST is exactly "true"', () => {
    expect(isTestAuthEnabled('true')).toBe(true)
  })
  it('returns false when the value is undefined', () => {
    expect(isTestAuthEnabled(undefined)).toBe(false)
  })
  it('returns false for "false"', () => {
    expect(isTestAuthEnabled('false')).toBe(false)
  })
  it('returns false for "TRUE" (case-sensitive)', () => {
    expect(isTestAuthEnabled('TRUE')).toBe(false)
  })
  it('returns false for an empty string', () => {
    expect(isTestAuthEnabled('')).toBe(false)
  })
  it('returns false for "1"', () => {
    expect(isTestAuthEnabled('1')).toBe(false)
  })
})
