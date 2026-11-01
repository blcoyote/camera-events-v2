// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type React from 'react'
import { withLocale } from '#/test-utils/locale'

const { FavoriteButton } = await import('./FavoriteButton')

const EVENT_ID = '1713095000.123456-abcdef'

function renderFavoriteButton(
  overrides: Partial<React.ComponentProps<typeof FavoriteButton>> = {},
) {
  const defaults = {
    eventId: EVENT_ID,
    favorited: false,
    pending: false,
    error: null,
    onToggle: vi.fn(),
  }
  return render(<FavoriteButton {...defaults} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('FavoriteButton', () => {
  describe('aria-pressed state', () => {
    it('renders button with aria-pressed="false" when favorited=false', () => {
      renderFavoriteButton({ favorited: false })
      const btn = screen.getByRole('button', { name: /favorite/i })
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    })

    it('renders button with aria-pressed="true" when favorited=true', () => {
      renderFavoriteButton({ favorited: true })
      const btn = screen.getByRole('button', { name: /favorite/i })
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('disabled state', () => {
    it('button is NOT disabled when pending=false', () => {
      renderFavoriteButton({ pending: false })
      const btn = screen.getByRole('button', { name: /favorite/i })
      expect(btn).not.toBeDisabled()
    })

    it('button has disabled attribute when pending=true', () => {
      renderFavoriteButton({ pending: true })
      const btn = screen.getByRole('button', { name: 'Saving…' })
      expect(btn).toBeDisabled()
    })

    it('swallows taps that land on the wrapper while pending so an enclosing link is not activated', () => {
      // Button is pointer-events-none when disabled, so the tap hits the wrapper.
      const onParentClick = vi.fn()
      render(
        <a href="/event" onClick={onParentClick}>
          <FavoriteButton
            eventId={EVENT_ID}
            favorited={false}
            pending={true}
            error={null}
            onToggle={vi.fn()}
          />
        </a>,
      )
      const wrapper = screen.getByRole('button', { name: 'Saving…' })
        .parentElement as HTMLElement
      const notPrevented = fireEvent.click(wrapper)
      expect(notPrevented).toBe(false)
      expect(onParentClick).not.toHaveBeenCalled()
    })

    it('lets wrapper taps through when not pending', () => {
      const onParentClick = vi.fn()
      render(
        <a href="/event" onClick={onParentClick}>
          <FavoriteButton
            eventId={EVENT_ID}
            favorited={false}
            pending={false}
            error={null}
            onToggle={vi.fn()}
          />
        </a>,
      )
      const wrapper = screen.getByRole('button', { name: /favorite/i })
        .parentElement as HTMLElement
      fireEvent.click(wrapper)
      expect(onParentClick).toHaveBeenCalledOnce()
    })
  })

  describe('click behavior', () => {
    it('calls onToggle when clicked', () => {
      const onToggle = vi.fn()
      renderFavoriteButton({ onToggle })
      fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
      expect(onToggle).toHaveBeenCalledOnce()
    })

    it('does not call onToggle when disabled (pending=true)', () => {
      const onToggle = vi.fn()
      renderFavoriteButton({ pending: true, onToggle })
      fireEvent.click(screen.getByRole('button', { name: 'Saving…' }))
      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('error state', () => {
    it('shows no alert element when error is null', () => {
      renderFavoriteButton({ error: null })
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('shows an alert element when error is non-null', () => {
      renderFavoriteButton({
        error: 'Could not save favorite. Please try again.',
      })
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    it('displays the error message text', () => {
      const errorMsg = 'Could not save favorite. Please try again.'
      renderFavoriteButton({ error: errorMsg })
      expect(screen.getByText(errorMsg)).toBeTruthy()
    })
  })

  describe('touch target', () => {
    it('button has a minimum 44px touch target via padding class', () => {
      renderFavoriteButton()
      const btn = screen.getByRole('button', { name: /favorite/i })
      // Verify padding class applied (p-2.5 = 10px padding, plus icon = ≥44px)
      expect(btn.className).toMatch(/p-/)
    })
  })

  describe('accessible name (AC10)', () => {
    it('has aria-label "Add to favorites" when not favorited', () => {
      renderFavoriteButton({ favorited: false, pending: false })
      expect(
        screen.getByRole('button', { name: 'Add to favorites' }),
      ).toBeTruthy()
    })

    it('has aria-label "Remove from favorites" when favorited', () => {
      renderFavoriteButton({ favorited: true, pending: false })
      expect(
        screen.getByRole('button', { name: 'Remove from favorites' }),
      ).toBeTruthy()
    })

    it('has aria-label "Saving…" when pending', () => {
      renderFavoriteButton({ pending: true })
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
    })
  })
})

describe('FavoriteButton in Danish', () => {
  it('localises the aria-label', () => {
    const restore = withLocale('da')
    try {
      renderFavoriteButton()
      expect(
        screen.getByRole('button', { name: 'Føj til favoritter' }),
      ).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})

describe('FavoriteButton showLabel', () => {
  it('is icon-only by default', () => {
    renderFavoriteButton()
    expect(screen.queryByText('Favorite')).toBeNull()
  })

  it('shows a visible label and keeps aria-pressed when showLabel', () => {
    renderFavoriteButton({ showLabel: true, favorited: true })
    const btn = screen.getByRole('button', { name: /favorite/i })
    expect(btn).toHaveTextContent('Favorite')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
