// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mockDownload = vi.fn()
vi.mock('../hooks/useBlobDownload', () => ({
  useBlobDownload: () => ({ download: mockDownload, downloading: false }),
}))

const { DownloadActions, getDownloadUrl } = await import('./DownloadActions')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('getDownloadUrl', () => {
  it('appends ?download=true to the clip URL', () => {
    expect(getDownloadUrl('front_door.123', 'clip')).toBe(
      '/api/events/front_door.123/clip?download=true',
    )
  })

  it('appends ?download=true to the snapshot URL', () => {
    expect(getDownloadUrl('front_door.123', 'snapshot')).toBe(
      '/api/events/front_door.123/snapshot?download=true',
    )
  })
})

describe('DownloadActions', () => {
  it('renders nothing without clip or snapshot', () => {
    const { container } = render(
      <DownloadActions eventId="e1" hasClip={false} hasSnapshot={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders only the clip button when only a clip exists', () => {
    render(<DownloadActions eventId="e1" hasClip hasSnapshot={false} />)
    expect(screen.getByRole('button', { name: 'Download clip' })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Download snapshot' }),
    ).toBeNull()
  })

  it('downloads the right URL for each button', () => {
    render(<DownloadActions eventId="e1" hasClip hasSnapshot />)
    fireEvent.click(screen.getByRole('button', { name: 'Download clip' }))
    expect(mockDownload).toHaveBeenLastCalledWith(
      '/api/events/e1/clip?download=true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Download snapshot' }))
    expect(mockDownload).toHaveBeenLastCalledWith(
      '/api/events/e1/snapshot?download=true',
    )
  })
})
