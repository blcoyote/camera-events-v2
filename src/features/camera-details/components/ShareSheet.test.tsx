// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { m } from '#/paraglide/messages.js'

const mockGetRecipients = vi.fn()
vi.mock('#/features/shared/server/users/users-fns', () => ({
  getShareRecipientsFn: () => mockGetRecipients(),
}))

const { ShareSheet } = await import('./ShareSheet')

const RECIPIENTS = [
  { sub: 'a', displayName: 'Alice', avatarUrl: null },
  { sub: 'b', displayName: 'Bob', avatarUrl: null },
]
const mockFetch = vi.fn()

function setup() {
  const onOpenChange = vi.fn()
  render(<ShareSheet eventId="1.0-abc" open onOpenChange={onOpenChange} />)
  return onOpenChange
}

const sendBtn = () =>
  screen.getByRole('button', { name: m.details_share_send() })

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockGetRecipients.mockResolvedValue(RECIPIENTS)
  mockFetch.mockResolvedValue({ ok: true, status: 204 })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('ShareSheet', () => {
  it('shows loading, then lists recipients as labelled checkboxes', async () => {
    setup()
    expect(screen.getByText(m.details_share_loading())).toBeInTheDocument()
    expect(
      await screen.findByRole('checkbox', { name: 'Alice' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    mockGetRecipients.mockResolvedValue([])
    setup()
    expect(await screen.findByText(m.details_share_empty())).toBeInTheDocument()
  })

  it('shows an error when loading recipients fails', async () => {
    mockGetRecipients.mockRejectedValue(new Error('x'))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      m.details_share_error(),
    )
  })

  it('disables Send until a recipient is selected', async () => {
    setup()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Alice' }))
    expect(sendBtn()).toBeEnabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alice' }))
    expect(sendBtn()).toBeDisabled()
  })

  it('posts the selected recipients', async () => {
    setup()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Bob' }))
    fireEvent.click(sendBtn())
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(mockFetch).toHaveBeenCalledWith('/api/events/1.0-abc/share', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientIds: ['b'] }),
    })
  })

  it('shows Sent then closes after a second', async () => {
    const onOpenChange = setup()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Alice' }))
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(sendBtn())
    })
    expect(
      screen.getByRole('button', { name: m.details_share_sent() }),
    ).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an alert and stays open when the post fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    const onOpenChange = setup()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Alice' }))
    fireEvent.click(sendBtn())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      m.details_share_error(),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
