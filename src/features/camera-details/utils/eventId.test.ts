import { describe, it, expect } from 'vitest'
import { parseEventStartTimeMs } from './eventId'

describe('parseEventStartTimeMs', () => {
  it('reads the epoch-seconds prefix of a Frigate event ID', () => {
    expect(parseEventStartTimeMs('1713182400.123456-abcdef')).toBe(
      1713182400123.456,
    )
  })

  it('reads an ID whose start time has no fractional part', () => {
    expect(parseEventStartTimeMs('1713182400-abcdef')).toBe(1713182400000)
  })

  it('returns null when the ID has no random suffix', () => {
    expect(parseEventStartTimeMs('1713182400.123456')).toBeNull()
  })

  it('returns null when the prefix is not a number', () => {
    expect(parseEventStartTimeMs('notatime-abcdef')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseEventStartTimeMs('')).toBeNull()
  })

  it('returns null for a non-positive start time', () => {
    expect(parseEventStartTimeMs('0-abcdef')).toBeNull()
    expect(parseEventStartTimeMs('-5-abcdef')).toBeNull()
  })
})
