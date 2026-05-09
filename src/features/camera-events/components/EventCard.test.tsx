// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { EventCard } from './EventCard'

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

function makeEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1713095000.123456-abcdef',
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
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
    ...overrides,
  }
}

describe('EventCard', () => {
  it('renders an accessible link to the event detail page', () => {
    render(<EventCard event={makeEvent()} index={0} isFavorited={false} />)
    expect(
      screen.getByRole('link', { name: /person detected by front_porch/i }),
    ).toBeTruthy()
  })

  it('renders the camera name', () => {
    render(
      <EventCard
        event={makeEvent({ camera: 'back_door' })}
        index={0}
        isFavorited={false}
      />,
    )
    expect(screen.getByText('back_door')).toBeTruthy()
  })

  it('shows the FavoriteButton in the unfavorited state', () => {
    render(<EventCard event={makeEvent()} index={0} isFavorited={false} />)
    const btn = screen.getByRole('button', {
      name: 'Favorite Person detected by front_porch',
    })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows the FavoriteButton in the favorited state', () => {
    render(<EventCard event={makeEvent()} index={0} isFavorited={true} />)
    const btn = screen.getByRole('button', {
      name: 'Favorite Person detected by front_porch',
    })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })
})
