/**
 * Frigate review-item parsing and alert de-duplication.
 *
 * Push notifications are driven by `frigate/reviews`. A review can start as a
 * `detection` and be upgraded to `alert` by a later `update`, so the gate
 * notifies exactly once per review id, the first time it is seen as `alert`.
 */

import '@tanstack/react-start/server-only'

export interface FrigateReviewMessage {
  type: 'new' | 'update' | 'end'
  reviewId: string
  camera: string
  severity: 'alert' | 'detection'
  /** Tracked-object event ids in the review, in Frigate's order. */
  detections: string[]
}

const REVIEW_TYPES = new Set(['new', 'update', 'end'])
const REVIEW_SEVERITIES = new Set(['alert', 'detection'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse a frigate/reviews payload; null if malformed. */
export function parseFrigateReview(
  payload: Buffer,
): FrigateReviewMessage | null {
  let json: unknown
  try {
    json = JSON.parse(payload.toString())
  } catch {
    return null
  }
  if (!isRecord(json)) return null

  const { type, after } = json
  if (typeof type !== 'string' || !REVIEW_TYPES.has(type)) return null
  if (!isRecord(after)) return null

  const { id, camera, severity, data } = after
  if (typeof id !== 'string' || typeof camera !== 'string') return null
  if (typeof severity !== 'string' || !REVIEW_SEVERITIES.has(severity)) {
    return null
  }

  const rawDetections = isRecord(data) ? data.detections : undefined
  const detections = Array.isArray(rawDetections)
    ? rawDetections.filter((d): d is string => typeof d === 'string')
    : []

  return {
    type: type as FrigateReviewMessage['type'],
    reviewId: id,
    camera,
    severity: severity as FrigateReviewMessage['severity'],
    detections,
  }
}

export type ReviewAlertDecision = 'notify' | 'skip'

/**
 * Notifies at most once per review id: the first time it is seen with
 * severity `alert` on a `new` or `update` message.
 */
export class ReviewAlertGate {
  /** Insertion-ordered, so the first entry is always the oldest. */
  private readonly tracked = new Set<string>()

  constructor(private readonly maxTracked = 500) {}

  /** Decide whether this message should start a notification. */
  consider(msg: FrigateReviewMessage): ReviewAlertDecision {
    if (msg.type === 'end') {
      this.tracked.delete(msg.reviewId)
      return 'skip'
    }
    if (msg.severity !== 'alert') return 'skip'
    if (this.tracked.has(msg.reviewId)) return 'skip'

    if (this.tracked.size >= this.maxTracked) {
      const oldest = this.tracked.values().next()
      if (!oldest.done) this.tracked.delete(oldest.value)
    }
    this.tracked.add(msg.reviewId)
    return 'notify'
  }

  /** Verification failed: forget the review so a later alert update can retry. */
  release(reviewId: string): void {
    this.tracked.delete(reviewId)
  }
}
