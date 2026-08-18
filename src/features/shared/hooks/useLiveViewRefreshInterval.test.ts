import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  readLiveViewRefreshSeconds,
  LIVE_VIEW_REFRESH_INTERVAL_KEY,
  DEFAULT_LIVE_VIEW_REFRESH_SECONDS,
  MIN_LIVE_VIEW_REFRESH_SECONDS,
  MAX_LIVE_VIEW_REFRESH_SECONDS,
  LIVE_VIEW_REFRESH_STEP,
} from './useLiveViewRefreshInterval'

describe('live view refresh interval constants', () => {
  it('has expected default values', () => {
    expect(DEFAULT_LIVE_VIEW_REFRESH_SECONDS).toBe(2)
    expect(MIN_LIVE_VIEW_REFRESH_SECONDS).toBe(1)
    expect(MAX_LIVE_VIEW_REFRESH_SECONDS).toBe(10)
    expect(LIVE_VIEW_REFRESH_STEP).toBe(1)
    expect(LIVE_VIEW_REFRESH_INTERVAL_KEY).toBe(
      'live-view-refresh-interval-seconds',
    )
  })
})

describe('readLiveViewRefreshSeconds', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
    })
  })

  it('returns default when localStorage is empty', () => {
    expect(readLiveViewRefreshSeconds()).toBe(DEFAULT_LIVE_VIEW_REFRESH_SECONDS)
  })

  it('returns saved value when valid', () => {
    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = JSON.stringify(7)
    expect(readLiveViewRefreshSeconds()).toBe(7)
  })

  it('returns default when stored value is below minimum', () => {
    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = JSON.stringify(0)
    expect(readLiveViewRefreshSeconds()).toBe(DEFAULT_LIVE_VIEW_REFRESH_SECONDS)
  })

  it('returns default when stored value is above maximum', () => {
    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = JSON.stringify(11)
    expect(readLiveViewRefreshSeconds()).toBe(DEFAULT_LIVE_VIEW_REFRESH_SECONDS)
  })

  it('returns default when stored value is not a number', () => {
    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = JSON.stringify('abc')
    expect(readLiveViewRefreshSeconds()).toBe(DEFAULT_LIVE_VIEW_REFRESH_SECONDS)
  })

  it('returns default when stored value is invalid JSON', () => {
    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = '{bad-json'
    expect(readLiveViewRefreshSeconds()).toBe(DEFAULT_LIVE_VIEW_REFRESH_SECONDS)
  })

  it('accepts boundary values', () => {
    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = JSON.stringify(
      MIN_LIVE_VIEW_REFRESH_SECONDS,
    )
    expect(readLiveViewRefreshSeconds()).toBe(MIN_LIVE_VIEW_REFRESH_SECONDS)

    store[LIVE_VIEW_REFRESH_INTERVAL_KEY] = JSON.stringify(
      MAX_LIVE_VIEW_REFRESH_SECONDS,
    )
    expect(readLiveViewRefreshSeconds()).toBe(MAX_LIVE_VIEW_REFRESH_SECONDS)
  })

  it('returns default when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readLiveViewRefreshSeconds()).toBe(DEFAULT_LIVE_VIEW_REFRESH_SECONDS)
  })
})
