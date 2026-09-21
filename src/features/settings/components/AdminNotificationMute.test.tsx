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

  it('renders the duration dropdown with all seven options, defaulting to Off', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil: null }))

    render(<AdminNotificationMute />)

    const select =
      await screen.findByLabelText<HTMLSelectElement>('Mute duration')
    const options = Array.from(select.options).map((o) => o.text)
    expect(options).toEqual([
      'Off — resume notifications',
      '10 minutes',
      '30 minutes',
      '1 hour',
      '2 hours',
      '4 hours',
      '6 hours',
    ])
    expect(select.value).toBe('0')
  })

  it('renders the enabled Resume button by default for an admin with no active mute', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil: null }))

    render(<AdminNotificationMute />)

    const button = await screen.findByRole('button', {
      name: 'Resume notifications',
    })
    expect(button).not.toBeDisabled()
  })

  it('updates the button label when a duration is selected', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil: null }))

    render(<AdminNotificationMute />)

    const select = await screen.findByLabelText('Mute duration')
    fireEvent.change(select, { target: { value: String(3_600_000) } })

    expect(
      screen.getByRole('button', {
        name: 'Silence all notifications for 1 hour',
      }),
    ).toBeInTheDocument()
  })

  it('renders the button and status line on mount when a mute is already active, and the button is not disabled', async () => {
    const mutedUntil = Date.now() + 5 * 60_000
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true, mutedUntil }))

    render(<AdminNotificationMute />)

    const button = await screen.findByRole('button', {
      name: 'Resume notifications',
    })
    expect(button).not.toBeDisabled()
    expect(screen.getByText(/All notifications silenced/)).toBeInTheDocument()
  })

  it('selecting a duration and submitting POSTs the parsed durationMs and shows the silenced status', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(200, {
              mutedUntil: Date.now() + 3_600_000,
              durationMs: 3_600_000,
            }),
          )
        }
        return Promise.resolve(
          jsonResponse(200, { isAdmin: true, mutedUntil: null }),
        )
      })
    globalThis.fetch = fetchMock

    render(<AdminNotificationMute />)

    const select = await screen.findByLabelText('Mute duration')
    fireEvent.change(select, { target: { value: String(3_600_000) } })

    const button = screen.getByRole('button', {
      name: 'Silence all notifications for 1 hour',
    })
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/mute',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    const postCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toEqual({
      durationMs: 3_600_000,
    })

    await waitFor(() => {
      expect(screen.getByText(/All notifications silenced/)).toBeInTheDocument()
    })
  })

  it('submitting 0 while a mute is active POSTs durationMs 0 and clears the status line', async () => {
    const initialMutedUntil = Date.now() + 5 * 60_000
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(200, { mutedUntil: null, durationMs: 0 }),
          )
        }
        return Promise.resolve(
          jsonResponse(200, { isAdmin: true, mutedUntil: initialMutedUntil }),
        )
      })
    globalThis.fetch = fetchMock

    render(<AdminNotificationMute />)

    await screen.findByText(/All notifications silenced/)

    const button = screen.getByRole('button', { name: 'Resume notifications' })
    expect(button).not.toBeDisabled()
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/push/mute',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    const postCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toEqual({
      durationMs: 0,
    })

    await waitFor(() => {
      expect(
        screen.queryByText(/All notifications silenced/),
      ).not.toBeInTheDocument()
    })
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

  it('shows the generic error message and re-enables the button when a silence POST fails', async () => {
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

    const select = await screen.findByLabelText('Mute duration')
    fireEvent.change(select, { target: { value: String(600_000) } })

    const button = screen.getByRole('button', {
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

  it('shows the resume-specific error message when a duration-0 POST fails', async () => {
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
      name: 'Resume notifications',
    })
    fireEvent.click(button)

    await waitFor(() => {
      expect(
        screen.getByText('Could not resume notifications. Please try again.'),
      ).toBeInTheDocument()
    })

    expect(button).not.toBeDisabled()
  })
})
