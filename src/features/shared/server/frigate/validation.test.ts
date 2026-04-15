import { describe, expect, it } from 'vitest'
import { isValidCameraName } from './validation'

describe('isValidCameraName', () => {
  it('returns true for simple lowercase name', () => {
    expect(isValidCameraName('backyard')).toBe(true)
  })

  it('returns true for name with underscores', () => {
    expect(isValidCameraName('front_door')).toBe(true)
  })

  it('returns true for name with hyphens', () => {
    expect(isValidCameraName('garage-cam')).toBe(true)
  })

  it('returns true for name with digits', () => {
    expect(isValidCameraName('cam2')).toBe(true)
  })

  it('returns true for name with uppercase', () => {
    expect(isValidCameraName('FrontDoor')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isValidCameraName('')).toBe(false)
  })

  it('returns false for path traversal with ../', () => {
    expect(isValidCameraName('../etc/passwd')).toBe(false)
  })

  it('returns false for path traversal with embedded ../', () => {
    expect(isValidCameraName('foo/../bar')).toBe(false)
  })

  it('returns false for bare ..', () => {
    expect(isValidCameraName('..')).toBe(false)
  })

  it('returns false for name containing forward slash', () => {
    expect(isValidCameraName('foo/bar')).toBe(false)
  })

  it('returns false for name containing backslash', () => {
    expect(isValidCameraName('foo\\bar')).toBe(false)
  })

  it('returns false for name containing null byte', () => {
    expect(isValidCameraName('cam\0era')).toBe(false)
  })

  it('returns false for name containing control characters', () => {
    expect(isValidCameraName('cam\x01era')).toBe(false)
  })

  it('returns false for name containing dots', () => {
    expect(isValidCameraName('cam.v2')).toBe(false)
  })

  it('returns false for name containing spaces', () => {
    expect(isValidCameraName('front door')).toBe(false)
  })
})
