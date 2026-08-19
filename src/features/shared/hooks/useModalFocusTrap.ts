import { useEffect, useRef } from 'react'

/**
 * Manages focus and body-scroll for a modal dialog: remembers and restores
 * the previously-focused element, locks body scroll while open, focuses the
 * close button on open, and wires Escape-to-close / Tab-trapped-to-close.
 */
export function useModalFocusTrap(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    // Remember whatever was focused before the dialog opened, so we can
    // restore focus on close (WCAG 2.4.3 / focus management for modals).
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = prev
      triggerRef.current?.focus()
      triggerRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return { dialogRef, closeRef }
}
