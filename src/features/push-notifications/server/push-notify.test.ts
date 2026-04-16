import { describe, it, expect } from 'vitest'
import {
  formatCameraName,
  formatLabel,
  formatTime,
  buildSinglePayload,
  buildBundledPayload,
} from './push-notify'
import type { FrigateEventInfo } from './event-batcher'

function makeEvent(
  overrides: Partial<FrigateEventInfo> = {},
): FrigateEventInfo {
  return {
    id: '1713182400.123-abc',
    camera: 'front_porch',
    label: 'person',
    startTime: 1713182400,
    ...overrides,
  }
}

describe('formatCameraName', () => {
  it('replaces underscores and title-cases', () => {
    expect(formatCameraName('front_porch')).toBe('Front Porch')
  })

  it('handles single-word names', () => {
    expect(formatCameraName('driveway')).toBe('Driveway')
  })

  it('handles names with multiple underscores', () => {
    expect(formatCameraName('back_yard_gate')).toBe('Back Yard Gate')
  })
})

describe('formatLabel', () => {
  it('capitalizes the first letter', () => {
    expect(formatLabel('person')).toBe('Person')
    expect(formatLabel('car')).toBe('Car')
  })

  it('handles already-capitalized labels', () => {
    expect(formatLabel('Dog')).toBe('Dog')
  })
})

describe('formatTime', () => {
  it('formats a unix timestamp to HH:MM', () => {
    // 1713182400 = 2024-04-15T12:00:00Z
    const result = formatTime(1713182400)
    // Just check format — the exact time depends on the test machine's locale
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('buildSinglePayload', () => {
  it('builds a payload linking to the event detail page', () => {
    const payload = buildSinglePayload(makeEvent())
    expect(payload.title).toBe('Front Porch')
    expect(payload.body).toContain('Person detected at')
    expect(payload.url).toBe('/camera-events/1713182400.123-abc')
    expect(payload.icon).toBe('/logo192.png')
  })

  it('includes the label and time in the body', () => {
    const payload = buildSinglePayload(makeEvent({ label: 'car' }))
    expect(payload.body).toMatch(/Car detected at \d{2}:\d{2}/)
  })
})

describe('buildBundledPayload', () => {
  it('builds a payload linking to the events list', () => {
    const events = [
      makeEvent({ id: 'evt1', label: 'person' }),
      makeEvent({ id: 'evt2', label: 'car' }),
      makeEvent({ id: 'evt3', label: 'dog' }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    expect(payload.title).toBe('Front Porch')
    expect(payload.body).toContain('3 new events')
    expect(payload.body).toContain('Person')
    expect(payload.body).toContain('Car')
    expect(payload.body).toContain('Dog')
    expect(payload.url).toBe('/camera-events')
    expect(payload.icon).toBe('/logo192.png')
  })

  it('deduplicates labels', () => {
    const events = [
      makeEvent({ id: 'evt1', label: 'person' }),
      makeEvent({ id: 'evt2', label: 'person' }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    expect(payload.body).toContain('2 new events')
    // "Person" should appear only once in the summary
    const matches = payload.body.match(/Person/g)
    expect(matches).toHaveLength(1)
  })

  it('truncates labels beyond 3 with +N more', () => {
    const events = [
      makeEvent({ id: 'e1', label: 'person' }),
      makeEvent({ id: 'e2', label: 'car' }),
      makeEvent({ id: 'e3', label: 'dog' }),
      makeEvent({ id: 'e4', label: 'cat' }),
      makeEvent({ id: 'e5', label: 'bird' }),
    ]
    const payload = buildBundledPayload('driveway', events)
    expect(payload.body).toContain('+2 more')
  })

  it('uses the latest start time', () => {
    const events = [
      makeEvent({ id: 'e1', startTime: 1713182400 }),
      makeEvent({ id: 'e2', startTime: 1713182500 }),
    ]
    const payload = buildBundledPayload('front_porch', events)
    // Should use startTime 1713182500 for the time display
    const time = new Date(1713182500 * 1000).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(payload.body).toContain(time)
  })
})
