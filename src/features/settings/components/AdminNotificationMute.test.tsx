// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AdminNotificationMute } from './AdminNotificationMute'

const originalFetch = globalThis.fetch

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

describe('AdminNotificationMute', () => {
  it('renders nothing when the GET responds with isAdmin: false and mutedUntil: null', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { isAdmin: false, mutedUntil: null }),
      )

    const { container } = render(<AdminNotificationMute />)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/push/mute',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the GET rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const { container } = render(<AdminNotificationMute />)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the GET responds 401', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }))

    const { container } = render(<AdminNotificationMute />)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the enabled button for an admin with no active mute', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil: null }))

    render(<AdminNotificationMute />)

    const button = await screen.findByRole('button', {
      name: 'Silence all notifications for 10 minutes',
    })
    expect(button).not.toBeDisabled()
  })

  it('renders the disabled button and status line on mount when a mute is already active', async () => {
    const mutedUntil = Date.now() + 5 * 60_000
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil }))

    render(<AdminNotificationMute />)

    const button = await screen.findByRole('button', {
      name: 'Silence all notifications for 10 minutes',
    })
    expect(button).toBeDisabled()
    expect(screen.getByText(/All notifications silenced/)).toBeInTheDocument()
  })

  it('clicking the button POSTs to /api/push/mute and then shows the silenced status with a countdown', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(200, {
              mutedUntil: Date.now() + 600_000,
              durationMs: 600_000,
            }),
          )
        }
        return Promise.resolve(
          jsonResponse(200, { isAdmin: true, mutedUntil: null }),
        )
      })
    globalThis.fetch = fetchMock

    render(<AdminNotificationMute />)

    const button = await screen.findByRole('button', {
      name: 'Silence all notifications for 10 minutes',
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/mute',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/All notifications silenced/)).toBeInTheDocument()
    })

    expect(button).toBeDisabled()
  })

  it('ticks the countdown while muted', async () => {
    vi.useFakeTimers()
    const mutedUntil = Date.now() + 10_000
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil }))

    render(<AdminNotificationMute />)

    // Flush the mount effect's fetch promise under fake timers.
    await vi.waitFor(() => {
      expect(screen.getByText(/All notifications silenced/)).toBeInTheDocument()
    })

    const before = screen.getByText(/All notifications silenced/).textContent

    vi.advanceTimersByTime(3000)

    await vi.waitFor(() => {
      expect(
        screen.getByText(/All notifications silenced/).textContent,
      ).not.toBe(before)
    })
  })

  it('shows an error message and re-enables the button when the POST fails', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(jsonResponse(500, { error: 'boom' }))
        }
        return Promise.resolve(
          jsonResponse(200, { isAdmin: true, mutedUntil: null }),
        )
      })
    globalThis.fetch = fetchMock

    render(<AdminNotificationMute />)

    const button = await screen.findByRole('button', {
      name: 'Silence all notifications for 10 minutes',
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(
        screen.getByText('Could not silence notifications. Please try again.'),
      ).toBeInTheDocument()
    })

    expect(button).not.toBeDisabled()
  })
})
