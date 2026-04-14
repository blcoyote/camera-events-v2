import { describe, expect, it } from 'vitest'
import { formatEventSummary } from './camera-events.index'
import type { CameraEvent } from '../../data/camera-events'

describe('formatEventSummary', () => {
  it('formats an event into a readable summary', () => {
    const event: CameraEvent = {
      id: 'evt-001',
      title: 'Motion detected — front porch',
      timestamp: '2026-04-14T08:23:00Z',
      camera: 'Front Porch',
    }
    const summary = formatEventSummary(event)
    expect(summary).toContain('Front Porch')
    expect(summary).toContain('Motion detected')
  })

  it('includes the camera name and title', () => {
    const event: CameraEvent = {
      id: 'evt-002',
      title: 'Person detected — driveway',
      timestamp: '2026-04-14T07:45:00Z',
      camera: 'Driveway',
    }
    const summary = formatEventSummary(event)
    expect(summary).toBe('Driveway: Person detected — driveway')
  })
})
