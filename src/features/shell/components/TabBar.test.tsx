// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import { TabBar } from './TabBar'
import { withLocale } from '#/test-utils/locale'
import { useTabBarViewportRepair } from './useTabBarViewportRepair'

vi.mock('./useTabBarViewportRepair', () => ({
  useTabBarViewportRepair: vi.fn(),
}))

let mockUser: unknown = { firstName: 'A' }
let mockPath = '/cameras'
let mockSearch: Record<string, unknown> = {}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    activeOptions,
    ...props
  }: ComponentProps<'a'> & {
    to: string
    children: ReactNode
    activeOptions?: unknown
  }) => (
    <a href={to} data-active-options={JSON.stringify(activeOptions)} {...props}>
      {children}
    </a>
  ),
  useRouteContext: () => ({ user: mockUser }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: mockPath, search: mockSearch } }),
}))

afterEach(() => {
  cleanup()
  mockUser = { firstName: 'A' }
  mockPath = '/cameras'
  mockSearch = {}
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

  it('uses exact, search-less active matching on every tab', () => {
    render(<TabBar />)
    for (const a of screen.getAllByRole('link')) {
      expect(
        JSON.parse(a.getAttribute('data-active-options') ?? 'null'),
      ).toEqual({ exact: true, includeSearch: false })
    }
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

  it('marks Favorites current on an event opened from favorites', () => {
    mockPath = '/camera-events/abc'
    mockSearch = { from: 'favorites' }
    render(<TabBar />)
    expect(screen.getByRole('link', { name: 'Favorites' })).toHaveAttribute(
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

  describe('shared indicator', () => {
    const getIndicator = (c: HTMLElement) =>
      c.querySelector<HTMLElement>('[data-testid="tab-indicator"]')

    it('renders exactly one aria-hidden indicator outside the links', () => {
      const { container } = render(<TabBar />)
      expect(
        container.querySelectorAll('[data-testid="tab-indicator"]'),
      ).toHaveLength(1)
      expect(getIndicator(container)).toHaveAttribute('aria-hidden', 'true')
      for (const a of screen.getAllByRole('link')) {
        expect(a.querySelector('.bg-brand')).toBeNull()
      }
    })

    it('positions over the active tab', () => {
      const { container, rerender } = render(<TabBar />)
      expect(getIndicator(container)?.style.transform).toBe('translateX(0%)')
      expect(getIndicator(container)?.style.opacity).toBe('1')
      mockPath = '/favorites'
      rerender(<TabBar />)
      expect(getIndicator(container)?.style.transform).toBe('translateX(200%)')
      mockPath = '/settings/x'
      rerender(<TabBar />)
      expect(getIndicator(container)?.style.transform).toBe('translateX(300%)')
    })

    it('has transition classes', () => {
      const { container } = render(<TabBar />)
      expect(getIndicator(container)).toHaveClass(
        'transition-[transform,opacity]',
        'duration-250',
      )
    })

    it('fades out in place when no tab owns the path', () => {
      mockPath = '/camera-events'
      const { container, rerender } = render(<TabBar />)
      expect(getIndicator(container)?.style.transform).toBe('translateX(100%)')
      mockPath = '/'
      rerender(<TabBar />)
      expect(getIndicator(container)?.style.opacity).toBe('0')
      expect(getIndicator(container)?.style.transform).toBe('translateX(100%)')
    })

    it('is invisible on first render at an unowned path', () => {
      mockPath = '/'
      const { container } = render(<TabBar />)
      expect(getIndicator(container)?.style.opacity).toBe('0')
    })
  })

  it('passes a ref attached to the nav to the viewport repair hook', () => {
    render(<TabBar />)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const ref = vi.mocked(useTabBarViewportRepair).mock.calls[0]?.[0]
    expect(ref?.current).toBe(nav)
  })

  it('renders an aria-hidden spacer', () => {
    const { container } = render(<TabBar />)
    expect(
      container.querySelector('div[aria-hidden="true"].h-14'),
    ).not.toBeNull()
  })
})

describe('TabBar in Danish', () => {
  it('translates the nav name and tab labels', () => {
    const restore = withLocale('da')
    try {
      render(<TabBar />)
      expect(
        screen.getByRole('navigation', { name: 'Primær' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Hændelser')).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
