import { describe, it, expect } from 'vitest'
import {
  formatUptime,
  formatStorageMb,
  formatPct,
  formatDayLabel,
} from './format'

describe('formatUptime', () => {
  it('returns "<1m" for durations under a minute', () => {
    expect(formatUptime(0)).toBe('<1m')
    expect(formatUptime(59)).toBe('<1m')
  })

  it('returns minutes only under an hour', () => {
    expect(formatUptime(60)).toBe('1m')
    expect(formatUptime(3599)).toBe('59m')
  })

  it('returns hours and minutes under a day', () => {
    expect(formatUptime(3600)).toBe('1h')
    expect(formatUptime(3660)).toBe('1h 1m')
    expect(formatUptime(7320)).toBe('2h 2m')
  })

  it('returns days and hours over a day, omitting zero hours', () => {
    expect(formatUptime(86400)).toBe('1d')
    expect(formatUptime(90000)).toBe('1d 1h')
    expect(formatUptime(864000)).toBe('10d')
  })

  it('handles non-finite input safely', () => {
    expect(formatUptime(NaN)).toBe('<1m')
  })
})

describe('formatStorageMb', () => {
  it('returns "0 MB" for zero or negative input', () => {
    expect(formatStorageMb(0)).toBe('0 MB')
    expect(formatStorageMb(-5)).toBe('0 MB')
  })

  it('formats sub-gigabyte values as rounded MB', () => {
    expect(formatStorageMb(200)).toBe('200 MB')
    expect(formatStorageMb(512.6)).toBe('513 MB')
  })

  it('formats gigabyte values with one decimal', () => {
    expect(formatStorageMb(1024)).toBe('1.0 GB')
    expect(formatStorageMb(1536)).toBe('1.5 GB')
  })

  it('formats terabyte values with one decimal', () => {
    expect(formatStorageMb(1024 * 1024)).toBe('1.0 TB')
    expect(formatStorageMb(1.5 * 1024 * 1024)).toBe('1.5 TB')
  })
})

describe('formatPct', () => {
  it('rounds to a whole percentage', () => {
    expect(formatPct(0)).toBe('0%')
    expect(formatPct(50)).toBe('50%')
    expect(formatPct(33.333)).toBe('33%')
    expect(formatPct(99.6)).toBe('100%')
  })

  it('handles non-finite input safely', () => {
    expect(formatPct(NaN)).toBe('0%')
  })
})

describe('formatDayLabel', () => {
  it('formats a YYYY-MM-DD key as "Mon D"', () => {
    expect(formatDayLabel('2026-06-30')).toBe('Jun 30')
    expect(formatDayLabel('2026-01-05')).toBe('Jan 5')
    expect(formatDayLabel('2026-12-25')).toBe('Dec 25')
  })

  it('returns the raw input for malformed keys', () => {
    expect(formatDayLabel('not-a-date')).toBe('not-a-date')
    expect(formatDayLabel('2026-13-01')).toBe('2026-13-01')
  })
})
