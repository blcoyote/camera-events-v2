import type { FrigateStats } from '#/features/shared/server/frigate/types'

interface CameraHealth {
  name: string
  cameraFps: number
  detectionFps: number
  detectionEnabled: boolean
}

interface DetectorHealth {
  name: string
  inferenceSpeed: number
}

interface StorageHealth {
  name: string
  usedPct: number
  usedMb: number
  totalMb: number
  freeMb: number
}

export interface SystemHealth {
  cameras: CameraHealth[]
  detectionFps: number
  detectors: DetectorHealth[]
  storage: StorageHealth[]
  uptime: number
  version: string
  latestVersion: string
  updateAvailable: boolean
  activeCameraCount: number
}

/**
 * Derive a flat, render-ready health summary from a Frigate `/api/stats`
 * payload. Defensive against missing service/storage so a partial stats
 * object never throws.
 */
export function summarizeSystemHealth(stats: FrigateStats): SystemHealth {
  const cameras: CameraHealth[] = Object.entries(stats.cameras)
    .map(([name, c]) => ({
      name,
      cameraFps: c.camera_fps,
      detectionFps: c.detection_fps,
      detectionEnabled: c.detection_enabled === 1,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const detectors: DetectorHealth[] = Object.entries(stats.detectors)
    .map(([name, d]) => ({ name, inferenceSpeed: d.inference_speed }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const service = stats.service
  const storage: StorageHealth[] = Object.entries(service.storage)
    .map(([name, s]) => ({
      name,
      usedMb: s.used,
      totalMb: s.total,
      freeMb: s.free,
      usedPct: s.total > 0 ? (s.used / s.total) * 100 : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const version = service.version
  const latestVersion = service.latest_version
  const updateAvailable =
    latestVersion !== '' &&
    latestVersion !== 'unknown' &&
    latestVersion !== version

  return {
    cameras,
    detectionFps: stats.detection_fps,
    detectors,
    storage,
    uptime: service.uptime,
    version,
    latestVersion,
    updateAvailable,
    activeCameraCount: cameras.length,
  }
}
