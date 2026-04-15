import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  TtlCache,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  frigateCache,
  clearFrigateCache,
} from './cache'

describe('TtlCache', () => {
  let cache: TtlCache<string>

  beforeEach(() => {
    cache = new TtlCache<string>(1000, 3)
  })

  it('returns undefined for a cache miss', () => {
    expect(cache.get('missing')).toBeUndefined()
  })

  it('returns cached value on hit within TTL', () => {
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('returns undefined after TTL expires', () => {
    vi.useFakeTimers()
    try {
      cache.set('key', 'value')
      vi.advanceTimersByTime(1001)
      expect(cache.get('key')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('deletes expired entry on get (lazy cleanup)', () => {
    vi.useFakeTimers()
    try {
      cache.set('key', 'value')
      expect(cache.size).toBe(1)
      vi.advanceTimersByTime(1001)
      cache.get('key')
      expect(cache.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('overwrites existing entry with same key', () => {
    cache.set('key', 'first')
    cache.set('key', 'second')
    expect(cache.get('key')).toBe('second')
    expect(cache.size).toBe(1)
  })

  it('evicts oldest entry when max entries exceeded', () => {
    cache.set('a', '1')
    cache.set('b', '2')
    cache.set('c', '3')
    expect(cache.size).toBe(3)

    cache.set('d', '4')
    expect(cache.size).toBe(3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('2')
    expect(cache.get('d')).toBe('4')
  })

  it('clear removes all entries', () => {
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
  })

  it('size reflects current entry count', () => {
    expect(cache.size).toBe(0)
    cache.set('a', '1')
    expect(cache.size).toBe(1)
    cache.set('b', '2')
    expect(cache.size).toBe(2)
  })
})

describe('cache constants', () => {
  it('CACHE_TTL_MS is 10 minutes', () => {
    expect(CACHE_TTL_MS).toBe(600_000)
  })

  it('CACHE_MAX_ENTRIES is 500', () => {
    expect(CACHE_MAX_ENTRIES).toBe(500)
  })
})

describe('clearFrigateCache', () => {
  it('clears the singleton cache', () => {
    frigateCache.set('test-key', { ok: true, data: 'test' })
    expect(frigateCache.size).toBe(1)
    clearFrigateCache()
    expect(frigateCache.size).toBe(0)
  })
})
