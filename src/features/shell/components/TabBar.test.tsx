// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import { TabBar } from './TabBar'

let mockUser: unknown = { firstName: 'A' }
let mockPath = '/cameras'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<'a'> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouteContext: () => ({ user: mockUser }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: mockPath } }),
}))

afterEach(() => {
  cleanup()
  mockUser = { firstName: 'A' }
  mockPath = '/cameras'
})

describe('TabBar', () => {
  it('renders nothing when signed out', () => {
    mockUser = null
    const { container } = render(<TabBar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders four tab links in a Primary nav, phone only', () => {
    render(<TabBar />)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toHaveClass('sm:hidden', 'fixed', 'bottom-0')
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Cameras',
      'Events',
      'Favorites',
      'Settings',
    ])
  })

  it('marks only the owning tab as current', () => {
    mockPath = '/live/front'
    render(<TabBar />)
    expect(screen.getByRole('link', { name: 'Cameras' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Events' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('marks no tab current on an unowned path', () => {
    mockPath = '/'
    render(<TabBar />)
    expect(
      screen.getAllByRole('link').some((a) => a.hasAttribute('aria-current')),
    ).toBe(false)
  })

  it('renders an aria-hidden spacer', () => {
    const { container } = render(<TabBar />)
    expect(
      container.querySelector('div[aria-hidden="true"].h-14'),
    ).not.toBeNull()
  })
})
