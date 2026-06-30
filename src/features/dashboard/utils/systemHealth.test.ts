import { describe, it, expect } from 'vitest'
import { summarizeSystemHealth } from './systemHealth'
import type { FrigateStats } from '#/features/shared/server/frigate/types'

function makeStats(overrides: Partial<FrigateStats> = {}): FrigateStats {
  return {
    cameras: {
      back_yard: {
        audio_dBFS: -30,
        audio_rms: -40,
        camera_fps: 5,
        capture_pid: 1,
        detection_enabled: 1,
        detection_fps: 4.5,
        ffmpeg_pid: 2,
        pid: 3,
        process_fps: 5,
        skipped_fps: 0,
      },
      front_porch: {
        audio_dBFS: -30,
        audio_rms: -40,
        camera_fps: 6,
        capture_pid: 1,
        detection_enabled: 0,
        detection_fps: 0,
        ffmpeg_pid: 2,
        pid: 3,
        process_fps: 6,
        skipped_fps: 0,
      },
    },
    cpu_usages: {},
    detection_fps: 9.5,
    detectors: {
      coral: { detection_start: 0, inference_speed: 8.3, pid: 10 },
    },
    gpu_usages: {},
    processes: {},
    service: {
      last_updated: 0,
      latest_version: '0.14.0',
      storage: {
        '/media': { free: 50, mount_type: 'ext4', total: 200, used: 150 },
      },
      temperatures: {},
      uptime: 90000,
      version: '0.14.0',
    },
    ...overrides,
  }
}

describe('summarizeSystemHealth', () => {
  it('maps cameras sorted by name with fps and enabled flag', () => {
    const health = summarizeSystemHealth(makeStats())
    expect(health.cameras.map((c) => c.name)).toEqual([
      'back_yard',
      'front_porch',
    ])
    expect(health.cameras[0]).toEqual({
      name: 'back_yard',
      cameraFps: 5,
      detectionFps: 4.5,
      detectionEnabled: true,
    })
    expect(health.cameras[1].detectionEnabled).toBe(false)
  })

  it('reports active camera count and overall detection fps', () => {
    const health = summarizeSystemHealth(makeStats())
    expect(health.activeCameraCount).toBe(2)
    expect(health.detectionFps).toBe(9.5)
  })

  it('maps detectors with inference speed', () => {
    const health = summarizeSystemHealth(makeStats())
    expect(health.detectors).toEqual([{ name: 'coral', inferenceSpeed: 8.3 }])
  })

  it('computes storage used percentage', () => {
    const health = summarizeSystemHealth(makeStats())
    expect(health.storage[0].usedPct).toBe(75)
    expect(health.storage[0].name).toBe('/media')
  })

  it('returns 0% used when total storage is 0', () => {
    const stats = makeStats()
    stats.service.storage = {
      '/': { free: 0, mount_type: 'ext4', total: 0, used: 0 },
    }
    expect(summarizeSystemHealth(stats).storage[0].usedPct).toBe(0)
  })

  it('flags updateAvailable when latest_version differs from version', () => {
    const stats = makeStats()
    stats.service.latest_version = '0.15.0'
    stats.service.version = '0.14.0'
    expect(summarizeSystemHealth(stats).updateAvailable).toBe(true)
  })

  it('does not flag updateAvailable when versions match', () => {
    expect(summarizeSystemHealth(makeStats()).updateAvailable).toBe(false)
  })

  it('does not flag updateAvailable when latest_version is "unknown"', () => {
    const stats = makeStats()
    stats.service.latest_version = 'unknown'
    expect(summarizeSystemHealth(stats).updateAvailable).toBe(false)
  })

  it('handles a stats object with no cameras', () => {
    const stats = makeStats({ cameras: {} })
    const health = summarizeSystemHealth(stats)
    expect(health.cameras).toEqual([])
    expect(health.activeCameraCount).toBe(0)
  })
})
