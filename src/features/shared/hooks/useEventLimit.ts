import { useCallback } from 'react'
import { useLocalStorage } from 'usehooks-ts'

export const EVENT_LIMIT_KEY = 'event-limit'
export const EVENT_LIMIT_COOKIE = 'event-limit'
export const DEFAULT_EVENT_LIMIT = 20
export const MIN_EVENT_LIMIT = 20
export const MAX_EVENT_LIMIT = 100
export const EVENT_LIMIT_STEP = 10

function parseEventLimit(raw: string | null | undefined): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  if (
    Number.isFinite(parsed) &&
    parsed >= MIN_EVENT_LIMIT &&
    parsed <= MAX_EVENT_LIMIT
  ) {
    return parsed
  }
  return null
}

/** Read the saved event limit from a cookie string (works on server and client). */
export function readEventLimitFromCookies(cookieHeader: string): number {
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${EVENT_LIMIT_COOKIE}=(\\d+)`),
  )
  return parseEventLimit(match?.[1]) ?? DEFAULT_EVENT_LIMIT
}

/** Read the saved event limit from localStorage (SSR-safe, returns default on server). */
export function readEventLimit(): number {
  if (typeof globalThis.localStorage === 'undefined') return DEFAULT_EVENT_LIMIT
  try {
    const stored = localStorage.getItem(EVENT_LIMIT_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parseEventLimit(String(parsed)) ?? DEFAULT_EVENT_LIMIT
    }
  } catch {
    // Corrupted or inaccessible localStorage — use default
  }
  return DEFAULT_EVENT_LIMIT
}

function setEventLimitCookie(value: number) {
  document.cookie = `${EVENT_LIMIT_COOKIE}=${value};path=/;max-age=31536000;SameSite=Lax`
}

/** React hook for the event limit setting (syncs localStorage + cookie). */
export function useEventLimit() {
  const [eventLimit, setLocalStorage] = useLocalStorage<number>(
    EVENT_LIMIT_KEY,
    DEFAULT_EVENT_LIMIT,
  )

  const setEventLimit = useCallback(
    (value: number | ((prev: number) => number)) => {
      setLocalStorage((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        setEventLimitCookie(next)
        return next
      })
    },
    [setLocalStorage],
  )

  return [eventLimit, setEventLimit] as const
}
