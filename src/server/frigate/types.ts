// ─── Shared utility types ───

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

// ─── Event types ───

/** Bounding box as [x, y, width, height] in normalized coordinates (0–1). */
type BoundingBox = [number, number, number, number]

export interface FrigateEventData {
  attributes: string[]
  box: BoundingBox
  region: BoundingBox
  score: number
  top_score: number
  type: string
}

export interface FrigateEvent {
  id: string
  label: string
  sub_label: string | null
  camera: string
  start_time: number
  end_time: number
  false_positive: boolean | null
  zones: string[]
  thumbnail: string
  has_clip: boolean
  has_snapshot: boolean
  retain_indefinitely: boolean
  plus_id: string | null
  box: BoundingBox | null
  top_score: number | null
  data: FrigateEventData
}

export interface FrigateEventSummaryItem {
  camera: string
  count: number
  day: string
  label: string
  sub_label: string | null
  zones: string[]
}

export type FrigateEventSummary = FrigateEventSummaryItem[]

// ─── Review types ───

type ReviewSeverity = 'alert' | 'detection'

export interface FrigateReview {
  id: string
  camera: string
  start_time: string
  end_time: string
  has_been_reviewed: boolean
  severity: ReviewSeverity
  thumb_path: string
  data: Record<string, JsonValue>
}

interface FrigateReviewSummaryDay {
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

export interface FrigateTimelineData {
  attribute: string
  box: BoundingBox
  label: string
  region: BoundingBox
}

export interface FrigateTimelineEntry {
  camera: string
  class_type: string
  data: FrigateTimelineData
  source: string
  source_id: string
  timestamp: number
}

// ─── System types ───

export interface FrigateCameraStats {
  audio_dBFS: number
  audio_rms: number
  camera_fps: number
  capture_pid: number
  detection_enabled: number
  detection_fps: number
  ffmpeg_pid: number
  pid: number
  process_fps: number
  skipped_fps: number
}

export interface FrigateCpuUsage {
  cmdline: string
  cpu: string
  cpu_average: string
  mem: string
}

export interface FrigateDetectorStats {
  detection_start: number
  inference_speed: number
  pid: number
}

export interface FrigateGpuUsage {
  gpu: number
  mem: number
}

export interface FrigateProcessInfo {
  pid: number
}

export interface FrigateStorageInfo {
  free: number
  mount_type: string
  total: number
  used: number
}

export interface FrigateServiceInfo {
  last_updated: number
  latest_version: string
  storage: Record<string, FrigateStorageInfo>
  temperatures: Record<string, number>
  uptime: number
  version: string
}

export interface FrigateStats {
  cameras: Record<string, FrigateCameraStats>
  cpu_usages: Record<string, FrigateCpuUsage>
  detection_fps: number
  detectors: Record<string, FrigateDetectorStats>
  gpu_usages: Record<string, FrigateGpuUsage>
  processes: Record<string, FrigateProcessInfo>
  service: FrigateServiceInfo
}

// ─── Config types ───

export interface FrigateCameraConfig {
  name: string
  enabled: boolean
  detect: {
    enabled: boolean
    fps: number
    height: number
    width: number
    [key: string]: JsonValue
  }
  record: {
    enabled: boolean
    enabled_in_config: boolean
    [key: string]: JsonValue
  }
  snapshots: {
    enabled: boolean
    [key: string]: JsonValue
  }
  audio: {
    enabled: boolean
    [key: string]: JsonValue
  }
  birdseye: {
    enabled: boolean
    [key: string]: JsonValue
  }
  live: {
    height: number
    quality: number
    stream_name: string
  }
  motion: Record<string, JsonValue> | null
  mqtt: Record<string, JsonValue>
  objects: Record<string, JsonValue>
  onvif: Record<string, JsonValue>
  ui: {
    dashboard: boolean
    order: number
  }
  zones: Record<string, JsonValue>
  ffmpeg: Record<string, JsonValue>
  ffmpeg_cmds: Array<{ cmd: string; roles: string[] }>
  rtmp: { enabled: boolean }
  timestamp_style: Record<string, JsonValue>
  best_image_timeout: number
  webui_url: string | null
}

export interface FrigateConfig {
  cameras?: Record<string, FrigateCameraConfig>
  audio: Record<string, JsonValue>
  birdseye: {
    enabled: boolean
    height: number
    width: number
    mode: string
    quality: number
    restream: boolean
    [key: string]: JsonValue
  }
  database: { path: string }
  detect: Record<string, JsonValue>
  detectors: Record<string, {
    type: string
    device: string
    model: Record<string, JsonValue>
  }>
  ffmpeg: Record<string, JsonValue>
  go2rtc: Record<string, JsonValue>
  live: { height: number; quality: number; stream_name: string }
  logger: { default: string; logs: Record<string, string> }
  model: {
    height: number
    width: number
    input_pixel_format: string
    input_tensor: string
    labelmap: Record<string, string>
    labelmap_path: string | null
    model_type: string
    path: string | null
  }
  motion: Record<string, JsonValue> | null
  mqtt: {
    enabled: boolean
    host: string
    port: number
    topic_prefix: string
    client_id: string
    user: string | null
    [key: string]: JsonValue
  }
  objects: Record<string, JsonValue>
  plus: { enabled: boolean }
  record: Record<string, JsonValue>
  rtmp: { enabled: boolean }
  snapshots: Record<string, JsonValue>
  telemetry: {
    network_interfaces: string[]
    stats: Record<string, JsonValue>
    version_check: boolean
  }
  timestamp_style: Record<string, JsonValue>
  ui: {
    date_style: string
    live_mode: string
    strftime_fmt: string | null
    time_format: string
    time_style: string
    timezone: string | null
    use_experimental: boolean
  }
  environment_vars: Record<string, string>
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
