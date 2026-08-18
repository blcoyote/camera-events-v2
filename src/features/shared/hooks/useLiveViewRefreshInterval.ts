import { useLocalStorage } from 'usehooks-ts'

export const LIVE_VIEW_REFRESH_INTERVAL_KEY =
  'live-view-refresh-interval-seconds'
export const DEFAULT_LIVE_VIEW_REFRESH_SECONDS = 2
export const MIN_LIVE_VIEW_REFRESH_SECONDS = 1
export const MAX_LIVE_VIEW_REFRESH_SECONDS = 10
export const LIVE_VIEW_REFRESH_STEP = 1

function parseLiveViewRefreshSeconds(raw: unknown): number | null {
  const parsed = Number(raw)
  if (
    Number.isFinite(parsed) &&
    parsed >= MIN_LIVE_VIEW_REFRESH_SECONDS &&
    parsed <= MAX_LIVE_VIEW_REFRESH_SECONDS
  ) {
    return parsed
  }
  return null
}

/** Read the saved live view refresh interval from localStorage (SSR-safe, returns default on server). */
export function readLiveViewRefreshSeconds(): number {
  if (typeof globalThis.localStorage === 'undefined')
    return DEFAULT_LIVE_VIEW_REFRESH_SECONDS
  try {
    const stored = localStorage.getItem(LIVE_VIEW_REFRESH_INTERVAL_KEY)
    if (stored) {
      return (
        parseLiveViewRefreshSeconds(JSON.parse(stored)) ??
        DEFAULT_LIVE_VIEW_REFRESH_SECONDS
      )
    }
  } catch {
    // Corrupted or inaccessible localStorage — use default
  }
  return DEFAULT_LIVE_VIEW_REFRESH_SECONDS
}

/** React hook for the live view refresh interval setting, in seconds (persisted in localStorage). */
export function useLiveViewRefreshInterval() {
  return useLocalStorage<number>(
    LIVE_VIEW_REFRESH_INTERVAL_KEY,
    DEFAULT_LIVE_VIEW_REFRESH_SECONDS,
  )
}
