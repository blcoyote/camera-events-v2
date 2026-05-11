// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}))

vi.mock('#/features/shared/components/EventCard', () => ({
  EventCard: vi.fn(
    ({
      event,
      initialFavorited,
    }: {
      event: FrigateEvent
      index: number
      initialFavorited?: boolean
    }) => (
      <div
        data-testid="event-card"
        data-event-id={event.id}
        data-initial-favorited={String(initialFavorited)}
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

describe('FavoritesPage', () => {
  it('renders one EventCard per event', () => {
    render(<FavoritesPage events={[makeEvent('evt-1'), makeEvent('evt-2')]} />)
    const cards = screen.getAllByTestId('event-card')
    expect(cards).toHaveLength(2)
  })

  it('passes initialFavorited=true to every EventCard', () => {
    render(<FavoritesPage events={[makeEvent('evt-1'), makeEvent('evt-2')]} />)
    const cards = screen.getAllByTestId('event-card')
    cards.forEach((card) => {
      expect(card.dataset.initialFavorited).toBe('true')
    })
  })

  it('renders empty state headline when no events', () => {
    render(<FavoritesPage events={[]} />)
    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument()
  })

  it('renders a "Browse events" link to /camera-events in empty state', () => {
    render(<FavoritesPage events={[]} />)
    const link = screen.getByRole('link', { name: /browse events/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/camera-events')
  })

  it('does not render event cards in empty state', () => {
    render(<FavoritesPage events={[]} />)
    expect(screen.queryByTestId('event-card')).not.toBeInTheDocument()
  })

  it('renders section with accessible label when events present', () => {
    render(<FavoritesPage events={[makeEvent('evt-1')]} />)
    expect(
      screen.getByRole('region', { name: /favorited events/i }),
    ).toBeInTheDocument()
  })
})
