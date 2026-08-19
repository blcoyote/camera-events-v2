import { useCallback, useRef } from 'react'
import { useModalFocusTrap } from '#/features/shared/hooks/useModalFocusTrap'
import { useImageGestures } from '#/features/shared/hooks/useImageGestures'

interface SnapshotLightboxProps {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}

export function SnapshotLightbox({
  src,
  alt,
  open,
  onClose,
}: SnapshotLightboxProps) {
  const imgRef = useRef<HTMLImageElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dismiss = useCallback(() => onCloseRef.current(), [])

  const { transform, dismissY, gestureMode, resetTransform } = useImageGestures(
    { imgRef, active: open, onDismiss: dismiss },
  )

  const handleClose = useCallback(() => {
    resetTransform()
    onCloseRef.current()
  }, [resetTransform])

  const { dialogRef, closeRef } = useModalFocusTrap(open, handleClose)

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
        if (e.target === dialogRef.current) handleClose()
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={handleClose}
        aria-label="Close snapshot viewer"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30"
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
            gestureMode.current === 'none'
              ? 'transform 200ms ease-out'
              : undefined,
          cursor: transform.scale > 1 ? 'grab' : undefined,
        }}
      />
    </div>
  )
}
