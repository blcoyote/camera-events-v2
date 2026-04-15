import { describe, expect, it } from 'vitest'
import {
  PLACEHOLDER_EVENTS,
  findEventById,
} from './mock-events'

describe('PLACEHOLDER_EVENTS', () => {
  it('is a non-empty array', () => {
    expect(PLACEHOLDER_EVENTS.length).toBeGreaterThan(0)
  })

  it('each event has id, title, timestamp, and camera fields', () => {
    for (const event of PLACEHOLDER_EVENTS) {
      expect(typeof event.id).toBe('string')
      expect(typeof event.title).toBe('string')
      expect(typeof event.timestamp).toBe('string')
      expect(typeof event.camera).toBe('string')
    }
  })

  it('all event IDs are unique', () => {
    const ids = PLACEHOLDER_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('findEventById', () => {
  it('returns the event for a known ID', () => {
    const first = PLACEHOLDER_EVENTS[0]
    const found = findEventById(first.id)
    expect(found).toBe(first)
  })

  it('returns undefined for an unknown ID', () => {
    expect(findEventById('nonexistent-id')).toBeUndefined()
  })
})
