/**
 * Per-camera event batcher.
 *
 * Collects Frigate events into per-camera buffers and flushes each buffer
 * after a configurable window (default 10 s). This reduces notification
 * spam when Frigate emits many events for the same camera in a short burst.
 */

export interface FrigateEventInfo {
  id: string
  camera: string
  label: string
  startTime: number
}

type FlushCallback = (camera: string, events: FrigateEventInfo[]) => void

export class EventBatcher {
  private buffers = new Map<string, FrigateEventInfo[]>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly windowMs: number
  private readonly onFlush: FlushCallback

  constructor(onFlush: FlushCallback, windowMs = 10_000) {
    this.onFlush = onFlush
    this.windowMs = windowMs
  }

  add(event: FrigateEventInfo): void {
    const { camera } = event

    let buffer = this.buffers.get(camera)
    if (!buffer) {
      buffer = []
      this.buffers.set(camera, buffer)
    }
    buffer.push(event)

    // Start a timer for this camera if one isn't already running
    if (!this.timers.has(camera)) {
      const timer = setTimeout(() => this.flush(camera), this.windowMs)
      this.timers.set(camera, timer)
    }
  }

  private flush(camera: string): void {
    const events = this.buffers.get(camera)
    this.buffers.delete(camera)
    this.timers.delete(camera)

    if (events && events.length > 0) {
      this.onFlush(camera, events)
    }
  }

  /** Cancel all pending timers (useful for shutdown / tests). */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.buffers.clear()
  }
}
