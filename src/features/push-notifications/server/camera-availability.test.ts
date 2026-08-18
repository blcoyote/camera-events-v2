import { describe, it, expect, vi } from 'vitest'
import {
  parseFrigateStatsMessage,
  CameraAvailabilityTracker,
} from './camera-availability'

describe('parseFrigateStatsMessage', () => {
  it('parses a valid payload with multiple cameras into a camera -> fps map', () => {
    const payload = Buffer.from(
      JSON.stringify({
        cameras: {
          front_porch: { camera_fps: 5.2 },
          driveway: { camera_fps: 0 },
        },
      }),
    )

    expect(parseFrigateStatsMessage(payload)).toEqual({
      front_porch: 5.2,
      driveway: 0,
    })
  })

  it('returns null when the cameras field is missing', () => {
    const payload = Buffer.from(JSON.stringify({ detection_fps: 10 }))

    expect(parseFrigateStatsMessage(payload)).toBeNull()
  })

  it('returns null when cameras is not an object', () => {
    const payload = Buffer.from(JSON.stringify({ cameras: 'nope' }))

    expect(parseFrigateStatsMessage(payload)).toBeNull()
  })

  it('returns null when cameras is an array', () => {
    const payload = Buffer.from(JSON.stringify({ cameras: ['front_porch'] }))

    expect(parseFrigateStatsMessage(payload)).toBeNull()
  })

  it('returns null when cameras is null', () => {
    const payload = Buffer.from(JSON.stringify({ cameras: null }))

    expect(parseFrigateStatsMessage(payload)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const payload = Buffer.from('not json{')

    expect(parseFrigateStatsMessage(payload)).toBeNull()
  })

  it('returns an empty map for an empty cameras object', () => {
    const payload = Buffer.from(JSON.stringify({ cameras: {} }))

    expect(parseFrigateStatsMessage(payload)).toEqual({})
  })

  it('excludes a camera whose camera_fps is non-numeric but keeps the rest', () => {
    const payload = Buffer.from(
      JSON.stringify({
        cameras: {
          front_porch: { camera_fps: 'n/a' },
          driveway: { camera_fps: 3.1 },
        },
      }),
    )

    expect(parseFrigateStatsMessage(payload)).toEqual({ driveway: 3.1 })
  })

  it('excludes a camera whose camera_fps is missing entirely', () => {
    const payload = Buffer.from(
      JSON.stringify({
        cameras: {
          front_porch: { capture_pid: 123 },
        },
      }),
    )

    expect(parseFrigateStatsMessage(payload)).toEqual({})
  })

  it('excludes a camera whose camera_fps overflows to a non-finite number', () => {
    const payload = Buffer.from(
      JSON.stringify({
        cameras: {
          front_porch: { camera_fps: Number.POSITIVE_INFINITY },
          driveway: { camera_fps: 2.5 },
        },
      }),
    )

    expect(parseFrigateStatsMessage(payload)).toEqual({ driveway: 2.5 })
  })

  it('excludes a camera whose camera_fps is null', () => {
    const payload = Buffer.from(
      JSON.stringify({
        cameras: {
          front_porch: { camera_fps: null },
        },
      }),
    )

    expect(parseFrigateStatsMessage(payload)).toEqual({})
  })
})

describe('CameraAvailabilityTracker', () => {
  describe('handleStats', () => {
    it('never fires a transition for a camera reporting fps > 0 from the start', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 5 })
      tracker.handleStats({ front_porch: 5.5 })

      expect(onTransition).not.toHaveBeenCalled()
    })

    it('fires offline exactly once after reaching the default threshold of 2 consecutive zero readings', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 0 })
      expect(onTransition).not.toHaveBeenCalled()

      tracker.handleStats({ front_porch: 0 })
      expect(onTransition).toHaveBeenCalledOnce()
      expect(onTransition).toHaveBeenCalledWith('front_porch', 'offline')
    })

    it('fires offline exactly once after reaching a custom threshold of 3 consecutive zero readings', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition, 3)

      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 0 })
      expect(onTransition).not.toHaveBeenCalled()

      tracker.handleStats({ front_porch: 0 })
      expect(onTransition).toHaveBeenCalledOnce()
      expect(onTransition).toHaveBeenCalledWith('front_porch', 'offline')
    })

    it('does not refire offline on further zero readings once already flagged offline', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 0 })

      expect(onTransition).toHaveBeenCalledOnce()
    })

    it('fires online after fps recovers, then can fire offline again on a subsequent zero streak', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 0 })
      expect(onTransition).toHaveBeenCalledTimes(1)
      expect(onTransition).toHaveBeenNthCalledWith(1, 'front_porch', 'offline')

      tracker.handleStats({ front_porch: 4.2 })
      expect(onTransition).toHaveBeenCalledTimes(2)
      expect(onTransition).toHaveBeenNthCalledWith(2, 'front_porch', 'online')

      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 0 })
      expect(onTransition).toHaveBeenCalledTimes(3)
      expect(onTransition).toHaveBeenNthCalledWith(3, 'front_porch', 'offline')
    })

    it('resets the zero streak on any nonzero reading, so flapping below threshold never fires offline', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 3 })
      tracker.handleStats({ front_porch: 0 })
      tracker.handleStats({ front_porch: 3 })

      expect(onTransition).not.toHaveBeenCalled()
    })

    it('tracks multiple cameras completely independently', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 0, driveway: 5 })
      tracker.handleStats({ front_porch: 0, driveway: 5 })

      expect(onTransition).toHaveBeenCalledOnce()
      expect(onTransition).toHaveBeenCalledWith('front_porch', 'offline')
    })
  })

  describe('handleServiceAvailability', () => {
    it('flags every known camera offline and fires a transition for each, skipping ones already offline', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 5 })
      tracker.handleStats({ driveway: 0 })
      tracker.handleStats({ driveway: 0 })
      onTransition.mockClear()

      tracker.handleServiceAvailability('offline')

      expect(onTransition).toHaveBeenCalledOnce()
      expect(onTransition).toHaveBeenCalledWith('front_porch', 'offline')
    })

    it('fires nothing when no cameras have ever been seen', () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleServiceAvailability('offline')

      expect(onTransition).not.toHaveBeenCalled()
    })

    it("fires nothing for 'online' and does not clear an offline flag set by a prior 'offline' availability event", () => {
      const onTransition = vi.fn()
      const tracker = new CameraAvailabilityTracker(onTransition)

      tracker.handleStats({ front_porch: 5 })
      tracker.handleServiceAvailability('offline')
      expect(onTransition).toHaveBeenCalledWith('front_porch', 'offline')

      onTransition.mockClear()
      tracker.handleServiceAvailability('online')
      expect(onTransition).not.toHaveBeenCalled()

      tracker.handleStats({ front_porch: 6 })
      expect(onTransition).toHaveBeenCalledOnce()
      expect(onTransition).toHaveBeenCalledWith('front_porch', 'online')
    })
  })
})
