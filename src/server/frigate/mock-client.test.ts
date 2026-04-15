import { describe, expect, it } from 'vitest'
import {
  getEvents,
  getEvent,
  getEventThumbnail,
  getEventSnapshot,
  getEventClip,
  getEventSummary,
  getReviews,
  getReviewByEvent,
  getReviewSummary,
  getTimeline,
  getStats,
  getConfig,
  getCameras,
  getLatestSnapshot,
} from './mock-client'

const EXPECTED_CAMERAS = [
  'backyard',
  'driveway',
  'front_door',
  'front_porch',
  'garage',
  'side_gate',
]

const VALID_LABELS = ['person', 'car', 'dog', 'cat', 'truck', 'package']

describe('mock-client', () => {
  describe('getEvents', () => {
    it('returns ok with 10–20 events by default', async () => {
      const result = await getEvents()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.length).toBeGreaterThanOrEqual(10)
      expect(result.data.length).toBeLessThanOrEqual(20)
    })

    it('respects the limit parameter', async () => {
      const result = await getEvents({ limit: 5 })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(5)
    })

    it('generates events with varied labels and cameras', async () => {
      const result = await getEvents({ limit: 20 })
      if (!result.ok) return
      const labels = new Set(result.data.map((e) => e.label))
      const cameras = new Set(result.data.map((e) => e.camera))
      expect(labels.size).toBeGreaterThan(1)
      expect(cameras.size).toBeGreaterThan(1)
      for (const event of result.data) {
        expect(VALID_LABELS).toContain(event.label)
      }
    })

    it('generates events with realistic fields', async () => {
      const result = await getEvents({ limit: 5 })
      if (!result.ok) return
      for (const event of result.data) {
        expect(event.id).toBeTruthy()
        expect(event.start_time).toBeLessThan(Date.now() / 1000)
        expect(event.end_time).toBeGreaterThan(event.start_time)
        expect(event.zones.length).toBeGreaterThanOrEqual(1)
        expect(event.data.score).toBeGreaterThanOrEqual(0.5)
        expect(event.data.score).toBeLessThanOrEqual(0.99)
        expect(event.data.box).toHaveLength(4)
      }
    })
  })

  describe('getEvent', () => {
    it('returns ok with the provided event ID', async () => {
      const result = await getEvent('test-event-123')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBe('test-event-123')
    })
  })

  describe('getEventThumbnail', () => {
    it('returns an ArrayBuffer', async () => {
      const result = await getEventThumbnail('evt-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toBeInstanceOf(ArrayBuffer)
      expect(result.data.byteLength).toBeGreaterThan(0)
    })
  })

  describe('getEventSnapshot', () => {
    it('returns an ArrayBuffer', async () => {
      const result = await getEventSnapshot('evt-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toBeInstanceOf(ArrayBuffer)
      expect(result.data.byteLength).toBeGreaterThan(0)
    })
  })

  describe('getEventClip', () => {
    it('returns an ArrayBuffer with MP4 signature', async () => {
      const result = await getEventClip('evt-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toBeInstanceOf(ArrayBuffer)
      const bytes = new Uint8Array(result.data)
      // ftyp box signature at offset 4
      expect(bytes[4]).toBe(0x66) // 'f'
      expect(bytes[5]).toBe(0x74) // 't'
      expect(bytes[6]).toBe(0x79) // 'y'
      expect(bytes[7]).toBe(0x70) // 'p'
    })
  })

  describe('getEventSummary', () => {
    it('returns ok with summary items', async () => {
      const result = await getEventSummary()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.length).toBeGreaterThan(0)
      for (const item of result.data) {
        expect(item.camera).toBeTruthy()
        expect(item.label).toBeTruthy()
        expect(item.count).toBeGreaterThanOrEqual(1)
        expect(item.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  describe('getReviews', () => {
    it('returns ok with 5–10 reviews by default', async () => {
      const result = await getReviews()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.length).toBeGreaterThanOrEqual(5)
      expect(result.data.length).toBeLessThanOrEqual(10)
    })

    it('respects the limit parameter', async () => {
      const result = await getReviews({ limit: 3 })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(3)
    })

    it('generates reviews with valid severity', async () => {
      const result = await getReviews({ limit: 10 })
      if (!result.ok) return
      for (const review of result.data) {
        expect(['alert', 'detection']).toContain(review.severity)
      }
    })
  })

  describe('getReviewByEvent', () => {
    it('returns ok with the provided event ID', async () => {
      const result = await getReviewByEvent('test-review-456')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBe('test-review-456')
    })
  })

  describe('getReviewSummary', () => {
    it('returns ok with last24Hours and day entries', async () => {
      const result = await getReviewSummary()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.last24Hours).toBeDefined()
      expect(result.data.last24Hours.total_alert).toBeGreaterThanOrEqual(0)
      expect(result.data.last24Hours.total_detection).toBeGreaterThanOrEqual(0)
      // Should have at least the last24Hours key plus day entries
      expect(Object.keys(result.data).length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getTimeline', () => {
    it('returns ok with 5–15 entries by default', async () => {
      const result = await getTimeline()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.length).toBeGreaterThanOrEqual(5)
      expect(result.data.length).toBeLessThanOrEqual(15)
    })

    it('respects the limit parameter', async () => {
      const result = await getTimeline({ limit: 4 })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(4)
    })

    it('generates timeline entries with valid fields', async () => {
      const result = await getTimeline({ limit: 5 })
      if (!result.ok) return
      for (const entry of result.data) {
        expect(entry.camera).toBeTruthy()
        expect(entry.timestamp).toBeLessThan(Date.now() / 1000)
        expect(entry.data.box).toHaveLength(4)
      }
    })
  })

  describe('getStats', () => {
    it('returns ok with stats for all mock cameras', async () => {
      const result = await getStats()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const cameraNames = Object.keys(result.data.cameras).sort()
      expect(cameraNames).toEqual(EXPECTED_CAMERAS)
      expect(result.data.detection_fps).toBeGreaterThan(0)
      expect(result.data.service.version).toBeTruthy()
    })
  })

  describe('getConfig', () => {
    it('returns ok with config containing all mock cameras', async () => {
      const result = await getConfig()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const cameraNames = Object.keys(result.data.cameras ?? {}).sort()
      expect(cameraNames).toEqual(EXPECTED_CAMERAS)
    })

    it('returns config with expected top-level keys', async () => {
      const result = await getConfig()
      if (!result.ok) return
      expect(result.data.mqtt).toBeDefined()
      expect(result.data.database).toBeDefined()
      expect(result.data.ui).toBeDefined()
      expect(result.data.detect).toBeDefined()
    })
  })

  describe('getCameras', () => {
    it('returns sorted camera names', async () => {
      const result = await getCameras()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual(EXPECTED_CAMERAS)
    })
  })

  describe('getLatestSnapshot', () => {
    it('returns an ArrayBuffer', async () => {
      const result = await getLatestSnapshot('front_porch')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toBeInstanceOf(ArrayBuffer)
      expect(result.data.byteLength).toBeGreaterThan(0)
    })
  })
})
