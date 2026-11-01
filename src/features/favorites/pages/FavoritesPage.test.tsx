// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import type { FavoriteEntry } from '#/features/shared/server/favorites/types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}))

vi.mock('#/features/shared/components/EventCard', () => ({
  EventCard: vi.fn(
    ({
      event,
      initialFavorited,
      sharedBy,
    }: {
      event: FrigateEvent
      index: number
      initialFavorited?: boolean
      sharedBy?: (string | null)[]
    }) => (
      <div
        data-testid="event-card"
        data-event-id={event.id}
        data-initial-favorited={String(initialFavorited)}
        data-shared-by={JSON.stringify(sharedBy)}
      />
    ),
  ),
}))

afterEach(cleanup)

const { FavoritesPage } = await import('./FavoritesPage')

function makeEvent(id: string): FrigateEvent {
  return {
    id,
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
    start_time: 1713095000,
    end_time: 1713095060,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: true,
    has_snapshot: true,
    retain_indefinitely: false,
    plus_id: null,
    box: [0.1, 0.1, 0.3, 0.4],
    top_score: 0.9,
    data: {
      attributes: [],
      box: [0.1, 0.1, 0.3, 0.4],
      region: [0, 0, 1, 1],
      score: 0.9,
      top_score: 0.9,
      type: 'object',
    },
  }
}

function entry(
  id: string,
  favorited = true,
  sharedBy: (string | null)[] = [],
): FavoriteEntry {
  return { event: makeEvent(id), favorited, sharedBy }
}

describe('FavoritesPage', () => {
  it.each([[[]], [['evt-1']]])(
    'renders a phone-hidden h1 header (events: %j)',
    (ids: string[]) => {
      render(<FavoritesPage entries={ids.map((id) => entry(id))} />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Your Favorites' }),
      ).toHaveClass('sr-only', 'sm:not-sr-only')
    },
  )

  it('renders one EventCard per event', () => {
    render(<FavoritesPage entries={[entry('evt-1'), entry('evt-2')]} />)
    const cards = screen.getAllByTestId('event-card')
    expect(cards).toHaveLength(2)
  })

  it('passes each entry favorited flag and sharedBy to its EventCard', () => {
    render(
      <FavoritesPage
        entries={[entry('evt-1'), entry('evt-2', false, ['Alice', null])]}
      />,
    )
    const [a, b] = screen.getAllByTestId('event-card')
    expect(a.dataset.initialFavorited).toBe('true')
    expect(a.dataset.sharedBy).toBe('[]')
    expect(b.dataset.initialFavorited).toBe('false')
    expect(b.dataset.sharedBy).toBe('["Alice",null]')
  })

  it('renders empty state headline when no events', () => {
    render(<FavoritesPage entries={[]} />)
    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument()
  })

  it('renders a "Browse events" link to /camera-events in empty state', () => {
    render(<FavoritesPage entries={[]} />)
    const link = screen.getByRole('link', { name: /browse events/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/camera-events')
  })

  it('does not render event cards in empty state', () => {
    render(<FavoritesPage entries={[]} />)
    expect(screen.queryByTestId('event-card')).not.toBeInTheDocument()
  })

  it('renders section with accessible label when events present', () => {
    render(<FavoritesPage entries={[entry('evt-1')]} />)
    expect(
      screen.getByRole('region', { name: /favorited events/i }),
    ).toBeInTheDocument()
  })

  describe('filter', () => {
    const entries = [
      entry('fav', true, []),
      entry('shr', false, ['Alice']),
      entry('both', true, ['Bob']),
    ]
    const ids = () =>
      screen.getAllByTestId('event-card').map((c) => c.dataset.eventId)

    it('renders pills with counts, All pressed by default', () => {
      render(<FavoritesPage entries={entries} />)
      const group = screen.getByRole('group', { name: 'Filter favorites' })
      expect(group).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^All ?3$/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(
        screen.getByRole('button', { name: /^Favorites ?2$/ }),
      ).toHaveAttribute('aria-pressed', 'false')
      expect(
        screen.getByRole('button', { name: /^Shared ?2$/ }),
      ).toBeInTheDocument()
      expect(ids()).toEqual(['fav', 'shr', 'both'])
    })

    it('Favorites shows only favorited; Shared only shared; both appears in each', async () => {
      const user = userEvent.setup()
      render(<FavoritesPage entries={entries} />)
      await user.click(screen.getByRole('button', { name: /^Favorites ?2$/ }))
      expect(ids()).toEqual(['fav', 'both'])
      await user.click(screen.getByRole('button', { name: /^Shared ?2$/ }))
      expect(ids()).toEqual(['shr', 'both'])
    })

    it('empty Shared shows its message and keeps the pills', async () => {
      const user = userEvent.setup()
      render(<FavoritesPage entries={[entry('fav')]} />)
      await user.click(screen.getByRole('button', { name: /^Shared ?0$/ }))
      expect(
        screen.getByText('Nothing has been shared with you yet'),
      ).toBeInTheDocument()
      expect(screen.queryByTestId('event-card')).not.toBeInTheDocument()
      expect(
        screen.getByRole('group', { name: 'Filter favorites' }),
      ).toBeInTheDocument()
    })

    it('empty Favorites shows its message', async () => {
      const user = userEvent.setup()
      render(<FavoritesPage entries={[entry('shr', false, ['A'])]} />)
      await user.click(screen.getByRole('button', { name: /^Favorites ?0$/ }))
      expect(screen.getByText('No favorites yet')).toBeInTheDocument()
    })

    it('renders no pill group with zero entries', () => {
      render(<FavoritesPage entries={[]} />)
      expect(screen.queryByRole('group')).not.toBeInTheDocument()
    })
  })
})
