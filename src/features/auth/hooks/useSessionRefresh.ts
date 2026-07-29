import { useEffect } from 'react'

export const SESSION_LAST_REFRESH_KEY = 'session_last_refreshed'

// Reload to renew the session if the user has been away from the PWA for
// longer than this. 1 hour keeps the cookie's 30-day TTL sliding forward on
// iOS even for users who only open the app briefly and infrequently.
export const SESSION_REFRESH_THRESHOLD_MS = 60 * 60 * 1000

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as { standalone: boolean }).standalone)
  )
}

// Refresh when the cookie has this little life left, no matter how recently we
// last refreshed. The idle threshold above is reactive — it only fires after a
// gap — so a session used briefly but often could still lapse without this.
export const SESSION_EXPIRY_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000

// Floor between reloads. Guards the expiry path: if a cookie fails to renew,
// its expiry stays near and would otherwise reload the app on every foreground.
export const SESSION_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000

/**
 * Returns true when a session reload is warranted — either the user has been
 * away longer than the idle threshold, or the cookie is close enough to expiry
 * to renew pre-emptively.
 *
 * `expiresAtMs` is null for sessions issued before the field existed; those
 * fall back to idle-threshold behaviour alone.
 */
export function needsSessionRefresh(
  lastRefreshMs: number,
  nowMs: number,
  expiresAtMs: number | null = null,
): boolean {
  const sinceLastRefresh = nowMs - lastRefreshMs
  if (sinceLastRefresh < SESSION_REFRESH_MIN_INTERVAL_MS) return false
  if (sinceLastRefresh > SESSION_REFRESH_THRESHOLD_MS) return true
  if (expiresAtMs === null) return false
  return expiresAtMs - nowMs < SESSION_EXPIRY_REFRESH_WINDOW_MS
}

/**
 * Ensures the session cookie stays fresh in iOS standalone PWA mode.
 *
 * On iOS, `Set-Cookie` headers from XHR/fetch (server function) responses are
 * not reliably persisted, so the sliding window in `resolveUserFromSession`
 * never takes effect. A full page reload triggers SSR, whose navigation
 * response iOS *does* persist.
 *
 * On regaining focus the hook reloads when either the PWA has been backgrounded
 * longer than SESSION_REFRESH_THRESHOLD_MS, or `expiresAt` shows the cookie is
 * within SESSION_EXPIRY_REFRESH_WINDOW_MS of lapsing. Pass the `expiresAt` from
 * the session so the second, proactive path can fire.
 */
export function useSessionRefresh(
  isAuthenticated: boolean,
  expiresAt?: number,
): void {
  useEffect(() => {
    if (!isStandalone()) return

    localStorage.setItem(SESSION_LAST_REFRESH_KEY, String(Date.now()))

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!isAuthenticated) return

      const lastRefresh = Number(
        localStorage.getItem(SESSION_LAST_REFRESH_KEY) ?? '0',
      )
      if (needsSessionRefresh(lastRefresh, Date.now(), expiresAt ?? null)) {
        window.location.reload()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, expiresAt])
}
