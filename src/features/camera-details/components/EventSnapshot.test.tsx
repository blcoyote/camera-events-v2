// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { EventSnapshot } from './EventSnapshot'

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

describe('EventSnapshot', () => {
  it('uses the snapshot URL for the given event', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/api/events/front_door.123/snapshot')
  })

  it('sets alt text from the label and camera', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    expect(
      screen.getByAltText('Snapshot of Person detected by Front Door'),
    ).toBeInTheDocument()
  })

  it('renders a fullscreen button', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    expect(
      screen.getByRole('button', { name: 'View fullscreen' }),
    ).toBeInTheDocument()
  })

  it('renders the lightbox closed by default', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    expect(mockSnapshotLightbox).toHaveBeenCalledWith(
      expect.objectContaining({ open: false }),
    )
  })

  it('opens the lightbox with the current snapshot when the fullscreen button is clicked', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'View fullscreen' }))

    expect(mockSnapshotLightbox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        src: '/api/events/front_door.123/snapshot',
        alt: 'Snapshot of Person detected by Front Door',
      }),
    )
  })

  it('closes the lightbox when its onClose is invoked', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
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
