import { afterEach, describe, expect, it } from 'vitest'
import { withLocale } from '#/test-utils/locale'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  let restore: (() => void) | undefined
  afterEach(() => restore?.())

  it('translates a known code in English', () => {
    restore = withLocale('en')
    expect(errorMessage('push_not_configured')).toBe(
      'Push notifications are not configured',
    )
  })

  it('translates a known code in Danish', () => {
    restore = withLocale('da')
    expect(errorMessage('forbidden')).toBe('Ingen adgang')
  })

  it('falls back to the unknown message for an unknown code', () => {
    restore = withLocale('en')
    expect(errorMessage('nope')).toBe('Something went wrong')
  })

  it('falls back to the unknown message for undefined', () => {
    restore = withLocale('en')
    expect(errorMessage(undefined)).toBe('Something went wrong')
  })
})
