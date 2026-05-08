import { useEffect, useRef } from 'react'

interface UseRefetchOnMountOptions {
  onRefresh: () => Promise<void>
}

export function useRefetchOnMount({
  onRefresh,
}: UseRefetchOnMountOptions): void {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    onRefreshRef.current()
  }, [])
}
