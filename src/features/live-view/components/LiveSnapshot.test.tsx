// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveSnapshot } from './LiveSnapshot'

vi.mock('#/features/live-view/hooks/useLiveSnapshot', () => ({
  useLiveSnapshot: () => '/api/cameras/front_porch/latest?t=123',
}))

const mockSnapshotLightbox = vi.fn((_props: unknown) => null)
vi.mock('#/features/shared/components/SnapshotLightbox', () => ({
  SnapshotLightbox: (props: unknown) => {
    mockSnapshotLightbox(props)
    return null
  },
}))

afterEach(() => {
  cleanup()
  mockSnapshotLightbox.mockClear()
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

  it('renders a fullscreen button', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    expect(
      screen.getByRole('button', { name: 'View fullscreen' }),
    ).toBeInTheDocument()
  })

  it('renders the lightbox closed by default', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    expect(mockSnapshotLightbox).toHaveBeenCalledWith(
      expect.objectContaining({ open: false }),
    )
  })

  it('opens the lightbox with the current snapshot when the fullscreen button is clicked', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    fireEvent.click(screen.getByRole('button', { name: 'View fullscreen' }))

    expect(mockSnapshotLightbox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        src: '/api/cameras/front_porch/latest?t=123',
        alt: 'Live snapshot from front_porch',
      }),
    )
  })

  it('closes the lightbox when its onClose is invoked', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    fireEvent.click(screen.getByRole('button', { name: 'View fullscreen' }))

    const { onClose } = mockSnapshotLightbox.mock.calls.at(-1)?.[0] as {
      onClose: () => void
    }
    act(() => {
      onClose()
    })

    expect(mockSnapshotLightbox).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: false }),
    )
  })
})
