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

  it('renders the live snapshot for the camera', () => {
    render(<LiveViewPage cameraName="front_porch" />)
    expect(screen.getByTestId('live-snapshot')).toHaveTextContent('front_porch')
  })
})
