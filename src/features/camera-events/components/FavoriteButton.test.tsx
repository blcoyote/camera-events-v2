// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import { toggleFavoriteFn } from '../server/favorites'
import { FavoriteButton } from './FavoriteButton'

vi.mock('../server/favorites', () => ({
  toggleFavoriteFn: vi.fn(),
}))

const VALID_ID = '1713095000.123456-abcdef'

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(toggleFavoriteFn).mockResolvedValue({
      ok: true,
      isFavorited: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  // ─── Rendering ───

  it('renders a button with an accessible favorite label', () => {
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-label'),
    ).toBe('Favorite this event')
  })

  it('uses the eventLabel in the aria-label when provided', () => {
    render(
      <FavoriteButton
        eventId={VALID_ID}
        eventLabel="Person detected by front_porch"
        isFavorited={false}
      />,
    )
    expect(
      screen
        .getByRole('button', {
          name: /favorite person detected by front_porch/i,
        })
        .getAttribute('aria-label'),
    ).toBe('Favorite Person detected by front_porch')
  })

  it('sets aria-pressed=false when not favorited', () => {
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('sets aria-pressed=true when favorited', () => {
    render(<FavoriteButton eventId={VALID_ID} isFavorited={true} />)
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  // ─── Click behaviour ───

  it('calls toggleFavoriteFn with the event ID when clicked, exactly once', () => {
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    expect(toggleFavoriteFn).toHaveBeenCalledOnce()
    expect(toggleFavoriteFn).toHaveBeenCalledWith({ data: VALID_ID })
  })

  it('optimistically sets aria-pressed=true immediately on click when unfavorited', () => {
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('optimistically sets aria-pressed=false immediately on click when favorited', () => {
    vi.mocked(toggleFavoriteFn).mockResolvedValue({
      ok: true,
      isFavorited: false,
    })
    render(<FavoriteButton eventId={VALID_ID} isFavorited={true} />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('defers to server isFavorited when it differs from optimistic state', async () => {
    // Server says still unfavorited (e.g. concurrent toggle from another device)
    vi.mocked(toggleFavoriteFn).mockResolvedValue({
      ok: true,
      isFavorited: false,
    })
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    // Optimistically flips to true
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    // Server says false — corrects back
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /favorite/i })
          .getAttribute('aria-pressed'),
      ).toBe('false')
    })
  })

  it('reverts optimistic state and announces error when server call throws', async () => {
    vi.mocked(toggleFavoriteFn).mockRejectedValue(new Error('Network error'))
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /favorite/i })
          .getAttribute('aria-pressed'),
      ).toBe('false')
      expect(screen.getByRole('status').textContent).toMatch(
        /could not update favorite/i,
      )
    })
  })

  it('ignores a second click while a request is in-flight', () => {
    // Never resolves — keeps the request in-flight for the duration of this test
    vi.mocked(toggleFavoriteFn).mockImplementation(() => new Promise(() => {}))
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    const btn = screen.getByRole('button', { name: /favorite/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(toggleFavoriteFn).toHaveBeenCalledOnce()
  })

  it('reverts optimistic state when server returns ok:false', async () => {
    vi.mocked(toggleFavoriteFn).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
    })
    render(<FavoriteButton eventId={VALID_ID} isFavorited={false} />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    // Optimistic flip to true
    expect(
      screen
        .getByRole('button', { name: /favorite/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    // Server says no — reverts and announces error
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /favorite/i })
          .getAttribute('aria-pressed'),
      ).toBe('false')
      expect(screen.getByRole('status').textContent).toMatch(
        /could not update favorite/i,
      )
    })
  })
})
