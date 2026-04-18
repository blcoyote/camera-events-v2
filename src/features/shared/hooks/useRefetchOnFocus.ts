import { useEffect, useRef } from 'react'

interface UseRefetchOnFocusOptions {
  onRefresh: () => Promise<void>
  minIntervalMs?: number
}

const DEFAULT_MIN_INTERVAL_MS = 10_000

export function useRefetchOnFocus({
  onRefresh,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
}: UseRefetchOnFocusOptions): void {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const lastRefetchRef = useRef(Date.now())

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefetchRef.current < minIntervalMs) return

      lastRefetchRef.current = Date.now()
      onRefreshRef.current()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [minIntervalMs])
}
