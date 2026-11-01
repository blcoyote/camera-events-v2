// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ComponentProps, ReactNode } from 'react'
import { m } from '#/paraglide/messages.js'
import { withLocale } from '#/test-utils/locale'
import { BurstNav } from './BurstNav'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: ComponentProps<'a'> & {
    to: string
    params?: Record<string, string>
    children: ReactNode
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (t, [k, v]) => t.replace(`$${k}`, v),
        to,
      )}
      {...props}
    >
      {children}
    </a>
  ),
}))

afterEach(cleanup)

const prev = { id: 'p1', label: 'person', start_time: 1700000000 }
const next = { id: 'n1', label: 'car', start_time: 1700003600 }

describe('BurstNav', () => {
  it('renders previous and next links', () => {
    render(
      <BurstNav
        camera="front_porch"
        status="ready"
        previous={prev}
        next={next}
      />,
    )
    expect(
      screen.getByRole('navigation', { name: /Front Porch/i }),
    ).toBeInTheDocument()
    expect(document.querySelector('a[href="/camera-events/p1"]')).not.toBeNull()
    expect(document.querySelector('a[href="/camera-events/n1"]')).not.toBeNull()
    expect(screen.getByText(m.details_burst_previous())).toBeInTheDocument()
    expect(screen.getByText(m.details_burst_next())).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: m.details_watch_live() }),
    ).toBeNull()
  })

  it('shows nothing-since text when next is null', () => {
    render(
      <BurstNav camera="driveway" status="ready" previous={prev} next={null} />,
    )
    expect(
      screen.getByText(m.details_burst_nothing_since({ camera: 'Driveway' })),
    ).toBeInTheDocument()
    expect(screen.queryByText(m.details_burst_next())).toBeNull()
  })

  it('renders nothing on the previous side when null', () => {
    render(
      <BurstNav camera="driveway" status="ready" previous={null} next={next} />,
    )
    expect(screen.queryByText(m.details_burst_previous())).toBeNull()
  })

  it('while loading renders no links', () => {
    render(
      <BurstNav
        camera="driveway"
        status="loading"
        previous={null}
        next={null}
      />,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText(/since/i)).toBeNull()
  })

  it('on error renders no links', () => {
    render(
      <BurstNav camera="driveway" status="error" previous={null} next={null} />,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders Danish text', () => {
    const restore = withLocale('da')
    render(
      <BurstNav camera="driveway" status="ready" previous={prev} next={null} />,
    )
    expect(screen.getByText('Forrige')).toBeInTheDocument()
    expect(screen.getByText('Intet nyt fra Driveway siden')).toBeInTheDocument()
    restore()
  })
})
