import { useCallback, useEffect, useRef, useState } from 'react'

interface SnapshotLightboxProps {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2
const DOUBLE_TAP_MS = 300
const SWIPE_DISMISS_THRESHOLD = 100

interface Transform {
  scale: number
  tx: number
  ty: number
}

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 }

export function clampTranslation(
  tx: number,
  ty: number,
  scale: number,
  rect: DOMRect,
): { tx: number; ty: number } {
  if (scale <= 1) return { tx: 0, ty: 0 }
  const maxTx = ((scale - 1) * rect.width) / 2
  const maxTy = ((scale - 1) * rect.height) / 2
  return {
    tx: Math.max(-maxTx, Math.min(maxTx, tx)),
    ty: Math.max(-maxTy, Math.min(maxTy, ty)),
  }
}

export function distance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export function midpoint(a: Touch, b: Touch): { x: number; y: number } {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

export function SnapshotLightbox({
  src,
  alt,
  open,
  onClose,
}: SnapshotLightboxProps) {
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const [dismissY, setDismissY] = useState(0)

  const imgRef = useRef<HTMLImageElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const pinchRef = useRef({ lastDist: 0, lastMid: { x: 0, y: 0 } })
  const panRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 })
  const tapRef = useRef({ lastTap: 0, lastX: 0, lastY: 0 })
  const gestureRef = useRef<'none' | 'pinch' | 'pan' | 'dismiss'>('none')
  const transformRef = useRef(IDENTITY)
  const dismissRef = useRef(0)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const resetAndClose = useCallback(() => {
    setTransform(IDENTITY)
    setDismissY(0)
    transformRef.current = IDENTITY
    dismissRef.current = 0
    onCloseRef.current()
  }, [])

  useEffect(() => {
    if (!open) return
    setTransform(IDENTITY)
    setDismissY(0)
    transformRef.current = IDENTITY
    dismissRef.current = 0

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        resetAndClose()
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, resetAndClose])

  useEffect(() => {
    if (!open) return
    const img = imgRef.current
    if (!img) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        gestureRef.current = 'pinch'
        pinchRef.current.lastDist = distance(e.touches[0], e.touches[1])
        pinchRef.current.lastMid = midpoint(e.touches[0], e.touches[1])
      } else if (e.touches.length === 1) {
        const t = transformRef.current
        if (t.scale > 1) {
          gestureRef.current = 'pan'
        } else {
          gestureRef.current = 'dismiss'
          dismissRef.current = 0
        }
        panRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startTx: t.tx,
          startTy: t.ty,
        }

        const now = Date.now()
        const dt = now - tapRef.current.lastTap
        if (
          dt < DOUBLE_TAP_MS &&
          Math.abs(e.touches[0].clientX - tapRef.current.lastX) < 30 &&
          Math.abs(e.touches[0].clientY - tapRef.current.lastY) < 30
        ) {
          e.preventDefault()
          const rect = img.getBoundingClientRect()
          const cur = transformRef.current
          if (cur.scale > 1) {
            transformRef.current = IDENTITY
            setTransform(IDENTITY)
          } else {
            const tapX = e.touches[0].clientX - rect.left - rect.width / 2
            const tapY = e.touches[0].clientY - rect.top - rect.height / 2
            const newTx = -tapX * (DOUBLE_TAP_SCALE - 1)
            const newTy = -tapY * (DOUBLE_TAP_SCALE - 1)
            const clamped = clampTranslation(
              newTx,
              newTy,
              DOUBLE_TAP_SCALE,
              rect,
            )
            const next = {
              scale: DOUBLE_TAP_SCALE,
              tx: clamped.tx,
              ty: clamped.ty,
            }
            transformRef.current = next
            setTransform(next)
          }
          tapRef.current.lastTap = 0
          gestureRef.current = 'none'
        } else {
          tapRef.current = {
            lastTap: now,
            lastX: e.touches[0].clientX,
            lastY: e.touches[0].clientY,
          }
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = img.getBoundingClientRect()

      if (gestureRef.current === 'pinch' && e.touches.length === 2) {
        const dist = distance(e.touches[0], e.touches[1])
        const mid = midpoint(e.touches[0], e.touches[1])
        const scaleDelta = dist / pinchRef.current.lastDist
        const t = transformRef.current
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, t.scale * scaleDelta),
        )

        const midDx = mid.x - pinchRef.current.lastMid.x
        const midDy = mid.y - pinchRef.current.lastMid.y

        const clamped = clampTranslation(
          t.tx + midDx,
          t.ty + midDy,
          newScale,
          rect,
        )
        const next = { scale: newScale, tx: clamped.tx, ty: clamped.ty }
        transformRef.current = next
        setTransform(next)

        pinchRef.current.lastDist = dist
        pinchRef.current.lastMid = mid
      } else if (gestureRef.current === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - panRef.current.startX
        const dy = e.touches[0].clientY - panRef.current.startY
        const t = transformRef.current
        const clamped = clampTranslation(
          panRef.current.startTx + dx,
          panRef.current.startTy + dy,
          t.scale,
          rect,
        )
        const next = { scale: t.scale, tx: clamped.tx, ty: clamped.ty }
        transformRef.current = next
        setTransform(next)
      } else if (gestureRef.current === 'dismiss' && e.touches.length === 1) {
        const dy = e.touches[0].clientY - panRef.current.startY
        if (dy > 0) {
          dismissRef.current = dy
          setDismissY(dy)
        }
      }
    }

    const onTouchEnd = () => {
      if (
        gestureRef.current === 'dismiss' &&
        dismissRef.current > SWIPE_DISMISS_THRESHOLD
      ) {
        resetAndClose()
        return
      }
      if (gestureRef.current === 'dismiss') {
        dismissRef.current = 0
        setDismissY(0)
      }
      if (transformRef.current.scale <= 1) {
        transformRef.current = IDENTITY
        setTransform(IDENTITY)
      }
      gestureRef.current = 'none'
    }

    img.addEventListener('touchstart', onTouchStart, { passive: false })
    img.addEventListener('touchmove', onTouchMove, { passive: false })
    img.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      img.removeEventListener('touchstart', onTouchStart)
      img.removeEventListener('touchmove', onTouchMove)
      img.removeEventListener('touchend', onTouchEnd)
    }
  }, [open, resetAndClose])

  useEffect(() => {
    if (!open) return
    const img = imgRef.current
    if (!img) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = img.getBoundingClientRect()
      const t = transformRef.current
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * delta))
      const clamped = clampTranslation(t.tx, t.ty, newScale, rect)
      const next = { scale: newScale, tx: clamped.tx, ty: clamped.ty }
      transformRef.current = next
      setTransform(next)
    }

    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let dragStartTx = 0
    let dragStartTy = 0

    const onMouseDown = (e: MouseEvent) => {
      if (transformRef.current.scale <= 1) return
      isDragging = true
      dragStartX = e.clientX
      dragStartY = e.clientY
      dragStartTx = transformRef.current.tx
      dragStartTy = transformRef.current.ty
      img.style.cursor = 'grabbing'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const rect = img.getBoundingClientRect()
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      const t = transformRef.current
      const clamped = clampTranslation(
        dragStartTx + dx,
        dragStartTy + dy,
        t.scale,
        rect,
      )
      const next = { scale: t.scale, tx: clamped.tx, ty: clamped.ty }
      transformRef.current = next
      setTransform(next)
    }

    const onMouseUp = () => {
      isDragging = false
      img.style.cursor = transformRef.current.scale > 1 ? 'grab' : ''
    }

    img.addEventListener('wheel', onWheel, { passive: false })
    img.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      img.removeEventListener('wheel', onWheel)
      img.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [open])

  if (!open) return null

  const dismissOpacity = Math.max(0.3, 1 - dismissY / 300)

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Snapshot viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      style={{ opacity: dismissOpacity, transition: 'opacity 150ms ease' }}
      onClick={(e) => {
        if (e.target === dialogRef.current) resetAndClose()
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={resetAndClose}
        aria-label="Close snapshot viewer"
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full select-none"
        style={{
          touchAction: 'none',
          willChange: 'transform',
          transform: `translate(${transform.tx}px, ${transform.ty + dismissY}px) scale(${transform.scale})`,
          transition:
            gestureRef.current === 'none'
              ? 'transform 200ms ease-out'
              : undefined,
          cursor: transform.scale > 1 ? 'grab' : undefined,
        }}
      />
    </div>
  )
}
