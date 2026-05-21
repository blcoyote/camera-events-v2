// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockToggle = vi.fn()
const mockUseFavoriteToggle = vi.fn(() => ({
  favorited: false,
  pending: false,
  error: null,
  toggle: mockToggle,
}))

vi.mock('#/features/shared/hooks/useFavoriteToggle', () => ({
  useFavoriteToggle: mockUseFavoriteToggle,
}))

const mockFavoriteButton = vi.fn((_props: unknown) => null)
vi.mock('#/features/shared/components/FavoriteButton', () => ({
  FavoriteButton: (props: unknown) => mockFavoriteButton(props),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}))

const mockEventSnapshot = vi.fn((_props: unknown) => null)
vi.mock('./EventSnapshot', () => ({
  EventSnapshot: (props: unknown) => {
    mockEventSnapshot(props)
    return React.createElement('div', { 'data-testid': 'snapshot' })
  },
}))

const mockSnapshotLightbox = vi.fn((_props: unknown) => null)
vi.mock('./SnapshotLightbox', () => ({
  SnapshotLightbox: (props: unknown) => {
    mockSnapshotLightbox(props)
    return null
  },
}))

const mockEventClipPlayer = vi.fn(
  (_props: { onError?: () => void; eventId: string }) => null,
)
vi.mock('./EventClipPlayer', () => ({
  EventClipPlayer: (props: { onError?: () => void; eventId: string }) => {
    mockEventClipPlayer(props)
    return React.createElement('video', {
      'data-testid': 'clip-player',
      src: `/api/events/${props.eventId}/clip`,
    })
  },
}))

vi.mock('./InfoCard', () => ({
  InfoCard: () => null,
}))

// Import component AFTER mocks
const { CameraEventDetailPage, getDownloadUrl } =
  await import('./CameraEventDetailPage')

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
    has_snapshot: false,
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

function successResult(
  overrides?: Partial<FrigateEvent>,
): FrigateResult<FrigateEvent> {
  return { ok: true, data: makeEvent(overrides) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDownloadUrl', () => {
  it('appends ?download=true to the clip URL so the proxy sets Content-Disposition: attachment', () => {
    expect(getDownloadUrl('front_door.123', 'clip')).toBe(
      '/api/events/front_door.123/clip?download=true',
    )
  })

  it('appends ?download=true to the snapshot URL', () => {
    expect(getDownloadUrl('front_door.123', 'snapshot')).toBe(
      '/api/events/front_door.123/snapshot?download=true',
    )
  })
})

describe('CameraEventDetailPage', () => {
  describe('with a successful result', () => {
    it('calls useFavoriteToggle with (event.id, true) when initialFavorited=true', () => {
      const event = makeEvent()
      render(
        <CameraEventDetailPage
          result={successResult()}
          initialFavorited={true}
        />,
      )
      expect(mockUseFavoriteToggle).toHaveBeenCalledWith(event.id, true)
    })

    it('calls useFavoriteToggle with (event.id, false) when initialFavorited is omitted', () => {
      const event = makeEvent()
      render(<CameraEventDetailPage result={successResult()} />)
      expect(mockUseFavoriteToggle).toHaveBeenCalledWith(event.id, false)
    })

    it('renders a FavoriteButton with the correct eventId', () => {
      const event = makeEvent()
      render(<CameraEventDetailPage result={successResult()} />)
      expect(mockFavoriteButton).toHaveBeenCalled()
      const props = mockFavoriteButton.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect(props.eventId).toBe(event.id)
    })

    it('passes the toggle function from useFavoriteToggle as onToggle to FavoriteButton', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      const props = mockFavoriteButton.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect(props.onToggle).toBe(mockToggle)
    })
  })

  describe('error result', () => {
    it('does not render a FavoriteButton on error', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'Not found', status: 404 }}
        />,
      )
      // Hook is called (React rules: no conditional hooks), but button not rendered
      expect(mockFavoriteButton).not.toHaveBeenCalled()
    })

    it('calls useFavoriteToggle even on error (hooks must be unconditional)', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'Not found', status: 404 }}
        />,
      )
      expect(mockUseFavoriteToggle).toHaveBeenCalled()
    })
  })

  describe('clip accordion (lazy-mounted player)', () => {
    it('renders a "Watch clip" accordion summary when has_clip=true', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const summary = screen.getByText(/watch clip/i)
      expect(summary).toBeInTheDocument()
    })

    it('does NOT mount the EventClipPlayer until the accordion is opened (no preload on page load)', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      // Player must be absent from the DOM initially — no <video> means no
      // metadata fetch against /api/events/{id}/clip on page load.
      expect(document.querySelector('[data-testid="clip-player"]')).toBeNull()
      expect(mockEventClipPlayer).not.toHaveBeenCalled()
    })

    it('mounts the player when the accordion is opened', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const details = document.querySelector('details') as HTMLDetailsElement
      expect(details).not.toBeNull()
      expect(details.open).toBe(false)

      // Native <details> exposes open as a boolean property; flipping it
      // dispatches a 'toggle' event that React's onToggle picks up.
      details.open = !details.open
      fireEvent(details, new Event('toggle', { bubbles: false }))

      expect(mockEventClipPlayer).toHaveBeenCalled()
      expect(
        document.querySelector('[data-testid="clip-player"]'),
      ).toBeInTheDocument()
    })

    it('keeps the player mounted after the accordion is closed again (latched)', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const details = document.querySelector('details') as HTMLDetailsElement

      details.open = !details.open
      fireEvent(details, new Event('toggle', { bubbles: false }))
      expect(
        document.querySelector('[data-testid="clip-player"]'),
      ).toBeInTheDocument()

      details.open = !details.open
      fireEvent(details, new Event('toggle', { bubbles: false }))
      // Latched — player stays mounted so re-expanding is instant.
      expect(
        document.querySelector('[data-testid="clip-player"]'),
      ).toBeInTheDocument()
    })

    it('does NOT render the accordion when has_clip is false', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: false, has_snapshot: true })}
        />,
      )
      expect(screen.queryByText(/watch clip/i)).toBeNull()
      expect(document.querySelector('details')).toBeNull()
    })

    it('places the accordion below the snapshot in DOM order', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const snapshot = document.querySelector('[data-testid="snapshot"]')
      const details = document.querySelector('details')
      expect(snapshot).toBeInTheDocument()
      expect(details).toBeInTheDocument()
      // DOCUMENT_POSITION_FOLLOWING: details follows snapshot in DOM order.
      const relation = snapshot?.compareDocumentPosition(details!)
      expect(relation! & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('renders the accordion and the snapshot together when both clip and snapshot exist', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      expect(
        document.querySelector('[data-testid="snapshot"]'),
      ).toBeInTheDocument()
      expect(document.querySelector('details')).toBeInTheDocument()
    })

    it('with has_clip=true and has_snapshot=false, renders only the accordion (no snapshot block)', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: false })}
        />,
      )
      expect(document.querySelector('details')).toBeInTheDocument()
      expect(document.querySelector('[data-testid="snapshot"]')).toBeNull()
    })

    it('keeps the snapshot and favorite rendered when the opened player errors', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const details = document.querySelector('details') as HTMLDetailsElement
      details.open = !details.open
      fireEvent(details, new Event('toggle', { bubbles: false }))

      const playerProps = mockEventClipPlayer.mock.calls.at(-1)?.[0]
      expect(playerProps?.onError).toBeDefined()
      playerProps?.onError?.()

      expect(
        document.querySelector('[data-testid="snapshot"]'),
      ).toBeInTheDocument()
      expect(mockFavoriteButton).toHaveBeenCalled()
    })
  })
})
