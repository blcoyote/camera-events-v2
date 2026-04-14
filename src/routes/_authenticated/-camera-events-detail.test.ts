import { describe, expect, it } from 'vitest'
import { getEventDetailContent } from '#/pages/camera-events/CameraEventDetailPage'
import type { CameraEvent } from '../../data/camera-events'

describe('getEventDetailContent', () => {
  it('returns formatted detail content for a valid event', () => {
    const event: CameraEvent = {
      id: 'evt-001',
      title: 'Motion detected — front porch',
      timestamp: '2026-04-14T08:23:00Z',
      camera: 'Front Porch',
    }
    const content = getEventDetailContent(event)
    expect(content.found).toBe(true)
    expect(content.heading).toBe('Motion detected — front porch')
    expect(content.backPath).toBe('/camera-events')
    if (content.found) {
      expect(content.camera).toBe('Front Porch')
      expect(content.timestamp).toBe('2026-04-14T08:23:00Z')
    }
  })

  it('returns not-found content when event is undefined', () => {
    const content = getEventDetailContent(undefined)
    expect(content.found).toBe(false)
    expect(content.heading).toBe('Event not found')
    expect(content.backPath).toBe('/camera-events')
  })
})
