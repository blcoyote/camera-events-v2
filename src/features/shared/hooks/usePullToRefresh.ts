import { useCallback, useEffect, useRef, useState } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxPull?: number
}

interface UsePullToRefreshResult {
  pullDistance: number
  isRefreshing: boolean
  isComplete: boolean
}

const DEFAULT_THRESHOLD = 80
const DEFAULT_MAX_PULL = 120
const DAMPING = 0.5

function getScrollTop(): number {
  return document.documentElement.scrollTop || document.body.scrollTop
}

export function usePullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const activeRef = useRef(false)
  const directionLockedRef = useRef(false)
  const isHorizontalRef = useRef(false)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  onRefreshRef.current = onRefresh

  const handleRefresh = useCallback(async () => {
    refreshingRef.current = true
    setIsRefreshing(true)
    setIsComplete(false)
    try {
      await onRefreshRef.current()
    } finally {
      refreshingRef.current = false
      setIsRefreshing(false)
      setIsComplete(true)
      setPullDistance(0)
      setTimeout(() => setIsComplete(false), 600)
    }
  }, [])

  useEffect(() => {
    if (!('ontouchstart' in window)) return

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return
      if (e.touches.length !== 1) return
      if (getScrollTop() > 0) return

      startYRef.current = e.touches[0].clientY
      startXRef.current = e.touches[0].clientX
      activeRef.current = true
      directionLockedRef.current = false
      isHorizontalRef.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      if (e.touches.length !== 1) {
        activeRef.current = false
        setPullDistance(0)
        return
      }

      const currentY = e.touches[0].clientY
      const currentX = e.touches[0].clientX
      const deltaY = currentY - startYRef.current
      const deltaX = currentX - startXRef.current

      if (!directionLockedRef.current) {
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          directionLockedRef.current = true
          isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY)
        }
        return
      }

      if (isHorizontalRef.current) {
        activeRef.current = false
        return
      }

      if (deltaY <= 0) {
        setPullDistance(0)
        return
      }

      e.preventDefault()
      const dampened = Math.min(deltaY * DAMPING, maxPull)
      setPullDistance(dampened)
    }

    const onTouchEnd = () => {
      if (!activeRef.current) return
      activeRef.current = false

      setPullDistance((current) => {
        if (current >= threshold) {
          handleRefresh()
          return current
        }
        return 0
      })
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [threshold, maxPull, handleRefresh])

  return { pullDistance, isRefreshing, isComplete }
}
