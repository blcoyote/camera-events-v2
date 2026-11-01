import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './eventFormatting'

describe('formatRelativeTime', () => {
  it('measures against the supplied clock instead of Date.now()', () => {
    const start = 1_700_000_000
    const nowMs = (start + 2 * 3600) * 1000
    expect(formatRelativeTime(start, nowMs)).toMatch(/2|two/i)
    expect(formatRelativeTime(start, start * 1000)).not.toMatch(/2/)
  })
})
