/** Default cache TTL: 10 minutes. */
export const CACHE_TTL_MS = 600_000

/** Maximum number of entries before oldest is evicted. */
export const CACHE_MAX_ENTRIES = 500

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * Generic in-memory TTL cache backed by a Map.
 * Entries expire after `ttlMs` and the oldest entry is evicted when
 * the cache reaches `maxEntries`.
 */
export class TtlCache<T> {
  private cache = new Map<string, CacheEntry<T>>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.data
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) {
        this.cache.delete(oldest)
      }
    }

    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/** Module-level singleton used by the Frigate client. */
export const frigateCache = new TtlCache<unknown>(
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
)

/** Clear the singleton cache. Exported for test isolation. */
export function clearFrigateCache(): void {
  frigateCache.clear()
}
