// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveViewPage } from './LiveViewPage'

vi.mock('#/features/live-view/components/LiveSnapshot', () => ({
  LiveSnapshot: ({ cameraName }: { cameraName: string }) => (
    <div data-testid="live-snapshot">{cameraName}</div>
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('#/features/shared/navigation/useBreadcrumbs', () => ({
  useBreadcrumbs: () => [
    { label: 'Cameras', to: '/cameras' },
    { label: 'front_porch' },
  ],
}))

afterEach(() => {
  cleanup()
})

describe('LiveViewPage', () => {
  it('renders the camera name as a heading', () => {
    render(<LiveViewPage cameraName="front_porch" />)
    expect(
      screen.getByRole('heading', { name: 'front_porch' }),
    ).toBeInTheDocument()
  })

  it('renders the h1 visually hidden on phones', () => {
    render(<LiveViewPage cameraName="front_porch" />)
    expect(screen.getByRole('heading', { name: 'front_porch' })).toHaveClass(
      'sr-only',
      'sm:not-sr-only',
    )
  })

  it('renders the live snapshot for the camera', () => {
    render(<LiveViewPage cameraName="front_porch" />)
    expect(screen.getByTestId('live-snapshot')).toHaveTextContent('front_porch')
  })

  it('renders breadcrumbs linking back to cameras', () => {
    render(<LiveViewPage cameraName="front_porch" />)
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav.querySelector('a')).toHaveAttribute('href', '/cameras')
  })
})
