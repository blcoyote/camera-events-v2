import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  readEventLimit,
  EVENT_LIMIT_KEY,
  DEFAULT_EVENT_LIMIT,
  MIN_EVENT_LIMIT,
  MAX_EVENT_LIMIT,
  EVENT_LIMIT_STEP,
} from './useEventLimit'

describe('event limit constants', () => {
  it('has expected default values', () => {
    expect(DEFAULT_EVENT_LIMIT).toBe(20)
    expect(MIN_EVENT_LIMIT).toBe(20)
    expect(MAX_EVENT_LIMIT).toBe(100)
    expect(EVENT_LIMIT_STEP).toBe(10)
    expect(EVENT_LIMIT_KEY).toBe('event-limit')
  })
})

describe('readEventLimit', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
    })
  })

  it('returns default when localStorage is empty', () => {
    expect(readEventLimit()).toBe(DEFAULT_EVENT_LIMIT)
  })

  it('returns saved value when valid', () => {
    store[EVENT_LIMIT_KEY] = JSON.stringify(60)
    expect(readEventLimit()).toBe(60)
  })

  it('returns default when stored value is below minimum', () => {
    store[EVENT_LIMIT_KEY] = JSON.stringify(5)
    expect(readEventLimit()).toBe(DEFAULT_EVENT_LIMIT)
  })

  it('returns default when stored value is above maximum', () => {
    store[EVENT_LIMIT_KEY] = JSON.stringify(200)
    expect(readEventLimit()).toBe(DEFAULT_EVENT_LIMIT)
  })

  it('returns default when stored value is not a number', () => {
    store[EVENT_LIMIT_KEY] = JSON.stringify('abc')
    expect(readEventLimit()).toBe(DEFAULT_EVENT_LIMIT)
  })

  it('returns default when stored value is invalid JSON', () => {
    store[EVENT_LIMIT_KEY] = '{bad-json'
    expect(readEventLimit()).toBe(DEFAULT_EVENT_LIMIT)
  })

  it('accepts boundary values', () => {
    store[EVENT_LIMIT_KEY] = JSON.stringify(MIN_EVENT_LIMIT)
    expect(readEventLimit()).toBe(MIN_EVENT_LIMIT)

    store[EVENT_LIMIT_KEY] = JSON.stringify(MAX_EVENT_LIMIT)
    expect(readEventLimit()).toBe(MAX_EVENT_LIMIT)
  })
})
