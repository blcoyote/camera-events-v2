import { describe, expect, it } from 'vitest'
import {
  getEventsPageState,
  getUniqueLabels,
  getUniqueCameras,
  filterEvents,
  formatRelativeTime,
  formatLabelName,
  getLabelDotColor,
} from '#/pages/camera-events/CameraEventsListPage'
import type { FrigateEvent } from '#/server/frigate/types'

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

describe('getUniqueLabels', () => {
  it('returns sorted unique labels', () => {
    const events = [
      makeEvent({ label: 'car' }),
      makeEvent({ label: 'person' }),
      makeEvent({ label: 'car' }),
    ]
    expect(getUniqueLabels(events)).toEqual(['car', 'person'])
  })
})

describe('getUniqueCameras', () => {
  it('returns sorted unique camera names', () => {
    const events = [
      makeEvent({ camera: 'garage' }),
      makeEvent({ camera: 'backyard' }),
      makeEvent({ camera: 'garage' }),
    ]
    expect(getUniqueCameras(events)).toEqual(['backyard', 'garage'])
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
})

describe('formatLabelName', () => {
  it('capitalizes the first letter', () => {
    expect(formatLabelName('person')).toBe('Person')
    expect(formatLabelName('car')).toBe('Car')
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
