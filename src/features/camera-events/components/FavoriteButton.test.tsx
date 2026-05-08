// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { toggleFavoriteFn } from '../server/favorites'
import { FavoriteButton } from './FavoriteButton'

vi.mock('../server/favorites', () => ({
  toggleFavoriteFn: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a button with an accessible favorite label', () => {
    render(<FavoriteButton eventId="1713095000.123456-abcdef" />)
    expect(screen.getByRole('button', { name: /favorite/i })).toBeDefined()
  })

  it('calls toggleFavoriteFn with the event ID when clicked, exactly once', () => {
    render(<FavoriteButton eventId="1713095000.123456-abcdef" />)
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    expect(toggleFavoriteFn).toHaveBeenCalledOnce()
    expect(toggleFavoriteFn).toHaveBeenCalledWith({
      data: '1713095000.123456-abcdef',
    })
  })

  it('uses the eventLabel in the aria-label when provided', () => {
    render(
      <FavoriteButton
        eventId="1713095000.123456-abcdef"
        eventLabel="Person detected by front_porch"
      />,
    )
    expect(
      screen.getByRole('button', {
        name: /favorite person detected by front_porch/i,
      }),
    ).toBeDefined()
  })
})
