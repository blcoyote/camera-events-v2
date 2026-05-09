// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
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

vi.mock('./EventSnapshot', () => ({
  EventSnapshot: () =>
    React.createElement('div', { 'data-testid': 'snapshot' }),
}))

vi.mock('./SnapshotLightbox', () => ({
  SnapshotLightbox: () => null,
}))

vi.mock('./InfoCard', () => ({
  InfoCard: () => null,
}))

// Import component AFTER mocks
const { CameraEventDetailPage } = await import('./CameraEventDetailPage')

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
})
