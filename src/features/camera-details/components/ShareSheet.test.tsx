// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { formatDateTime } from '#/features/shared/utils/intl'

const mockGetRecipients = vi.fn()
vi.mock('#/features/shared/server/users/users-fns', () => ({
  getShareRecipientsFn: () => mockGetRecipients(),
}))

const { ShareSheet, MAX_SHARE_RECIPIENTS } = await import('./ShareSheet')
const { ShareButton } = await import('./ShareButton')

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
  it('shows loading, then lists recipients as labelled switches', async () => {
    setup()
    expect(screen.getByText(m.details_share_loading())).toBeInTheDocument()
    expect(
      await screen.findByRole('switch', { name: 'Alice' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Bob' })).toBeInTheDocument()
  })

  it('shows label and time as the sheet description when given', async () => {
    render(
      <ShareSheet
        eventId="1.0-abc"
        open
        onOpenChange={vi.fn()}
        label="person"
        startTime={1_700_000_000}
      />,
    )
    const expected = `${translateLabel('person', getLocale())} · ${formatDateTime(1_700_000_000, getLocale())}`
    expect(await screen.findByText(expected)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(expected)
  })

  it('toggles a recipient by clicking their name', async () => {
    setup()
    fireEvent.click(await screen.findByText('Alice'))
    expect(screen.getByRole('switch', { name: 'Alice' })).toBeChecked()
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
    fireEvent.click(await screen.findByRole('switch', { name: 'Alice' }))
    expect(sendBtn()).toBeEnabled()
    fireEvent.click(screen.getByRole('switch', { name: 'Alice' }))
    expect(sendBtn()).toBeDisabled()
  })

  it('posts the selected recipients', async () => {
    setup()
    fireEvent.click(await screen.findByRole('switch', { name: 'Bob' }))
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
    fireEvent.click(await screen.findByRole('switch', { name: 'Alice' }))
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(sendBtn())
    })
    expect(screen.getByRole('status')).toHaveTextContent(m.details_share_sent())
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an alert and stays open when the post fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    const onOpenChange = setup()
    fireEvent.click(await screen.findByRole('switch', { name: 'Alice' }))
    fireEvent.click(sendBtn())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      m.details_share_error(),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('ignores a stale send after close and reopen', async () => {
    let resolveFetch!: (v: { ok: boolean; status: number }) => void
    mockFetch.mockReturnValue(new Promise((r) => (resolveFetch = r)))
    const onOpenChange = vi.fn()
    const ui = (open: boolean) => (
      <ShareSheet eventId="1.0-abc" open={open} onOpenChange={onOpenChange} />
    )
    const { rerender } = render(ui(true))
    fireEvent.click(await screen.findByRole('switch', { name: 'Alice' }))
    fireEvent.click(sendBtn())
    rerender(ui(false))
    rerender(ui(true))
    fireEvent.click(await screen.findByRole('switch', { name: 'Bob' }))
    vi.useFakeTimers()
    await act(async () => {
      resolveFetch({ ok: true, status: 204 })
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('status')).not.toHaveTextContent(
      m.details_share_sent(),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Bob' })).toBeChecked()
  })

  it('does not call onOpenChange after unmount with a pending close timer', async () => {
    const onOpenChange = vi.fn()
    const { unmount } = render(
      <ShareSheet eventId="1.0-abc" open onOpenChange={onOpenChange} />,
    )
    fireEvent.click(await screen.findByRole('switch', { name: 'Alice' }))
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(sendBtn())
    })
    unmount()
    vi.advanceTimersByTime(2000)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('caps the selection at MAX_SHARE_RECIPIENTS', async () => {
    mockGetRecipients.mockResolvedValue(
      Array.from({ length: MAX_SHARE_RECIPIENTS + 1 }, (_, i) => ({
        sub: `u${i}`,
        displayName: `User${i}`,
        avatarUrl: null,
      })),
    )
    setup()
    await screen.findByRole('switch', { name: 'User0' })
    for (let i = 0; i < MAX_SHARE_RECIPIENTS; i++) {
      fireEvent.click(screen.getByRole('switch', { name: `User${i}` }))
    }
    const last = screen.getByRole('switch', {
      name: `User${MAX_SHARE_RECIPIENTS}`,
    })
    expect(last).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'User0' })).toBeEnabled()
  })

  it('returns focus to the Share button on Escape', async () => {
    const user = userEvent.setup()
    render(<ShareButton eventId="1.0-abc" />)
    const btn = screen.getByRole('button', { name: m.details_share() })
    await user.click(btn)
    await screen.findByRole('switch', { name: 'Alice' })
    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(btn).toHaveFocus())
  })
})
