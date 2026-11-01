import { m } from '#/paraglide/messages.js'
import { useCallback, useRef } from 'react'
import { XIcon } from 'lucide-react'
import { useImageGestures } from '#/features/shared/hooks/useImageGestures'
import { Button } from '#/features/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/features/shared/components/ui/dialog'

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
  // Radix only restores focus to a <Dialog.Trigger>; this dialog is controlled
  // by its parent, so remember the opener ourselves and hand focus back on close.
  const openerRef = useRef<HTMLElement | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        variant="bare"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          openerRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          openerRef.current?.focus()
          openerRef.current = null
        }}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          {m.shared_lightbox_hint()}
        </DialogDescription>
        <LightboxViewer src={src} alt={alt} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * Rendered inside DialogContent so it mounts together with the image: Radix
 * portals its content one commit after `open` flips, so calling
 * `useImageGestures` in the parent would run its listener-attaching effect
 * while `imgRef.current` is still null and never re-run.
 */
function LightboxViewer({
  src,
  alt,
  onClose,
}: Pick<SnapshotLightboxProps, 'src' | 'alt' | 'onClose'>) {
  const imgRef = useRef<HTMLImageElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dismiss = useCallback(() => onCloseRef.current(), [])

  const { transform, dismissY, gestureMode, resetTransform } = useImageGestures(
    { imgRef, active: true, onDismiss: dismiss },
  )

  const handleClose = useCallback(() => {
    resetTransform()
    onCloseRef.current()
  }, [resetTransform])

  const dismissOpacity = Math.max(0.3, 1 - dismissY / 300)

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/90"
      style={{ opacity: dismissOpacity, transition: 'opacity 150ms ease' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClose}
        aria-label={m.shared_lightbox_close()}
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 h-11 w-11 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
      >
        <XIcon className="size-5" aria-hidden="true" />
      </Button>
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
