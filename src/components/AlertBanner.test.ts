import { describe, expect, it } from 'vitest'
import { getAlertMessage } from './AlertBanner'

describe('getAlertMessage', () => {
  it('returns login_failed error message', () => {
    const result = getAlertMessage('login_failed', undefined)
    expect(result).not.toBeNull()
    expect(result!.text).toBe(
      'Something went wrong during sign-in. Please try again.',
    )
    expect(result!.type).toBe('error')
  })

  it('returns access_denied error message', () => {
    const result = getAlertMessage('access_denied', undefined)
    expect(result).not.toBeNull()
    expect(result!.text).toBe('You declined the Google sign-in request.')
    expect(result!.type).toBe('error')
  })

  it('returns invalid_state error message', () => {
    const result = getAlertMessage('invalid_state', undefined)
    expect(result).not.toBeNull()
    expect(result!.text).toBe(
      'Something went wrong during sign-in. Please try again.',
    )
    expect(result!.type).toBe('error')
  })

  it('returns logged_out success message', () => {
    const result = getAlertMessage(undefined, 'logged_out')
    expect(result).not.toBeNull()
    expect(result!.text).toBe('You have been signed out.')
    expect(result!.type).toBe('success')
  })

  it('returns null when no error or status', () => {
    const result = getAlertMessage(undefined, undefined)
    expect(result).toBeNull()
  })

  it('returns null for unknown error codes', () => {
    const result = getAlertMessage('unknown_error', undefined)
    expect(result).toBeNull()
  })

  it('prioritizes error over status with correct text', () => {
    const result = getAlertMessage('access_denied', 'logged_out')
    expect(result!.type).toBe('error')
    expect(result!.text).toBe('You declined the Google sign-in request.')
  })
})
