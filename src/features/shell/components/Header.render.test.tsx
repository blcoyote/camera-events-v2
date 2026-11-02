// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import Header from './Header'
import type { Crumb } from '#/features/shared/navigation/types'

let mockUser: unknown = { firstName: 'A' }
let mockCrumbs: Crumb[] = [{ label: 'Cameras' }]

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search: _search,
    children,
    ...props
  }: ComponentProps<'a'> & {
    to: string
    search?: unknown
    children: ReactNode
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouteContext: () => ({ user: mockUser }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: '/', search: {} } }),
}))
vi.mock('#/features/shared/navigation/useBreadcrumbs', () => ({
  useBreadcrumbs: () => mockCrumbs,
}))
vi.mock('#/features/auth/hooks/useStandaloneAuth', () => ({
  useStandaloneAuth: () => ({ onClick: () => {} }),
}))
vi.mock('#/features/auth/hooks/useSessionRefresh', () => ({
  useSessionRefresh: () => {},
}))
vi.mock('./AvatarMenu', () => ({ AvatarMenu: () => null }))
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }))

afterEach(() => {
  cleanup()
  mockUser = { firstName: 'A' }
  mockCrumbs = [{ label: 'Cameras' }]
})

describe('Header mobile title bar', () => {
  it('renders a back link and title for a two-crumb trail', () => {
    mockCrumbs = [
      { label: 'Favorites', to: '/favorites' },
      { label: 'Person · Front Door' },
    ]
    render(<Header />)
    const back = screen.getByRole('link', { name: 'Back to Favorites' })
    expect(back).toHaveAttribute('href', '/favorites')
    expect(screen.getByText('Person · Front Door')).toBeInTheDocument()
  })

  it('renders no back link for a single crumb', () => {
    render(<Header />)
    expect(screen.queryByRole('link', { name: /^Back to/ })).toBeNull()
    expect(
      screen.getByText('Cameras', { selector: 'span' }),
    ).toBeInTheDocument()
  })

  it('renders neither title nor back when signed out', () => {
    mockUser = null
    mockCrumbs = [{ label: 'Favorites', to: '/favorites' }, { label: 'X' }]
    render(<Header />)
    expect(screen.queryByText('X')).toBeNull()
    expect(screen.queryByRole('link', { name: /^Back to/ })).toBeNull()
  })
})
