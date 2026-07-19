// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveCameraView } from './LiveCameraView'

const hlsMocks = vi.hoisted(() => ({
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  isSupported: vi.fn(() => true),
}))

vi.mock('hls.js', () => {
  class MockHls {
    static isSupported = hlsMocks.isSupported
    static Events = { ERROR: 'hlsError' }
    loadSource = hlsMocks.loadSource
    attachMedia = hlsMocks.attachMedia
    destroy = hlsMocks.destroy
    on = hlsMocks.on
  }
  return { default: MockHls }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  hlsMocks.isSupported.mockReturnValue(true)
})

describe('LiveCameraView', () => {
  it('renders a video element with playsInline, muted, and an accessible label', () => {
    render(<LiveCameraView camera="garage" />)
    const video = screen.getByLabelText('Live view of garage')
    expect(video.tagName).toBe('VIDEO')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveProperty('muted', true)
  })

  describe('native HLS support (e.g. Safari)', () => {
    let originalCanPlayType: typeof HTMLMediaElement.prototype.canPlayType

    beforeEach(() => {
      originalCanPlayType = HTMLMediaElement.prototype.canPlayType
      HTMLMediaElement.prototype.canPlayType = vi.fn(
        (): CanPlayTypeResult => 'maybe',
      )
    })

    afterEach(() => {
      HTMLMediaElement.prototype.canPlayType = originalCanPlayType
    })

    it('points the video src at the stream URL directly', async () => {
      render(<LiveCameraView camera="garage" />)
      const video = screen.getByLabelText('Live view of garage')
      await waitFor(() => {
        expect(video.getAttribute('src')).toContain('/api/live/garage/stream')
      })
    })
  })

  describe('no native HLS support (e.g. Android/desktop Chrome, Firefox)', () => {
    let originalCanPlayType: typeof HTMLMediaElement.prototype.canPlayType

    beforeEach(() => {
      originalCanPlayType = HTMLMediaElement.prototype.canPlayType
      HTMLMediaElement.prototype.canPlayType = vi.fn(
        (): CanPlayTypeResult => '',
      )
    })

    afterEach(() => {
      HTMLMediaElement.prototype.canPlayType = originalCanPlayType
    })

    it('loads the stream via hls.js and attaches it to the video element', async () => {
      render(<LiveCameraView camera="garage" />)
      const video = screen.getByLabelText('Live view of garage')

      await waitFor(() => {
        expect(hlsMocks.loadSource).toHaveBeenCalledWith(
          expect.stringContaining('/api/live/garage/stream'),
        )
      })
      expect(hlsMocks.attachMedia).toHaveBeenCalledWith(video)
    })
  })

  describe('error handling', () => {
    let originalCanPlayType: typeof HTMLMediaElement.prototype.canPlayType

    beforeEach(() => {
      originalCanPlayType = HTMLMediaElement.prototype.canPlayType
      HTMLMediaElement.prototype.canPlayType = vi.fn(
        (): CanPlayTypeResult => 'maybe',
      )
    })

    afterEach(() => {
      HTMLMediaElement.prototype.canPlayType = originalCanPlayType
    })

    it('shows a Retry button when the video fails to load', async () => {
      render(<LiveCameraView camera="garage" />)
      const video = screen.getByLabelText('Live view of garage')
      await waitFor(() => expect(video.getAttribute('src')).not.toBeNull())

      fireEvent.error(video)

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('clears the error overlay when Retry is clicked', async () => {
      render(<LiveCameraView camera="garage" />)
      const video = screen.getByLabelText('Live view of garage')
      await waitFor(() => expect(video.getAttribute('src')).not.toBeNull())

      fireEvent.error(video)
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      expect(
        screen.queryByRole('button', { name: 'Retry' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('camera switching', () => {
    let originalCanPlayType: typeof HTMLMediaElement.prototype.canPlayType

    beforeEach(() => {
      originalCanPlayType = HTMLMediaElement.prototype.canPlayType
      HTMLMediaElement.prototype.canPlayType = vi.fn(
        (): CanPlayTypeResult => 'maybe',
      )
    })

    afterEach(() => {
      HTMLMediaElement.prototype.canPlayType = originalCanPlayType
    })

    it('updates the video src when the camera prop changes', async () => {
      const { rerender } = render(<LiveCameraView camera="garage" />)
      const video = screen.getByLabelText('Live view of garage')
      await waitFor(() =>
        expect(video.getAttribute('src')).toContain('/api/live/garage/stream'),
      )

      rerender(<LiveCameraView camera="kitchen" />)
      const kitchenVideo = screen.getByLabelText('Live view of kitchen')
      await waitFor(() =>
        expect(kitchenVideo.getAttribute('src')).toContain(
          '/api/live/kitchen/stream',
        ),
      )
    })
  })
})
