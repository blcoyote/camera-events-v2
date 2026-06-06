import { useEffect } from 'react'

export const SESSION_LAST_REFRESH_KEY = 'session_last_refreshed'

// Reload to renew the session if the user has been away from the PWA for
// longer than this. 6 hours is well within the 7-day session TTL.
export const SESSION_REFRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as { standalone: boolean }).standalone)
  )
}

/** Returns true when enough time has elapsed to warrant a session reload. */
export function needsSessionRefresh(
  lastRefreshMs: number,
  nowMs: number,
): boolean {
  return nowMs - lastRefreshMs > SESSION_REFRESH_THRESHOLD_MS
}

/**
 * Ensures the session cookie stays fresh in iOS standalone PWA mode.
 *
 * On iOS, `Set-Cookie` headers from XHR/fetch (server function) responses are
 * not reliably persisted, so the sliding window in `resolveUserFromSession`
 * never takes effect. A full page reload triggers SSR, whose navigation
 * response iOS *does* persist. This hook fires a reload at most once per
 * SESSION_REFRESH_THRESHOLD_MS when the PWA regains focus after being
 * backgrounded long enough that the session needs renewal.
 */
export function useSessionRefresh(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isStandalone()) return

    localStorage.setItem(SESSION_LAST_REFRESH_KEY, String(Date.now()))

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!isAuthenticated) return

      const lastRefresh = Number(
        localStorage.getItem(SESSION_LAST_REFRESH_KEY) ?? '0',
      )
      if (needsSessionRefresh(lastRefresh, Date.now())) {
        window.location.reload()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated])
}
