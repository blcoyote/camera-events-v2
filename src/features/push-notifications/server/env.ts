/**
 * Environment parsing helpers for the push notification pipeline.
 *
 * Kept free of `process.env` access so it stays a pure, directly testable unit;
 * callers pass the raw string in and get a usable duration out.
 */

import '@tanstack/react-start/server-only'

/**
 * Parse a millisecond duration from an environment variable.
 *
 * Falls back when the value is absent, blank, non-numeric, negative, or
 * non-finite. Unlike a plain `||` guard this treats `"0"` as a valid value, so
 * a window can legitimately be configured to flush immediately.
 */
export function parseDurationMs(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback
  const trimmed = value.trim()
  if (trimmed === '') return fallback
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

/** Subset of the environment these resolvers read. */
type Env = Record<string, string | undefined>

/** How long events are collected per camera before a follow-up push. */
const DEFAULT_BATCH_WINDOW_MS = 30_000

/** Quiet gap after which a camera's next event alerts instead of patching. */
const DEFAULT_BURST_GAP_MS = 600_000

/** Minimum spacing between update pushes to a single Apple endpoint. */
const DEFAULT_APPLE_UPDATE_INTERVAL_MS = 300_000

export interface BatcherConfig {
  windowMs: number
  burstGapMs: number
}

/**
 * Resolve the event batcher's timings.
 *
 * `windowMs` (`EVENT_BATCH_WINDOW_MS`) is how long follow-up events are
 * collected before the notification is patched again. `burstGapMs`
 * (`EVENT_BURST_GAP_MS`) is how long a camera must stay quiet before its next
 * event counts as new activity and alerts rather than patching — lower it to be
 * alerted about renewed activity sooner, raise it to be alerted less often.
 */
export function resolveBatcherConfig(env: Env): BatcherConfig {
  return {
    windowMs: parseDurationMs(
      env.EVENT_BATCH_WINDOW_MS,
      DEFAULT_BATCH_WINDOW_MS,
    ),
    burstGapMs: parseDurationMs(env.EVENT_BURST_GAP_MS, DEFAULT_BURST_GAP_MS),
  }
}

/**
 * Resolve how often an Apple endpoint may receive an update push
 * (`APPLE_UPDATE_INTERVAL_MS`).
 *
 * iOS re-alerts on every notification it receives, so patches to Apple devices
 * are paced. Raise it for fewer iOS buzzes at the cost of a staler count; set it
 * to `0` to disable pacing and let iOS behave like Android.
 */
export function resolveAppleUpdateIntervalMs(env: Env): number {
  return parseDurationMs(
    env.APPLE_UPDATE_INTERVAL_MS,
    DEFAULT_APPLE_UPDATE_INTERVAL_MS,
  )
}

/** Consecutive zero-FPS readings required before a camera is declared offline. */
const DEFAULT_OFFLINE_THRESHOLD = 2

/**
 * Resolve how many consecutive `frigate/stats` readings with `camera_fps === 0`
 * are required before a camera is declared offline (`CAMERA_OFFLINE_THRESHOLD`).
 *
 * Frigate publishes `frigate/stats` on its own operator-configurable
 * `stats_interval` (default 60 s), so this is expressed as a reading count
 * rather than a duration — there's no fixed interval to measure milliseconds
 * against. Falls back when the value is absent, blank, non-numeric,
 * non-integer, or less than 1, since a threshold of zero or fewer readings
 * doesn't make sense as "consecutive readings required". Raising it makes
 * offline detection slower to trigger but more resistant to transient FPS
 * blips; lowering it (minimum 1) makes detection faster but noisier.
 */
export function resolveOfflineThreshold(env: Env): number {
  const value = env.CAMERA_OFFLINE_THRESHOLD
  if (value === undefined) return DEFAULT_OFFLINE_THRESHOLD
  const trimmed = value.trim()
  if (trimmed === '') return DEFAULT_OFFLINE_THRESHOLD
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_OFFLINE_THRESHOLD
  return parsed
}
