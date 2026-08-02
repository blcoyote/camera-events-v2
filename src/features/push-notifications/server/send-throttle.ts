/**
 * Pacing helpers for follow-up ("update") push notifications.
 *
 * Android and desktop browsers honour `silent: true`, so a notification can be
 * patched in place without re-alerting the user — those updates are free and go
 * out on every batch window. iOS Safari ignores both `silent` and `renotify`:
 * re-showing a notification with the same tag replaces the entry (so the list
 * stays at one per camera) but still plays the alert. Update pushes to Apple
 * endpoints are therefore rate-limited.
 */

import '@tanstack/react-start/server-only'

/** Host that serves Web Push for Safari / iOS standalone PWAs. */
const APPLE_PUSH_HOST = 'web.push.apple.com'

/** True when a push endpoint is served by Apple (Safari, iOS, iPadOS, macOS). */
export function isAppleEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).host === APPLE_PUSH_HOST
  } catch {
    return false
  }
}

/** Default minimum spacing between update pushes to a single Apple endpoint. */
const DEFAULT_APPLE_UPDATE_INTERVAL_MS = 300_000

/**
 * Rate limiter keyed by an arbitrary string, with an explicit clock.
 *
 * Time is passed in rather than read from `Date.now()` so callers stay pure and
 * tests need no fake timers. Keys older than the interval are pruned on write:
 * they can no longer block anything, so keeping them would leak memory as push
 * endpoints churn over a long-running server's lifetime.
 */
export class SendThrottle {
  private lastSentAt = new Map<string, number>()
  private readonly minIntervalMs: number

  constructor(minIntervalMs = DEFAULT_APPLE_UPDATE_INTERVAL_MS) {
    this.minIntervalMs = minIntervalMs
  }

  /**
   * Reserve a send slot for `key`. Returns true and records the send when the
   * interval has elapsed; returns false and records nothing when it has not.
   */
  tryAcquire(key: string, nowMs: number): boolean {
    const previous = this.lastSentAt.get(key)
    if (previous !== undefined && nowMs - previous < this.minIntervalMs) {
      return false
    }
    this.record(key, nowMs)
    return true
  }

  /** Record a send that bypassed the throttle, resetting the key's interval. */
  record(key: string, nowMs: number): void {
    this.prune(nowMs)
    this.lastSentAt.set(key, nowMs)
  }

  /** Number of tracked keys. Inspection helper for tests. */
  size(): number {
    return this.lastSentAt.size
  }

  private prune(nowMs: number): void {
    for (const [key, sentAt] of this.lastSentAt) {
      if (nowMs - sentAt >= this.minIntervalMs) {
        this.lastSentAt.delete(key)
      }
    }
  }
}
