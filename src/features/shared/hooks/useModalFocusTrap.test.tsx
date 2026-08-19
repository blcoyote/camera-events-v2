// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useModalFocusTrap } from './useModalFocusTrap'

afterEach(() => {
  cleanup()
})

function TestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dialogRef, closeRef } = useModalFocusTrap(open, onClose)
  if (!open) return null
  return (
    <div ref={dialogRef} role="dialog">
      <button ref={closeRef}>Close</button>
    </div>
  )
}

describe('useModalFocusTrap', () => {
  it('focuses the close button when opened', () => {
    render(<TestModal open onClose={() => {}} />)
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close' }),
    )
  })

  it('restores focus to the previously-focused element when closed', () => {
    document.body.innerHTML = '<button id="trigger">open</button>'
    const trigger = document.getElementById('trigger') as HTMLButtonElement
    trigger.focus()

    const { rerender } = render(<TestModal open onClose={() => {}} />)
    expect(document.activeElement).not.toBe(trigger)

    rerender(<TestModal open={false} onClose={() => {}} />)
    expect(document.activeElement).toBe(trigger)
  })

  it('locks body scroll while open and restores it on close', () => {
    const original = document.body.style.overflow
    const { rerender } = render(<TestModal open onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<TestModal open={false} onClose={() => {}} />)
    expect(document.body.style.overflow).toBe(original)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<TestModal open onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('refocuses the close button when Tab is pressed, trapping focus', () => {
    render(<TestModal open onClose={() => {}} />)
    const closeButton = screen.getByRole('button', { name: 'Close' })
    closeButton.blur()
    expect(document.activeElement).not.toBe(closeButton)

    fireEvent.keyDown(window, { key: 'Tab' })

    expect(document.activeElement).toBe(closeButton)
  })
})
