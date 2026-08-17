// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveSnapshot } from './LiveSnapshot'

vi.mock('#/features/live-view/hooks/useLiveSnapshot', () => ({
  useLiveSnapshot: () => '/api/cameras/front_porch/latest?t=123',
}))

afterEach(() => {
  cleanup()
})

describe('LiveSnapshot', () => {
  it('renders the snapshot image using the src from useLiveSnapshot', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    const img = screen.getByAltText('Live snapshot from front_porch')
    expect(img).toHaveAttribute('src', '/api/cameras/front_porch/latest?t=123')
  })

  it('renders a live indicator', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})
