import '@tanstack/react-start/server-only'

export type CameraAvailabilityStatus = 'online' | 'offline'

export type AvailabilityTransitionCallback = (
  camera: string,
  status: CameraAvailabilityStatus,
) => void

/** Consecutive zero-fps readings required before a camera is flagged offline. */
const DEFAULT_OFFLINE_THRESHOLD = 2

/**
 * Parse a `frigate/stats` MQTT payload into a map of camera name to
 * `camera_fps`. Returns null for invalid JSON or a payload whose top-level
 * `cameras` field isn't an object. Entries under `cameras` whose
 * `camera_fps` isn't a finite number are silently skipped.
 */
export function parseFrigateStatsMessage(
  payload: Buffer,
): Record<string, number> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload.toString())
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const cameras = (parsed as { cameras?: unknown }).cameras
  if (
    typeof cameras !== 'object' ||
    cameras === null ||
    Array.isArray(cameras)
  ) {
    return null
  }

  const result: Record<string, number> = {}
  for (const [camera, stats] of Object.entries(
    cameras as Record<string, unknown>,
  )) {
    if (typeof stats !== 'object' || stats === null) continue
    const fps = (stats as { camera_fps?: unknown }).camera_fps
    if (typeof fps === 'number' && Number.isFinite(fps)) {
      result[camera] = fps
    }
  }

  return result
}

/**
 * Tracks per-camera availability derived from `frigate/stats` fps readings
 * and the whole-instance `frigate/available` MQTT Last Will and Testament.
 *
 * fps readings are debounced (a camera must report zero fps for
 * `offlineThreshold` consecutive readings before it's flagged offline) since
 * a single 0.0 reading is noisy. The `frigate/available` "offline" signal is
 * NOT debounced — it means Frigate itself has gone down, which is a
 * reliable, instantaneous signal that every known camera is now unreachable.
 */
export class CameraAvailabilityTracker {
  private readonly onTransition: AvailabilityTransitionCallback
  private readonly offlineThreshold: number
  private readonly knownCameras = new Set<string>()
  private readonly zeroStreaks = new Map<string, number>()
  private readonly offlineFlags = new Set<string>()

  constructor(
    onTransition: AvailabilityTransitionCallback,
    offlineThreshold = DEFAULT_OFFLINE_THRESHOLD,
  ) {
    this.onTransition = onTransition
    this.offlineThreshold = offlineThreshold
  }

  handleStats(camerasFps: Record<string, number>): void {
    for (const [camera, fps] of Object.entries(camerasFps)) {
      this.knownCameras.add(camera)

      if (fps > 0) {
        this.zeroStreaks.set(camera, 0)
        if (this.offlineFlags.has(camera)) {
          this.offlineFlags.delete(camera)
          this.onTransition(camera, 'online')
        }
        continue
      }

      const streak = (this.zeroStreaks.get(camera) ?? 0) + 1
      this.zeroStreaks.set(camera, streak)

      if (streak >= this.offlineThreshold && !this.offlineFlags.has(camera)) {
        this.offlineFlags.add(camera)
        this.onTransition(camera, 'offline')
      }
    }
  }

  handleServiceAvailability(status: CameraAvailabilityStatus): void {
    if (status !== 'offline') return

    for (const camera of this.knownCameras) {
      if (!this.offlineFlags.has(camera)) {
        this.offlineFlags.add(camera)
        this.onTransition(camera, 'offline')
      }
    }
  }
}
