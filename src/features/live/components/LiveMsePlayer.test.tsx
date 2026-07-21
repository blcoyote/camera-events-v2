// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveMsePlayer, mseWsUrl } from './LiveMsePlayer'

const videoRtcMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    mode: string
    background: boolean
    src: string
    ondisconnect: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('#/features/live/vendor/video-rtc.js', () => {
  class MockVideoRTC extends HTMLElement {
    mode = ''
    background = false
    _src = ''
    ondisconnect = vi.fn()

    set src(value: string) {
      this._src = value
    }

    get src() {
      return this._src
    }
  }

  return { VideoRTC: MockVideoRTC }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  videoRtcMocks.instances.length = 0
  if (customElements.get('video-stream')) {
    // jsdom doesn't support un-defining custom elements; nothing to clean up.
  }
})

describe('mseWsUrl', () => {
  it('builds a wss:// URL for an https origin', () => {
    expect(
      mseWsUrl('garage', { protocol: 'https:', host: 'example.com' }),
    ).toBe('wss://example.com/api/live/garage/ws')
  })

  it('builds a ws:// URL for an http origin', () => {
    expect(
      mseWsUrl('garage', { protocol: 'http:', host: 'localhost:3000' }),
    ).toBe('ws://localhost:3000/api/live/garage/ws')
  })

  it('URL-encodes the camera name', () => {
    expect(
      mseWsUrl('front porch', { protocol: 'https:', host: 'example.com' }),
    ).toBe('wss://example.com/api/live/front%20porch/ws')
  })
})

describe('LiveMsePlayer', () => {
  it('renders a container with a camera-name caption', () => {
    render(<LiveMsePlayer camera="garage" />)
    expect(screen.getByText('garage')).toBeInTheDocument()
  })

  it('does not show an error overlay on initial (SSR-safe) render', () => {
    render(<LiveMsePlayer camera="garage" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mounts a video-stream element wired to the camera-scoped WS URL', async () => {
    const { container } = render(<LiveMsePlayer camera="garage" />)

    await waitFor(() => {
      const el = container.querySelector('video-stream') as unknown as {
        src: string
        mode: string
      } | null
      expect(el).not.toBeNull()
      expect(el?.src).toContain('/api/live/garage/ws')
    })
  })

  it('sets MSE-only mode on the video-stream element', async () => {
    const { container } = render(<LiveMsePlayer camera="garage" />)

    await waitFor(() => {
      const el = container.querySelector('video-stream') as unknown as {
        mode: string
      } | null
      expect(el?.mode).toBe('mse')
    })
  })

  describe('error handling', () => {
    it('shows a Retry button when the player reports an error', async () => {
      const { container } = render(<LiveMsePlayer camera="garage" />)

      await waitFor(() => {
        expect(container.querySelector('video-stream')).not.toBeNull()
      })

      const el = container.querySelector('video-stream') as HTMLElement
      fireEvent(el, new Event('error'))

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('clears the error overlay and re-creates the element when Retry is clicked', async () => {
      const { container } = render(<LiveMsePlayer camera="garage" />)

      await waitFor(() => {
        expect(container.querySelector('video-stream')).not.toBeNull()
      })

      const el = container.querySelector('video-stream') as HTMLElement
      fireEvent(el, new Event('error'))
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      expect(
        screen.queryByRole('button', { name: 'Retry' }),
      ).not.toBeInTheDocument()

      await waitFor(() => {
        expect(container.querySelector('video-stream')).not.toBeNull()
      })
    })
  })

  describe('camera switching / unmount', () => {
    it('tears down the previous element (calls ondisconnect) when the camera changes', async () => {
      const { container, rerender } = render(<LiveMsePlayer camera="garage" />)

      let firstEl: { ondisconnect: ReturnType<typeof vi.fn> }
      await waitFor(() => {
        const el = container.querySelector('video-stream')
        expect(el).not.toBeNull()
        firstEl = el as unknown as { ondisconnect: ReturnType<typeof vi.fn> }
      })

      rerender(<LiveMsePlayer camera="kitchen" />)

      await waitFor(() => {
        const el = container.querySelector('video-stream') as unknown as {
          src: string
        } | null
        expect(el?.src).toContain('/api/live/kitchen/ws')
      })

      expect(firstEl!.ondisconnect).toHaveBeenCalled()
    })

    it('calls ondisconnect on unmount (no leaked sockets)', async () => {
      const { container, unmount } = render(<LiveMsePlayer camera="garage" />)

      let el: { ondisconnect: ReturnType<typeof vi.fn> }
      await waitFor(() => {
        const found = container.querySelector('video-stream')
        expect(found).not.toBeNull()
        el = found as unknown as { ondisconnect: ReturnType<typeof vi.fn> }
      })

      unmount()

      expect(el!.ondisconnect).toHaveBeenCalled()
    })
  })
})
