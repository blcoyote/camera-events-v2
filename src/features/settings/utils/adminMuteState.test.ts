import { describe, it, expect } from 'vitest'
import { getAdminMuteView, formatRemaining } from './adminMuteState'

describe('getAdminMuteView', () => {
  it('returns hidden when isAdmin is false, even with an active mute', () => {
    expect(
      getAdminMuteView({
        isAdmin: false,
        mutedUntil: Date.now() + 60_000,
        now: Date.now(),
      }),
    ).toEqual({ kind: 'hidden' })
  })

  it('returns hidden when isAdmin is false and mutedUntil is null', () => {
    expect(
      getAdminMuteView({ isAdmin: false, mutedUntil: null, now: 0 }),
    ).toEqual({
      kind: 'hidden',
    })
  })

  it('returns idle for an admin with mutedUntil null', () => {
    expect(
      getAdminMuteView({ isAdmin: true, mutedUntil: null, now: 1000 }),
    ).toEqual({
      kind: 'idle',
    })
  })

  it('returns idle for an admin when mutedUntil is exactly equal to now (expired)', () => {
    expect(
      getAdminMuteView({ isAdmin: true, mutedUntil: 1000, now: 1000 }),
    ).toEqual({
      kind: 'idle',
    })
  })

  it('returns idle for an admin when mutedUntil is in the past', () => {
    expect(
      getAdminMuteView({ isAdmin: true, mutedUntil: 500, now: 1000 }),
    ).toEqual({
      kind: 'idle',
    })
  })

  it('returns muted with remainingMs for an admin when mutedUntil is in the future', () => {
    expect(
      getAdminMuteView({ isAdmin: true, mutedUntil: 10_000, now: 4_000 }),
    ).toEqual({
      kind: 'muted',
      remainingMs: 6_000,
    })
  })
})

describe('formatRemaining', () => {
  it('formats 600000ms as 10:00', () => {
    expect(formatRemaining(600_000)).toBe('10:00')
  })

  it('formats 59000ms as 0:59', () => {
    expect(formatRemaining(59_000)).toBe('0:59')
  })

  it('rounds up to the next whole second (Math.ceil) so 1500ms shows 0:02', () => {
    expect(formatRemaining(1_500)).toBe('0:02')
  })

  it('rounds a 1ms remainder up to 0:01, never showing 0:00 while still muted', () => {
    expect(formatRemaining(1)).toBe('0:01')
  })

  it('formats 0ms as 0:00', () => {
    expect(formatRemaining(0)).toBe('0:00')
  })

  it('clamps negative durations to 0:00', () => {
    expect(formatRemaining(-5_000)).toBe('0:00')
  })

  it('pads seconds under 10 with a leading zero', () => {
    expect(formatRemaining(65_000)).toBe('1:05')
  })
})
