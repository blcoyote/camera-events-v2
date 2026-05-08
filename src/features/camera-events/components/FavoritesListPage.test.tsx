// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { FavoritesListPage } from './FavoritesListPage'

vi.mock('#/features/camera-events/server/favorites', () => ({
  toggleFavoriteFn: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string
    params?: Record<string, string>
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={to.replace('$id', params?.id ?? '')} {...rest}>
      {children}
    </a>
  ),
}))

afterEach(() => cleanup())

function makeEvent(id: string, camera = 'front_porch'): FrigateEvent {
  return {
    id,
    label: 'person',
    sub_label: null,
    camera,
    start_time: 1713095000,
    end_time: 1713095010,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: false,
    has_snapshot: false,
    retain_indefinitely: false,
    plus_id: null,
    box: null,
    top_score: null,
    data: {
      attributes: [],
      box: [0, 0, 0, 0],
      region: [0, 0, 0, 0],
      score: 0.9,
      top_score: 0.9,
      type: 'object',
    },
  }
}

describe('FavoritesListPage', () => {
  it('renders a card for each event', () => {
    const events = [makeEvent('evt-1'), makeEvent('evt-2'), makeEvent('evt-3')]
    render(
      <FavoritesListPage
        events={events}
        favoriteEventIds={['evt-1', 'evt-2', 'evt-3']}
      />,
    )
    const links = screen.getAllByRole('link', { name: /person detected/i })
    expect(links).toHaveLength(3)
  })

  it('shows empty state when events array is empty', () => {
    render(<FavoritesListPage events={[]} favoriteEventIds={[]} />)
    expect(screen.getByText(/no favorited events yet/i)).toBeTruthy()
  })

  it('passes isFavorited=true to FavoriteButton for events in favoriteEventIds', () => {
    const events = [makeEvent('evt-1'), makeEvent('evt-2')]
    render(<FavoritesListPage events={events} favoriteEventIds={['evt-1']} />)
    const buttons = screen.getAllByRole('button', {
      name: 'Favorite Person detected by front_porch',
    })
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true')
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false')
  })

  it('each card links to the event detail URL', () => {
    const events = [makeEvent('1713095000.123456-aabbcc')]
    render(
      <FavoritesListPage
        events={events}
        favoriteEventIds={['1713095000.123456-aabbcc']}
      />,
    )
    const link = screen.getByRole('link', { name: /person detected/i })
    expect(link.getAttribute('href')).toContain('1713095000.123456-aabbcc')
  })
})
