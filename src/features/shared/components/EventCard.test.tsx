// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { withLocale } from '#/test-utils/locale'
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
  it('renders the label in Danish under the da locale', () => {
    const restore = withLocale('da')
    try {
      const { getByText } = render(
        <EventCard event={makeEvent({ label: 'car' })} index={0} />,
      )
      expect(getByText('Bil')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

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

  it('renders the sub-label chip on a dark scrim over footage', () => {
    const { getByText } = render(
      <EventCard event={makeEvent({ sub_label: 'Brian' })} index={0} />,
    )
    const cls = getByText('Brian').className
    expect(cls).toContain('bg-black/55')
    expect(cls).not.toContain('bg-white/20')
  })

  it('renders no share indicator without sharedBy', () => {
    const { queryByText } = render(<EventCard event={makeEvent()} index={0} />)
    expect(queryByText(/^from /)).toBeNull()
  })

  it('shows "from {name}" for a single sender', () => {
    const { getByText } = render(
      <EventCard event={makeEvent()} index={0} sharedBy={['Alice']} />,
    )
    expect(getByText('from Alice')).toBeInTheDocument()
  })

  it('shows "from {name} +{n}" for several senders', () => {
    const { getByText } = render(
      <EventCard
        event={makeEvent()}
        index={0}
        sharedBy={['Alice', 'Bob', null]}
      />,
    )
    expect(getByText('from Alice +2')).toBeInTheDocument()
  })

  it('truncates the sender text and keeps the full text as title', () => {
    const name = 'a.very.long.email.address@example.com'
    const { getByText } = render(
      <EventCard event={makeEvent()} index={0} sharedBy={[name]} />,
    )
    const text = getByText(`from ${name}`)
    expect(text).toHaveClass('truncate')
    expect(text.parentElement).toHaveAttribute('title', `from ${name}`)
  })

  it('falls back to "someone" for an unknown first sender', () => {
    const { getByText } = render(
      <EventCard event={makeEvent()} index={0} sharedBy={[null]} />,
    )
    expect(getByText('from someone')).toBeInTheDocument()
  })
})

describe('EventCard icon labels in Danish', () => {
  it('localises the recent and clip badges', () => {
    const restore = withLocale('da')
    try {
      const { getByRole } = render(
        <EventCard
          event={makeEvent({ has_clip: true, start_time: Date.now() / 1000 })}
          index={0}
        />,
      )
      expect(getByRole('img', { name: 'Ny hændelse' })).toBeTruthy()
      expect(getByRole('img', { name: 'Har klip' })).toBeTruthy()
    } finally {
      restore()
    }
  })
})
