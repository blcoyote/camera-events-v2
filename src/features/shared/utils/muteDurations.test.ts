import { describe, it, expect } from 'vitest'
import {
  MUTE_DURATION_OPTIONS,
  MAX_MUTE_DURATION_MS,
  DEFAULT_MUTE_DURATION_MS,
  isValidMuteDurationMs,
  muteDurationLabel,
} from './muteDurations'

describe('MUTE_DURATION_OPTIONS', () => {
  it('starts with the zero option, which is the default', () => {
    expect(MUTE_DURATION_OPTIONS[0].ms).toBe(0)
    expect(DEFAULT_MUTE_DURATION_MS).toBe(0)
  })

  it('scales up to six hours', () => {
    const last = MUTE_DURATION_OPTIONS[MUTE_DURATION_OPTIONS.length - 1]
    expect(last.ms).toBe(6 * 60 * 60 * 1000)
  })

  it('is sorted ascending with no duplicates', () => {
    const values = MUTE_DURATION_OPTIONS.map((o) => o.ms)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  it('gives every option a non-empty label', () => {
    for (const option of MUTE_DURATION_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0)
    }
  })
})

describe('MAX_MUTE_DURATION_MS', () => {
  it('equals the largest offered option', () => {
    const largest = Math.max(...MUTE_DURATION_OPTIONS.map((o) => o.ms))
    expect(MAX_MUTE_DURATION_MS).toBe(largest)
  })

  it('is six hours', () => {
    expect(MAX_MUTE_DURATION_MS).toBe(21_600_000)
  })
})

describe('isValidMuteDurationMs', () => {
  it('accepts every offered option, including zero', () => {
    for (const option of MUTE_DURATION_OPTIONS) {
      expect(isValidMuteDurationMs(option.ms)).toBe(true)
    }
  })

  it('rejects a duration that is not on the ladder', () => {
    expect(isValidMuteDurationMs(7 * 60 * 1000)).toBe(false)
  })

  it('rejects a duration beyond the maximum', () => {
    expect(isValidMuteDurationMs(MAX_MUTE_DURATION_MS + 1)).toBe(false)
    expect(isValidMuteDurationMs(24 * 60 * 60 * 1000)).toBe(false)
  })

  it('rejects negative values', () => {
    expect(isValidMuteDurationMs(-1)).toBe(false)
    expect(isValidMuteDurationMs(-600_000)).toBe(false)
  })

  it('rejects non-numeric and non-finite values', () => {
    expect(isValidMuteDurationMs('600000')).toBe(false)
    expect(isValidMuteDurationMs(null)).toBe(false)
    expect(isValidMuteDurationMs(undefined)).toBe(false)
    expect(isValidMuteDurationMs(NaN)).toBe(false)
    expect(isValidMuteDurationMs(Infinity)).toBe(false)
    expect(isValidMuteDurationMs({})).toBe(false)
  })
})

describe('muteDurationLabel', () => {
  it('returns the label for an offered duration', () => {
    expect(muteDurationLabel(60 * 60 * 1000)).toBe('1 hour')
    expect(muteDurationLabel(6 * 60 * 60 * 1000)).toBe('6 hours')
  })

  it('returns null for a duration that is not on the ladder', () => {
    expect(muteDurationLabel(7 * 60 * 1000)).toBeNull()
  })
})
