import { describe, it, expect } from 'vitest'
import {
  parseDurationMs,
  resolveBatcherConfig,
  resolveAppleUpdateIntervalMs,
  resolveOfflineThreshold,
} from './env'

describe('parseDurationMs', () => {
  it('returns the provided value', () => {
    expect(parseDurationMs('10000', 30_000)).toBe(10_000)
  })

  it('returns the fallback when the value is undefined', () => {
    expect(parseDurationMs(undefined, 30_000)).toBe(30_000)
  })

  it('returns the fallback for an empty string', () => {
    expect(parseDurationMs('', 30_000)).toBe(30_000)
  })

  it('returns the fallback for a whitespace-only string', () => {
    expect(parseDurationMs('   ', 30_000)).toBe(30_000)
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parseDurationMs(' 5000 ', 30_000)).toBe(5_000)
  })

  it('returns the fallback for a non-numeric string', () => {
    expect(parseDurationMs('banana', 30_000)).toBe(30_000)
  })

  it('returns 0 for "0" rather than treating it as falsy', () => {
    expect(parseDurationMs('0', 30_000)).toBe(0)
  })

  it('returns the fallback for a negative duration', () => {
    // A negative window or interval has no coherent meaning and would silently
    // disable the behaviour it configures.
    expect(parseDurationMs('-1', 30_000)).toBe(30_000)
    expect(parseDurationMs('-600000', 30_000)).toBe(30_000)
  })

  it('returns the fallback for a non-finite value', () => {
    expect(parseDurationMs('Infinity', 30_000)).toBe(30_000)
    expect(parseDurationMs('NaN', 30_000)).toBe(30_000)
  })
})

describe('resolveBatcherConfig', () => {
  it('defaults to a 30 s window and a 10 min burst gap', () => {
    expect(resolveBatcherConfig({})).toEqual({
      windowMs: 30_000,
      burstGapMs: 600_000,
    })
  })

  it('reads the batch window from EVENT_BATCH_WINDOW_MS', () => {
    expect(resolveBatcherConfig({ EVENT_BATCH_WINDOW_MS: '5000' })).toEqual({
      windowMs: 5_000,
      burstGapMs: 600_000,
    })
  })

  it('reads the burst gap from EVENT_BURST_GAP_MS', () => {
    expect(resolveBatcherConfig({ EVENT_BURST_GAP_MS: '120000' })).toEqual({
      windowMs: 30_000,
      burstGapMs: 120_000,
    })
  })

  it('reads both knobs together', () => {
    expect(
      resolveBatcherConfig({
        EVENT_BATCH_WINDOW_MS: '10000',
        EVENT_BURST_GAP_MS: '900000',
      }),
    ).toEqual({ windowMs: 10_000, burstGapMs: 900_000 })
  })

  it('falls back per knob so one bad value cannot break the other', () => {
    expect(
      resolveBatcherConfig({
        EVENT_BATCH_WINDOW_MS: 'banana',
        EVENT_BURST_GAP_MS: '120000',
      }),
    ).toEqual({ windowMs: 30_000, burstGapMs: 120_000 })
  })
})

describe('resolveAppleUpdateIntervalMs', () => {
  it('defaults to 5 minutes', () => {
    expect(resolveAppleUpdateIntervalMs({})).toBe(300_000)
  })

  it('reads APPLE_UPDATE_INTERVAL_MS', () => {
    expect(
      resolveAppleUpdateIntervalMs({ APPLE_UPDATE_INTERVAL_MS: '60000' }),
    ).toBe(60_000)
  })

  it('allows 0 to disable pacing entirely', () => {
    expect(
      resolveAppleUpdateIntervalMs({ APPLE_UPDATE_INTERVAL_MS: '0' }),
    ).toBe(0)
  })

  it('falls back for an invalid value', () => {
    expect(
      resolveAppleUpdateIntervalMs({ APPLE_UPDATE_INTERVAL_MS: '-5' }),
    ).toBe(300_000)
  })
})

describe('resolveOfflineThreshold', () => {
  it('defaults to 10 when the env var is undefined', () => {
    expect(resolveOfflineThreshold({})).toBe(10)
  })

  it('returns the default for an empty string', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '' })).toBe(10)
  })

  it('returns the default for a whitespace-only string', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '   ' })).toBe(
      10,
    )
  })

  it('returns the default for a non-numeric string', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: 'abc' })).toBe(
      10,
    )
  })

  it('returns the default for "0"', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '0' })).toBe(10)
  })

  it('returns the default for a negative number string', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '-1' })).toBe(10)
  })

  it('returns the default for a non-integer string', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '2.5' })).toBe(
      10,
    )
  })

  it('returns the default for a non-finite value', () => {
    expect(
      resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: 'Infinity' }),
    ).toBe(10)
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: 'NaN' })).toBe(
      10,
    )
  })

  it('returns the parsed integer for a valid positive integer string', () => {
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '1' })).toBe(1)
    expect(resolveOfflineThreshold({ CAMERA_OFFLINE_THRESHOLD: '5' })).toBe(5)
  })
})
