// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
    document.body.classList.remove('overflow-hidden')
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
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Navigation')
  })

  it('renders all five nav links when open', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Cameras')).toBeTruthy()
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.getByText('Events')).toBeTruthy()
    expect(screen.getByText('Favorites')).toBeTruthy()
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('nav links point to the correct routes', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Cameras').closest('a')?.getAttribute('href')).toBe(
      '/cameras',
    )
    expect(screen.getByText('Live').closest('a')?.getAttribute('href')).toBe(
      '/live',
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

  it('frosts the drawer panel with a backdrop blur', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog').className).toContain('backdrop-blur')
  })

  it('does not blur the overlay backdrop', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('nav-drawer-backdrop').className).not.toContain(
      'backdrop-blur',
    )
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<NavDrawer isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('nav-drawer-backdrop'))
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

  it('calls onClose when a nav link is clicked', () => {
    const onClose = vi.fn()
    render(<NavDrawer isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cameras'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('adds overflow-hidden to document.body when open', () => {
    render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(document.body.classList.contains('overflow-hidden')).toBe(true)
  })

  it('removes overflow-hidden from document.body when closed', () => {
    const { rerender } = render(<NavDrawer isOpen={true} onClose={vi.fn()} />)
    expect(document.body.classList.contains('overflow-hidden')).toBe(true)
    rerender(<NavDrawer isOpen={false} onClose={vi.fn()} />)
    expect(document.body.classList.contains('overflow-hidden')).toBe(false)
  })
})
