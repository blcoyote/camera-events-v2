import { useCallback, useEffect, useRef } from 'react'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as { standalone: boolean }).standalone)
  )
}

/**
 * In standalone PWA mode, OAuth redirects through an external domain
 * (Google) can lose cookies due to browser/PWA cookie isolation.
 * This hook opens the auth URL in the system browser instead, then
 * reloads when the PWA regains focus so the new session is picked up.
 */
export function useStandaloneAuth(href: string) {
  const openedRef = useRef(false)

  useEffect(() => {
    if (!isStandalone()) return

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && openedRef.current) {
        openedRef.current = false
        window.location.reload()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isStandalone()) return
      e.preventDefault()
      openedRef.current = true
      window.open(href, '_blank')
    },
    [href],
  )

  return { onClick }
}
