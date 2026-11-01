import { afterEach, describe, expect, it } from 'vitest'
import { withLocale } from '#/test-utils/locale'
import {
  getEventsPageState,
  getLabelOptions,
  getCameraOptions,
  filterEvents,
} from '#/features/camera-events/pages/CameraEventsListPage'
import {
  formatRelativeTime,
  getLabelDotColor,
} from '#/features/shared/utils/eventFormatting'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

function makeEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1.0-abc',
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
    start_time: Date.now() / 1000 - 60,
    end_time: Date.now() / 1000,
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
      box: [0.5, 0.5, 0.1, 0.2],
      region: [0, 0, 1, 1],
      score: 0.85,
      top_score: 0.85,
      type: 'object',
    },
    ...overrides,
  }
}

describe('getEventsPageState', () => {
  it('returns error state when result is not ok', () => {
    const state = getEventsPageState({ ok: false, error: 'fail' })
    expect(state.kind).toBe('error')
  })

  it('returns empty state when no events', () => {
    const state = getEventsPageState({ ok: true, data: [] })
    expect(state.kind).toBe('empty')
  })

  it('returns events state with events', () => {
    const state = getEventsPageState({ ok: true, data: [makeEvent()] })
    expect(state.kind).toBe('events')
  })
})

describe('getLabelOptions', () => {
  const events = [
    makeEvent({ label: 'person', camera: 'front' }),
    makeEvent({ label: 'car', camera: 'front' }),
    makeEvent({ label: 'car', camera: 'front' }),
    makeEvent({ label: 'dog', camera: 'back' }),
  ]

  it('counts all events without a camera filter, sorted by count desc then label', () => {
    expect(getLabelOptions(events, null, null)).toEqual([
      { label: 'car', count: 2 },
      { label: 'dog', count: 1 },
      { label: 'person', count: 1 },
    ])
  })

  it('counts only events of the camera filter and drops empty labels', () => {
    expect(getLabelOptions(events, 'front', null)).toEqual([
      { label: 'car', count: 2 },
      { label: 'person', count: 1 },
    ])
  })

  it('keeps the active label with count 0', () => {
    expect(getLabelOptions(events, 'front', 'dog')).toEqual([
      { label: 'car', count: 2 },
      { label: 'person', count: 1 },
      { label: 'dog', count: 0 },
    ])
  })
})

describe('getCameraOptions', () => {
  const events = [
    makeEvent({ label: 'person', camera: 'garage' }),
    makeEvent({ label: 'car', camera: 'garage' }),
    makeEvent({ label: 'car', camera: 'backyard' }),
    makeEvent({ label: 'dog', camera: 'attic' }),
  ]

  it('returns cameras sorted by name with counts', () => {
    expect(getCameraOptions(events, null, null)).toEqual([
      { camera: 'attic', count: 1 },
      { camera: 'backyard', count: 1 },
      { camera: 'garage', count: 2 },
    ])
  })

  it('counts against the label filter and drops empty cameras', () => {
    expect(getCameraOptions(events, 'car', null)).toEqual([
      { camera: 'backyard', count: 1 },
      { camera: 'garage', count: 1 },
    ])
  })

  it('keeps the active camera with count 0', () => {
    expect(getCameraOptions(events, 'car', 'attic')).toEqual([
      { camera: 'attic', count: 0 },
      { camera: 'backyard', count: 1 },
      { camera: 'garage', count: 1 },
    ])
  })
})

describe('filterEvents', () => {
  const events = [
    makeEvent({ label: 'person', camera: 'front' }),
    makeEvent({ label: 'car', camera: 'front' }),
    makeEvent({ label: 'person', camera: 'back' }),
  ]

  it('returns all events when no filters', () => {
    expect(filterEvents(events, null, null)).toHaveLength(3)
  })

  it('filters by label', () => {
    expect(filterEvents(events, 'person', null)).toHaveLength(2)
  })

  it('filters by camera', () => {
    expect(filterEvents(events, null, 'front')).toHaveLength(2)
  })

  it('filters by both', () => {
    expect(filterEvents(events, 'person', 'front')).toHaveLength(1)
  })
})

describe('formatRelativeTime', () => {
  it('shows "Just now" for recent timestamps', () => {
    const now = Date.now() / 1000
    expect(formatRelativeTime(now - 30)).toBe('Just now')
  })

  it('shows minutes for timestamps under an hour', () => {
    const now = Date.now() / 1000
    expect(formatRelativeTime(now - 300)).toBe('5m ago')
  })

  it('shows hours for timestamps under a day', () => {
    const now = Date.now() / 1000
    expect(formatRelativeTime(now - 7200)).toBe('2h ago')
  })

  describe('in Danish', () => {
    let restore = () => {}
    afterEach(() => restore())

    it.each([
      [30, 'Lige nu'],
      [300, '5 min. siden'],
      [7200, '2 t. siden'],
      [172800, '2 d. siden'],
    ])('formats %is ago as "%s"', (secondsAgo, expected) => {
      restore = withLocale('da')
      const now = Date.now() / 1000
      expect(formatRelativeTime(now - secondsAgo)).toBe(expected)
    })
  })
})

describe('getLabelDotColor', () => {
  it('returns a color for known labels', () => {
    expect(getLabelDotColor('person')).toBe('#4fb8b2')
    expect(getLabelDotColor('car')).toBe('#f59e0b')
  })

  it('returns a default color for unknown labels', () => {
    expect(getLabelDotColor('unknown_label')).toBe('#94a3b8')
  })
})
