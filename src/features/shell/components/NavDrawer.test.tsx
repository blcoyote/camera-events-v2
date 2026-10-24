// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavDrawer } from './NavDrawer'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    onClick,
    className,
    activeProps: _activeProps,
    ...props
  }: {
    children: ReactNode
    to: string
    onClick?: () => void
    className?: string
    activeProps?: object
    [key: string]: unknown
  }) => (
    <a href={to} onClick={onClick} className={className} {...props}>
      {children}
    </a>
  ),
}))

describe('NavDrawer', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders nothing when isOpen is false', () => {
    render(<NavDrawer isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders dialog when isOpen is true', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('has aria-modal="true" and aria-label="Navigation"', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders all four nav links when open', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Cameras')).toBeTruthy()
    expect(screen.getByText('Events')).toBeTruthy()
    expect(screen.getByText('Favorites')).toBeTruthy()
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('nav links point to the correct routes', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Cameras').closest('a')?.getAttribute('href')).toBe(
      '/cameras',
    )
    expect(screen.getByText('Events').closest('a')?.getAttribute('href')).toBe(
      '/camera-events',
    )
    expect(
      screen.getByText('Favorites').closest('a')?.getAttribute('href'),
    ).toBe('/favorites')
    expect(
      screen.getByText('Settings').closest('a')?.getAttribute('href'),
    ).toBe('/settings')
  })

  it('frosts the drawer panel with the glass-strong (backdrop blur) utility', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog').className).toContain('glass-strong')
  })

  it('does not blur the overlay backdrop', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('nav-drawer-backdrop').className).not.toContain(
      'backdrop-blur',
    )
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<NavDrawer isOpen={true} onClose={onClose} />)
    await userEvent.click(screen.getByTestId('nav-drawer-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<NavDrawer isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<NavDrawer isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close navigation'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('focuses the close button when opened', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(document.activeElement).toBe(
      screen.getByLabelText('Close navigation'),
    )
  })

  it('exposes a "Drawer navigation" landmark', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(
      screen.getByRole('navigation', { name: 'Drawer navigation' }),
    ).toBeTruthy()
  })

  it('applies the id prop to the dialog', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} id="drawer-x" />)
    expect(screen.getByRole('dialog').id).toBe('drawer-x')
  })

  it('calls onClose when a nav link is clicked', () => {
    const onClose = vi.fn()
    render(<NavDrawer isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cameras'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks body scroll when open (Radix data-scroll-locked)', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
  })

  it('releases the body scroll lock when closed', () => {
    const { rerender } = render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
    rerender(<NavDrawer isOpen={false} onClose={vi.fn()} />)
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
  })

  it('onCloseAutoFocus can restore focus to the opener after keyboard close', async () => {
    const user = userEvent.setup()
    const onCloseAutoFocus = vi.fn()

    function Harness() {
      const [open, setOpen] = useState(false)
      const openerRef = useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={openerRef} onClick={() => setOpen(true)}>
            Open
          </button>
          <NavDrawer
            isOpen={open}
            onClose={() => setOpen(false)}
            onCloseAutoFocus={(e) => {
              onCloseAutoFocus()
              e.preventDefault()
              openerRef.current?.focus()
            }}
          />
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(opener))
    expect(onCloseAutoFocus).toHaveBeenCalledOnce()
  })
})
