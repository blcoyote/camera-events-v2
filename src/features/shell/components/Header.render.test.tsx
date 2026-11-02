// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import Header from './Header'
import type { Crumb } from '#/features/shared/navigation/types'

let mockUser: unknown = { firstName: 'A' }
let mockCrumbs: Crumb[] = [{ label: 'Cameras' }]
let mockLocation: { pathname: string; search: Record<string, unknown> } = {
  pathname: '/',
  search: {},
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search: _search,
    activeOptions,
    children,
    ...props
  }: ComponentProps<'a'> & {
    to: string
    search?: unknown
    activeOptions?: unknown
    children: ReactNode
  }) => (
    <a href={to} data-active-options={JSON.stringify(activeOptions)} {...props}>
      {children}
    </a>
  ),
  useRouteContext: () => ({ user: mockUser }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: mockLocation }),
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
  mockLocation = { pathname: '/', search: {} }
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

describe('Header back link', () => {
  it('is exact so the router never marks it current', () => {
    mockCrumbs = [
      { label: 'Favorites', to: '/favorites' },
      { label: 'Person · Front Door' },
    ]
    render(<Header />)
    const back = screen.getByRole('link', { name: 'Back to Favorites' })
    expect(JSON.parse(back.dataset.activeOptions as string)).toEqual({
      exact: true,
      includeSearch: false,
    })
  })
})

describe('Header desktop nav', () => {
  const desktop = () => screen.getByText('Events').closest('div') as HTMLElement
  const link = (name: string) =>
    Array.from(desktop().querySelectorAll('a')).find(
      (a) => a.textContent === name,
    ) as HTMLElement

  it('highlights the origin tab on event detail', () => {
    mockLocation = {
      pathname: '/camera-events/abc',
      search: { from: 'favorites' },
    }
    render(<Header />)
    expect(link('Favorites')).toHaveAttribute('aria-current', 'page')
    expect(link('Favorites')).toHaveClass('is-active')
    expect(link('Events')).not.toHaveAttribute('aria-current')
    expect(link('Events')).not.toHaveClass('is-active')
  })

  it('highlights Events on the events list', () => {
    mockLocation = { pathname: '/camera-events', search: {} }
    render(<Header />)
    expect(link('Events')).toHaveAttribute('aria-current', 'page')
    expect(link('Favorites')).not.toHaveAttribute('aria-current')
  })

  it('makes nav links exact so the router adds no aria-current itself', () => {
    render(<Header />)
    expect(JSON.parse(link('Events').dataset.activeOptions as string)).toEqual({
      exact: true,
      includeSearch: false,
    })
  })
})
