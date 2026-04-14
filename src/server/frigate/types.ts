// ─── Event types ───

export interface FrigateEvent {
  id: string
  label: string
  sub_label: string
  camera: string
  start_time: number
  end_time: number
  false_positive: boolean
  zones: string[]
  thumbnail: string
  has_clip: boolean
  has_snapshot: boolean
  retain_indefinitely: boolean
  plus_id?: string
  model_hash?: string
  detector_type?: string
  model_type?: string
  data: Record<string, unknown>
}

export interface FrigateEventSummary {
  [key: string]: unknown
}

// ─── Review types ───

export type ReviewSeverity = 'alert' | 'detection'

export interface FrigateReview {
  id: string
  camera: string
  start_time: string
  end_time: string
  has_been_reviewed: boolean
  severity: ReviewSeverity
  thumb_path: string
  data: Record<string, unknown>
}

export interface FrigateReviewSummaryDay {
  day: string
  reviewed_alert: number
  reviewed_detection: number
  total_alert: number
  total_detection: number
}

export interface FrigateReviewSummary {
  last24Hours: {
    reviewed_alert: number
    reviewed_detection: number
    total_alert: number
    total_detection: number
  }
  [day: string]: FrigateReviewSummaryDay | FrigateReviewSummary['last24Hours']
}

// ─── Timeline types ───

export interface FrigateTimelineEntry {
  [key: string]: unknown
}

// ─── System types ───

export interface FrigateStats {
  [key: string]: unknown
}

export interface FrigateConfig {
  [key: string]: unknown
}

// ─── Query param types (read endpoints) ───

export interface GetEventsParams {
  cameras?: string
  labels?: string
  zones?: string
  after?: string | number
  before?: string | number
  limit?: number
  has_clip?: boolean
  has_snapshot?: boolean
  include_thumbnails?: boolean
  favorites?: boolean
}

export interface GetEventSummaryParams {
  timezone?: string
  has_clip?: boolean
  has_snapshot?: boolean
}

export interface GetEventMediaParams {
  download?: boolean
  timestamp?: number
  bbox?: boolean
  crop?: boolean
  height?: number
  quality?: number
}

export interface GetReviewsParams {
  cameras?: string
  labels?: string
  zones?: string
  reviewed?: 0 | 1
  limit?: number
  severity?: ReviewSeverity
  before?: string
  after?: string
}

export interface GetReviewSummaryParams {
  cameras?: string
  labels?: string
  zones?: string
  timezone?: string
}

export interface GetTimelineParams {
  camera?: string
  limit?: number
  source_id?: string
}

// ─── Write body types (for future implementation) ───

/** POST /api/events/:id/sub_label */
export interface SubLabelBody {
  subLabel: string
  subLabelScore: number
  camera: string
}

/** POST /api/events/:id/description */
export interface DescriptionBody {
  description: string
}
