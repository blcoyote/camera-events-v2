import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatTime,
  intlLocale,
} from './intl'

const CET = 1793412744 // 2026-10-31 02:12:24 UTC
const CEST = 1784109624 // 2026-07-15 10:00:24 UTC

describe('intl formatting', () => {
  it('maps app locales to Intl locales', () => {
    expect(intlLocale('en')).toBe('en-GB')
    expect(intlLocale('da')).toBe('da-DK')
  })

  it('formats time in Copenhagen, 24h, regardless of machine TZ', () => {
    expect(formatTime(CET, 'en')).toBe('03:12')
    expect(formatTime(CET, 'da')).toBe('03.12')
    expect(formatTime(CEST, 'en')).toBe('12:00')
    expect(formatTime(CEST, 'da')).toBe('12.00')
  })

  it('formats date with day before month', () => {
    expect(formatDate(CET, 'en')).toContain('31 Oct')
    expect(formatDate(CET, 'da')).toContain('31. okt.')
  })

  it('formats date and time', () => {
    expect(formatDateTime(CET, 'en')).toContain('03:12')
  })

  it('formats percent', () => {
    expect(formatPercent(0.87, 'en')).toBe('87%')
    expect(formatPercent(0.87, 'da')).toMatch(/^87\s%$/)
  })
})
