// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import { Breadcrumbs } from './Breadcrumbs'
import type { Crumb } from './types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search,
    activeOptions,
    children,
    ...props
  }: ComponentProps<'a'> & {
    to: string
    search?: unknown
    activeOptions?: unknown
    children: ReactNode
  }) => (
    <a
      href={to}
      data-search={JSON.stringify(search)}
      data-active-options={JSON.stringify(activeOptions)}
      {...props}
    >
      {children}
    </a>
  ),
}))

afterEach(cleanup)

const trail: Crumb[] = [
  { label: 'Events', to: '/camera-events', search: { from: 'favorites' } },
  { label: 'Person · Garage', to: '/ignored' },
]

describe('Breadcrumbs', () => {
  it('renders nothing for zero crumbs', () => {
    const { container } = render(<Breadcrumbs crumbs={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a single crumb', () => {
    const { container } = render(
      <Breadcrumbs crumbs={[{ label: 'Cameras' }]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a nav with the Breadcrumb accessible name', () => {
    render(<Breadcrumbs crumbs={trail} />)
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toBeInTheDocument()
  })

  it('renders one list item per crumb', () => {
    render(<Breadcrumbs crumbs={trail} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('renders parent crumbs as links', () => {
    render(<Breadcrumbs crumbs={trail} />)
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute(
      'href',
      '/camera-events',
    )
  })

  it('renders the last crumb as non-link with aria-current=page', () => {
    render(<Breadcrumbs crumbs={trail} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('Person · Garage')).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('marks separators aria-hidden', () => {
    const { container } = render(<Breadcrumbs crumbs={trail} />)
    const seps = container.querySelectorAll('svg')
    expect(seps).toHaveLength(1)
    expect(seps[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('passes search to the Link', () => {
    render(<Breadcrumbs crumbs={trail} />)
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ from: 'favorites' }),
    )
  })

  it('makes parent crumb links exact so the router never marks them current', () => {
    render(<Breadcrumbs crumbs={trail} />)
    expect(
      JSON.parse(
        screen.getByRole('link', { name: 'Events' }).dataset
          .activeOptions as string,
      ),
    ).toEqual({ exact: true, includeSearch: false })
  })

  it('applies a custom className to the nav', () => {
    render(<Breadcrumbs crumbs={trail} className="custom-x" />)
    expect(screen.getByRole('navigation')).toHaveClass('custom-x')
  })
})
