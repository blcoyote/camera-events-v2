import { useLocalStorage } from 'usehooks-ts'

export const EVENT_LIMIT_KEY = 'event-limit'
export const DEFAULT_EVENT_LIMIT = 20
export const MIN_EVENT_LIMIT = 20
export const MAX_EVENT_LIMIT = 100
export const EVENT_LIMIT_STEP = 10

/** Read the saved event limit from localStorage (SSR-safe, returns default on server). */
export function readEventLimit(): number {
  if (typeof globalThis.localStorage === 'undefined') return DEFAULT_EVENT_LIMIT
  try {
    const stored = localStorage.getItem(EVENT_LIMIT_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        typeof parsed === 'number' &&
        parsed >= MIN_EVENT_LIMIT &&
        parsed <= MAX_EVENT_LIMIT
      ) {
        return parsed
      }
    }
  } catch {
    // Corrupted or inaccessible localStorage — use default
  }
  return DEFAULT_EVENT_LIMIT
}

/** React hook for the event limit setting (wraps useLocalStorage). */
export function useEventLimit() {
  return useLocalStorage<number>(EVENT_LIMIT_KEY, DEFAULT_EVENT_LIMIT)
}
