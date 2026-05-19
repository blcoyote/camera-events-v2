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

  describe('bounding-box toggle', () => {
    it('renders the toggle with aria-pressed="false" when has_snapshot and event.box is non-zero', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: true,
            box: [0.1, 0.2, 0.3, 0.4],
          })}
        />,
      )
      const toggle = screen.getByRole('button', { name: /show detection box/i })
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
    })

    it('renders the toggle when event.box is null but event.data.box is non-zero', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: true,
            box: null,
            data: {
              top_score: 0.9,
              score: 0.9,
              attributes: [],
              box: [0.5, 0.5, 0.2, 0.2],
              region: [0, 0, 0, 0],
              type: 'object',
            },
          })}
        />,
      )
      expect(
        screen.getByRole('button', { name: /show detection box/i }),
      ).toBeInTheDocument()
    })

    it('does not render the toggle when both boxes are null/zero', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: true,
            box: null,
          })}
        />,
      )
      expect(
        screen.queryByRole('button', { name: /show detection box/i }),
      ).toBeNull()
    })

    it('does not render the toggle when has_snapshot is false even if box is non-zero', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: false,
            box: [0.1, 0.2, 0.3, 0.4],
          })}
        />,
      )
      expect(
        screen.queryByRole('button', { name: /show detection box/i }),
      ).toBeNull()
    })

    it('clicking the toggle flips aria-pressed and updates label + showBoundingBox', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: true,
            box: [0.1, 0.2, 0.3, 0.4],
          })}
        />,
      )

      // Initial: label "Show detection box", aria-pressed="false", snapshot gets showBoundingBox=false
      const initialProps = mockEventSnapshot.mock.calls.at(-1)?.[0] as Record<
        string,
        unknown
      >
      expect(initialProps.showBoundingBox).toBe(false)

      const toggle = screen.getByRole('button', {
        name: /show detection box/i,
      })
      fireEvent.click(toggle)

      // After click: label becomes "Hide detection box" (queryable as such)
      expect(
        screen.getByRole('button', { name: /hide detection box/i }),
      ).toHaveAttribute('aria-pressed', 'true')
      const afterClickProps = mockEventSnapshot.mock.calls.at(
        -1,
      )?.[0] as Record<string, unknown>
      expect(afterClickProps.showBoundingBox).toBe(true)

      fireEvent.click(
        screen.getByRole('button', { name: /hide detection box/i }),
      )
      expect(
        screen.getByRole('button', { name: /show detection box/i }),
      ).toHaveAttribute('aria-pressed', 'false')
      const afterSecondClickProps = mockEventSnapshot.mock.calls.at(
        -1,
      )?.[0] as Record<string, unknown>
      expect(afterSecondClickProps.showBoundingBox).toBe(false)
    })

    it('passes showBoundingBox to SnapshotLightbox so the lightbox can render the boxed image', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: true,
            box: [0.1, 0.2, 0.3, 0.4],
          })}
        />,
      )

      const initialProps = mockSnapshotLightbox.mock.calls.at(
        -1,
      )?.[0] as Record<string, unknown>
      expect(initialProps.showBoundingBox).toBe(false)

      fireEvent.click(
        screen.getByRole('button', { name: /show detection box/i }),
      )

      const afterProps = mockSnapshotLightbox.mock.calls.at(-1)?.[0] as Record<
        string,
        unknown
      >
      expect(afterProps.showBoundingBox).toBe(true)
    })

    it('toggle has the min-h-11 touch-target class', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            has_snapshot: true,
            box: [0.1, 0.2, 0.3, 0.4],
          })}
        />,
      )
      const toggle = screen.getByRole('button', { name: /show detection box/i })
      expect(toggle.className).toContain('min-h-11')
    })
  })

  describe('inline clip player', () => {
    it('renders the EventClipPlayer when has_clip=true', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      expect(
        document.querySelector('[data-testid="clip-player"]'),
      ).toBeInTheDocument()
    })

    it('does NOT render the player when has_clip is false', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: false, has_snapshot: true })}
        />,
      )
      expect(document.querySelector('[data-testid="clip-player"]')).toBeNull()
    })

    it('places the player above the snapshot in DOM order', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const player = document.querySelector('[data-testid="clip-player"]')
      const snapshot = document.querySelector('[data-testid="snapshot"]')
      expect(player).toBeInTheDocument()
      expect(snapshot).toBeInTheDocument()
      const relation = player?.compareDocumentPosition(snapshot!)
      expect(relation).toBeDefined()
      expect(relation! & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('with has_clip=true and has_snapshot=false, renders the player and no snapshot', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: false })}
        />,
      )
      expect(
        document.querySelector('[data-testid="clip-player"]'),
      ).toBeInTheDocument()
      expect(document.querySelector('[data-testid="snapshot"]')).toBeNull()
    })

    it('keeps the snapshot, info cards, and favorite rendered when the player errors', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
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
