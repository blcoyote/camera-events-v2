// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockEventCard = vi.fn((_props: unknown) => null)
vi.mock('#/features/shared/components/EventCard', () => ({
  EventCard: (props: unknown) => mockEventCard(props),
}))

vi.mock('#/features/shared/components/FilterPill', () => ({
  FilterPill: () => null,
}))

// Import component AFTER mocks
const { CameraEventsListPage } = await import('./CameraEventsListPage')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(id: string): FrigateEvent {
  return {
    id,
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
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CameraEventsListPage', () => {
  describe('favoritedIds prop', () => {
    it('passes initialFavorited=true to EventCard for favorited event', () => {
      const events = [makeEvent('evt-1'), makeEvent('evt-2')]
      render(
        <CameraEventsListPage
          result={{ ok: true, data: events }}
          favoritedIds={new Set(['evt-1'])}
        />,
      )
      const evt1Props = mockEventCard.mock.calls.find(
        (call) => (call[0] as Record<string, unknown>).event === events[0],
      )?.[0] as Record<string, unknown>
      expect(evt1Props.initialFavorited).toBe(true)
    })

    it('passes initialFavorited=false to EventCard for non-favorited event', () => {
      const events = [makeEvent('evt-1'), makeEvent('evt-2')]
      render(
        <CameraEventsListPage
          result={{ ok: true, data: events }}
          favoritedIds={new Set(['evt-1'])}
        />,
      )
      const evt2Props = mockEventCard.mock.calls.find(
        (call) => (call[0] as Record<string, unknown>).event === events[1],
      )?.[0] as Record<string, unknown>
      expect(evt2Props.initialFavorited).toBe(false)
    })

    it('passes initialFavorited=false for all cards when favoritedIds is empty', () => {
      const events = [makeEvent('evt-1'), makeEvent('evt-2')]
      render(
        <CameraEventsListPage
          result={{ ok: true, data: events }}
          favoritedIds={new Set()}
        />,
      )
      const allProps = mockEventCard.mock.calls.map(
        (call) => (call[0] as Record<string, unknown>).initialFavorited,
      )
      expect(allProps).toEqual([false, false])
    })

    it('defaults to all unfavorited when favoritedIds prop is omitted', () => {
      const events = [makeEvent('evt-1')]
      render(<CameraEventsListPage result={{ ok: true, data: events }} />)
      const props = mockEventCard.mock.calls[0]?.[0] as Record<string, unknown>
      expect(props.initialFavorited).toBe(false)
    })
  })
})
