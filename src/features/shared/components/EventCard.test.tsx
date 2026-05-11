// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockToggle = vi.fn()
const mockUseFavoriteToggle = vi.fn(() => ({
  favorited: false,
  pending: false,
  error: null,
  toggle: mockToggle,
}))

vi.mock('../hooks/useFavoriteToggle', () => ({
  useFavoriteToggle: mockUseFavoriteToggle,
}))

const mockFavoriteButton = vi.fn((_props: unknown) => null)
vi.mock('./FavoriteButton', () => ({
  FavoriteButton: (props: unknown) => mockFavoriteButton(props),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}))

vi.mock('./EventThumbnail', () => ({
  EventThumbnail: () =>
    React.createElement('div', { 'data-testid': 'thumbnail' }),
}))

vi.mock('#/features/shared/components/MediaCard', () => ({
  MediaCard: ({
    children,
    overlay,
  }: {
    children: React.ReactNode
    overlay: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'media-card' },
      React.createElement('div', { 'data-testid': 'overlay' }, overlay),
      children,
    ),
}))

// Import component AFTER mocks
const { EventCard } = await import('./EventCard')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1713095000.123456-abcdef',
    camera: 'front_porch',
    label: 'person',
    sub_label: null,
    start_time: 1713095000,
    end_time: 1713095060,
    false_positive: null,
    thumbnail: '',
    plus_id: null,
    box: null,
    top_score: null,
    has_clip: false,
    has_snapshot: true,
    retain_indefinitely: false,
    zones: [],
    data: {
      top_score: 0.9,
      score: 0.9,
      attributes: [],
      box: [0, 0, 0, 0],
      region: [0, 0, 0, 0],
      type: 'object',
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EventCard', () => {
  it('renders a FavoriteButton', () => {
    render(<EventCard event={makeEvent()} index={0} />)
    expect(mockFavoriteButton).toHaveBeenCalled()
  })

  it('calls useFavoriteToggle with (event.id, false) when initialFavorited is omitted', () => {
    const event = makeEvent()
    render(<EventCard event={event} index={0} />)
    expect(mockUseFavoriteToggle).toHaveBeenCalledWith(event.id, false)
  })

  it('calls useFavoriteToggle with (event.id, true) when initialFavorited=true', () => {
    const event = makeEvent()
    render(<EventCard event={event} index={0} initialFavorited={true} />)
    expect(mockUseFavoriteToggle).toHaveBeenCalledWith(event.id, true)
  })

  it('passes the toggle function from useFavoriteToggle as onToggle to FavoriteButton', () => {
    const event = makeEvent()
    render(<EventCard event={event} index={0} />)
    const props = mockFavoriteButton.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(props.onToggle).toBe(mockToggle)
  })

  it('passes the correct eventId to FavoriteButton', () => {
    const event = makeEvent()
    render(<EventCard event={event} index={0} />)
    const props = mockFavoriteButton.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(props.eventId).toBe(event.id)
  })
})
