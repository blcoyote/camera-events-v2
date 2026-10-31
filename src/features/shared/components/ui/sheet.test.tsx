import { withLocale } from '#/test-utils/locale'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet'

afterEach(cleanup)

function renderSheet(
  props: {
    side?: 'left' | 'right' | 'top' | 'bottom'
    onOpenChange?: (o: boolean) => void
  } = {},
) {
  return render(
    <Sheet open onOpenChange={props.onOpenChange}>
      <SheetContent side={props.side}>
        <SheetTitle>Navigation</SheetTitle>
        <SheetDescription>Pick a page</SheetDescription>
      </SheetContent>
    </Sheet>,
  )
}

describe('Sheet', () => {
  it('renders a dialog named by SheetTitle', () => {
    renderSheet()
    expect(screen.getByRole('dialog', { name: 'Navigation' })).not.toBeNull()
  })
  it('calls onOpenChange(false) on Escape', () => {
    const fn = vi.fn()
    renderSheet({ onOpenChange: fn })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(fn).toHaveBeenCalledWith(false)
  })
  it('renders an overlay', () => {
    renderSheet()
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull()
  })
  it('paints the overlay with the bg-overlay token', () => {
    renderSheet()
    const overlay = document.querySelector('[data-slot="sheet-overlay"]')
    expect(overlay?.className).toContain('bg-overlay')
  })
  it('applies slide-in-from-left for side=left', () => {
    renderSheet({ side: 'left' })
    expect(screen.getByRole('dialog').className).toContain('slide-in-from-left')
  })
  it('defaults to the right side', () => {
    renderSheet()
    expect(screen.getByRole('dialog').className).toContain(
      'slide-in-from-right',
    )
  })
  it('renders a Close button that closes', () => {
    const fn = vi.fn()
    renderSheet({ onOpenChange: fn })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(fn).toHaveBeenCalledWith(false)
  })
  it('forwards overlayProps to the overlay', () => {
    render(
      <Sheet open>
        <SheetContent overlayProps={{ 'data-testid': 'ov' }}>
          <SheetTitle>T</SheetTitle>
        </SheetContent>
      </Sheet>,
    )
    expect(screen.getByTestId('ov').getAttribute('data-slot')).toBe(
      'sheet-overlay',
    )
  })
})

describe('Sheet in Danish', () => {
  it('localises the close button', () => {
    const restore = withLocale('da')
    try {
      renderSheet()
      expect(screen.getByRole('button', { name: 'Luk' })).not.toBeNull()
    } finally {
      restore()
    }
  })
})
