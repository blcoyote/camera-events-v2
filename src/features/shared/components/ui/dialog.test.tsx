// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'

afterEach(cleanup)

function renderDialog(onOpenChange?: (o: boolean) => void, showClose = true) {
  return render(
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={showClose}>
        <DialogTitle>Snapshot</DialogTitle>
        <DialogDescription>Details</DialogDescription>
      </DialogContent>
    </Dialog>,
  )
}

describe('Dialog', () => {
  it('renders a dialog with accessible name', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Snapshot' })).not.toBeNull()
  })
  it('close button calls onOpenChange(false)', () => {
    const fn = vi.fn()
    renderDialog(fn)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(fn).toHaveBeenCalledWith(false)
  })
  it('Escape calls onOpenChange(false)', () => {
    const fn = vi.fn()
    renderDialog(fn)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(fn).toHaveBeenCalledWith(false)
  })
  it('omits the close button when showCloseButton=false', () => {
    renderDialog(undefined, false)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
  it('paints the default overlay with the bg-overlay token', () => {
    renderDialog()
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).not.toBeNull()
    expect(overlay?.className).toContain('bg-overlay')
  })
  describe('variant="bare"', () => {
    it('drops the glass card styling and fills the viewport', () => {
      render(
        <Dialog open>
          <DialogContent variant="bare" showCloseButton={false}>
            <DialogTitle>Bare</DialogTitle>
          </DialogContent>
        </Dialog>,
      )
      const dialog = screen.getByRole('dialog', { name: 'Bare' })
      expect(dialog.className).not.toContain('glass-strong')
      expect(dialog.className).toContain('inset-0')
    })
    it('keeps the default variant glass styling', () => {
      renderDialog()
      expect(screen.getByRole('dialog').className).toContain('glass-strong')
    })
  })
})
