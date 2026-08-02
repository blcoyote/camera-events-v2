/**
 * Per-camera event batcher.
 *
 * Uses a leading-edge flush followed by trailing batches: the first event for
 * an idle camera is flushed straight away, so the user is alerted the moment
 * motion is noticed. Further events arriving inside the window are buffered
 * and flushed together when it expires, and the window keeps chaining for as
 * long as events keep arriving. This gives an immediate first notification
 * plus at most one follow-up per window while motion continues.
 */

import '@tanstack/react-start/server-only'

export interface FrigateEventInfo {
  id: string
  camera: string
  label: string
  startTime: number
}

/** Default gap of quiet after which a camera's next event starts a new burst. */
const DEFAULT_BURST_GAP_MS = 600_000

export interface FlushMeta {
  /**
   * True when this flush opens a new activity burst — no event has been seen
   * on the camera for at least `burstGapMs`. Burst starts alert the user;
   * continuations silently patch the notification already on screen.
   */
  burstStart: boolean
}

type FlushCallback = (
  camera: string,
  events: FrigateEventInfo[],
  meta: FlushMeta,
) => void

export class EventBatcher {
  private buffers = new Map<string, FrigateEventInfo[]>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private lastEventAt = new Map<string, number>()
  private readonly windowMs: number
  private readonly burstGapMs: number
  private readonly onFlush: FlushCallback

  constructor(
    onFlush: FlushCallback,
    windowMs = 30_000,
    burstGapMs = DEFAULT_BURST_GAP_MS,
  ) {
    this.onFlush = onFlush
    this.windowMs = windowMs
    this.burstGapMs = burstGapMs
  }

  add(event: FrigateEventInfo): void {
    const { camera } = event

    const now = Date.now()
    const previous = this.lastEventAt.get(camera)
    const burstStart =
      previous === undefined || now - previous >= this.burstGapMs
    this.lastEventAt.set(camera, now)

    // Idle camera: flush on the leading edge so the first sighting alerts now.
    if (!this.timers.has(camera)) {
      this.openWindow(camera)
      this.onFlush(camera, [event], { burstStart })
      return
    }

    let buffer = this.buffers.get(camera)
    if (!buffer) {
      buffer = []
      this.buffers.set(camera, buffer)
    }
    buffer.push(event)
  }

  private openWindow(camera: string): void {
    const timer = setTimeout(() => this.closeWindow(camera), this.windowMs)
    this.timers.set(camera, timer)
  }

  private closeWindow(camera: string): void {
    const events = this.buffers.get(camera)
    this.buffers.delete(camera)
    this.timers.delete(camera)

    // Nothing buffered means motion stopped — let the camera go idle so its
    // next event flushes on the leading edge again.
    if (!events || events.length === 0) return

    this.openWindow(camera)
    this.onFlush(camera, events, { burstStart: false })
  }

  /** Cancel all pending timers (useful for shutdown / tests). */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.buffers.clear()
    this.lastEventAt.clear()
  }
}
