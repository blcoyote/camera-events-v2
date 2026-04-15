import { describe, expect, it } from 'vitest'
import {
  getDetailPageState,
  formatCameraName,
  formatTimestamp,
  formatDuration,
  getDownloadUrl,
} from '#/features/camera-events/components/CameraEventDetailPage'
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

describe('getDetailPageState', () => {
  it('returns event state when result is ok', () => {
    const event = makeEvent()
    const state = getDetailPageState({ ok: true, data: event })
    expect(state.kind).toBe('event')
    if (state.kind === 'event') {
      expect(state.event).toBe(event)
    }
  })

  it('returns error state with 404 message when not found', () => {
    const state = getDetailPageState({ ok: false, error: 'HTTP 404', status: 404 })
    expect(state.kind).toBe('error')
    if (state.kind === 'error') {
      expect(state.message).toContain("doesn't exist")
    }
  })

  it('returns error state with generic message on other errors', () => {
    const state = getDetailPageState({ ok: false, error: 'timeout' })
    expect(state.kind).toBe('error')
    if (state.kind === 'error') {
      expect(state.message).toContain('Could not load event')
    }
  })
})

describe('formatCameraName', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatCameraName('front_porch')).toBe('Front Porch')
  })

  it('handles single word', () => {
    expect(formatCameraName('garage')).toBe('Garage')
  })
})

describe('formatTimestamp', () => {
  it('returns a formatted date string', () => {
    // 2026-04-14 12:00 UTC
    const ts = new Date('2026-04-14T12:00:00Z').getTime() / 1000
    const result = formatTimestamp(ts)
    expect(result).toContain('Apr')
    expect(result).toContain('14')
  })
})

describe('formatDuration', () => {
  it('formats seconds-only durations', () => {
    expect(formatDuration(100, 130)).toBe('30s')
  })

  it('formats minute durations', () => {
    expect(formatDuration(100, 280)).toBe('3m')
  })

  it('formats mixed minute and second durations', () => {
    expect(formatDuration(100, 235)).toBe('2m 15s')
  })
})

describe('getDownloadUrl', () => {
  it('returns clip API path for clip kind', () => {
    expect(getDownloadUrl('abc.123', 'clip')).toBe('/api/events/abc.123/clip')
  })

  it('returns snapshot API path with download param for snapshot kind', () => {
    expect(getDownloadUrl('abc.123', 'snapshot')).toBe(
      '/api/events/abc.123/snapshot?download=true',
    )
  })
})
