import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FrigateResult } from './config'
import type {
  FrigateConfig,
  FrigateEvent,
  FrigateEventSummary,
  FrigateReview,
  FrigateReviewSummary,
  FrigateStats,
  FrigateTimelineEntry,
  GetEventsParams,
  GetEventSummaryParams,
  GetEventMediaParams,
  GetReviewsParams,
  GetReviewSummaryParams,
  GetTimelineParams,
} from './types'

// ─── Placeholder assets ───

const __dirname =
  typeof globalThis.__dirname !== 'undefined'
    ? globalThis.__dirname
    : join(fileURLToPath(import.meta.url), '..')

const PLACEHOLDER_IMAGE: ArrayBuffer = readFileSync(
  join(__dirname, 'assets', 'placeholder.jpeg'),
).buffer.slice(0)

// Minimal valid MP4: ftyp box with isom brand
const PLACEHOLDER_MP4: ArrayBuffer = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, // box size: 24
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x69, 0x73, 0x6f, 0x6d, // major brand: 'isom'
  0x00, 0x00, 0x02, 0x00, // minor version
  0x69, 0x73, 0x6f, 0x6d, // compatible brand: 'isom'
  0x69, 0x73, 0x6f, 0x32, // compatible brand: 'iso2'
]).buffer.slice(0)

// ─── Fixed pools ───

const MOCK_CAMERAS = [
  'front_porch',
  'driveway',
  'backyard',
  'garage',
  'side_gate',
  'front_door',
] as const

const MOCK_LABELS = [
  'person',
  'car',
  'dog',
  'cat',
  'truck',
  'package',
] as const

const MOCK_ZONES = [
  'front_yard',
  'walkway',
  'driveway',
  'porch',
  'yard',
  'fence',
  'side_yard',
  'street',
] as const

// ─── Random helpers ───

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const val = Math.random() * (max - min) + min
  const factor = 10 ** decimals
  return Math.round(val * factor) / factor
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSubset<T>(arr: readonly T[], min = 1, max = 3): T[] {
  const count = randomInt(min, Math.min(max, arr.length))
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function minutesAgo(mins: number): number {
  return Date.now() / 1000 - mins * 60
}

function randomId(): string {
  const ts = Math.floor(Date.now() / 1000) - randomInt(0, 86400)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${ts}.${randomInt(100, 999)}-${suffix}`
}

type BoundingBox = [number, number, number, number]

function randomBoundingBox(): BoundingBox {
  const x = randomFloat(0.1, 0.7)
  const y = randomFloat(0.1, 0.7)
  const w = randomFloat(0.05, 0.3)
  const h = randomFloat(0.05, 0.4)
  return [x, y, w, h]
}

// ─── Data generators ───

function generateEvent(eventId?: string): FrigateEvent {
  const id = eventId ?? randomId()
  const camera = randomChoice(MOCK_CAMERAS)
  const label = randomChoice(MOCK_LABELS)
  const startOffset = randomInt(1, 1440) // up to 24 hours ago
  const durationMins = randomInt(1, 10)
  const score = randomFloat(0.5, 0.99)
  const box = randomBoundingBox()

  return {
    id,
    label,
    sub_label: Math.random() > 0.8 ? 'delivery' : null,
    camera,
    start_time: minutesAgo(startOffset),
    end_time: minutesAgo(startOffset - durationMins),
    false_positive: null,
    zones: randomSubset(MOCK_ZONES),
    thumbnail: '',
    has_clip: Math.random() > 0.2,
    has_snapshot: true,
    retain_indefinitely: Math.random() > 0.9,
    plus_id: null,
    box,
    top_score: score,
    data: {
      attributes: [],
      box,
      region: [0, 0, 1, 1],
      score,
      top_score: score,
      type: 'object',
    },
  }
}

function generateReview(eventId?: string): FrigateReview {
  const startOffset = randomInt(1, 1440)
  const durationMins = randomInt(1, 10)
  return {
    id: eventId ?? randomId(),
    camera: randomChoice(MOCK_CAMERAS),
    start_time: String(minutesAgo(startOffset)),
    end_time: String(minutesAgo(startOffset - durationMins)),
    has_been_reviewed: Math.random() > 0.5,
    severity: Math.random() > 0.5 ? 'alert' : 'detection',
    thumb_path: `/clips/${randomId()}-thumb.jpg`,
    data: { objects: [randomChoice(MOCK_LABELS)] },
  }
}

function generateTimelineEntry(): FrigateTimelineEntry {
  const label = randomChoice(MOCK_LABELS)
  const box = randomBoundingBox()
  return {
    camera: randomChoice(MOCK_CAMERAS),
    class_type: 'visible',
    data: {
      attribute: '',
      box,
      label,
      region: [0, 0, 1, 1],
    },
    source: 'tracked_object',
    source_id: randomId(),
    timestamp: minutesAgo(randomInt(1, 1440)),
  }
}

function generateCameraConfig(name: string) {
  return {
    name,
    enabled: true,
    detect: { enabled: true, fps: 5, height: 720, width: 1280 },
    record: { enabled: true, enabled_in_config: true },
    snapshots: { enabled: true },
    audio: { enabled: false },
    birdseye: { enabled: true },
    live: { height: 720, quality: 8, stream_name: name },
    motion: null,
    mqtt: { enabled: true },
    objects: { track: ['person', 'car', 'dog', 'cat'] },
    onvif: {},
    ui: { dashboard: true, order: 0 },
    zones: {},
    ffmpeg: { inputs: [] },
    ffmpeg_cmds: [{ cmd: '', roles: ['detect'] }],
    rtmp: { enabled: false },
    timestamp_style: { position: 'tl' },
    best_image_timeout: 60,
    webui_url: null,
  }
}

// ─── Mock client functions ───

export async function getEvents(
  params?: GetEventsParams,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateEvent[]>> {
  const count = params?.limit ?? randomInt(10, 20)
  const events = Array.from({ length: count }, () => generateEvent())
  return { ok: true, data: events }
}

export async function getEvent(
  eventId: string,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateEvent>> {
  return { ok: true, data: generateEvent(eventId) }
}

export async function getEventThumbnail(
  _eventId: string,
  _params?: GetEventMediaParams,
  _timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return { ok: true, data: PLACEHOLDER_IMAGE }
}

export async function getEventSnapshot(
  _eventId: string,
  _params?: GetEventMediaParams,
  _timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return { ok: true, data: PLACEHOLDER_IMAGE }
}

export async function getEventClip(
  _eventId: string,
  _timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return { ok: true, data: PLACEHOLDER_MP4 }
}

export async function getEventSummary(
  _params?: GetEventSummaryParams,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateEventSummary>> {
  const items = MOCK_CAMERAS.flatMap((camera) =>
    MOCK_LABELS.slice(0, 3).map((label) => ({
      camera,
      count: randomInt(1, 50),
      day: new Date(Date.now() - randomInt(0, 3) * 86400000)
        .toISOString()
        .split('T')[0],
      label,
      sub_label: null,
      zones: randomSubset(MOCK_ZONES, 1, 2),
    })),
  )
  return { ok: true, data: items }
}

export async function getReviews(
  params?: GetReviewsParams,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateReview[]>> {
  const count = params?.limit ?? randomInt(5, 10)
  const reviews = Array.from({ length: count }, () => generateReview())
  return { ok: true, data: reviews }
}

export async function getReviewByEvent(
  eventId: string,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateReview>> {
  return { ok: true, data: generateReview(eventId) }
}

export async function getReviewSummary(
  _params?: GetReviewSummaryParams,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateReviewSummary>> {
  const summary: FrigateReviewSummary = {
    last24Hours: {
      reviewed_alert: randomInt(0, 10),
      reviewed_detection: randomInt(5, 30),
      total_alert: randomInt(5, 20),
      total_detection: randomInt(20, 60),
    },
  }
  for (let i = 0; i < 3; i++) {
    const day = new Date(Date.now() - (i + 1) * 86400000)
      .toISOString()
      .split('T')[0]
    summary[day] = {
      day,
      reviewed_alert: randomInt(0, 10),
      reviewed_detection: randomInt(5, 30),
      total_alert: randomInt(5, 20),
      total_detection: randomInt(20, 60),
    }
  }
  return { ok: true, data: summary }
}

export async function getTimeline(
  params?: GetTimelineParams,
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateTimelineEntry[]>> {
  const count = params?.limit ?? randomInt(5, 15)
  const entries = Array.from({ length: count }, () => generateTimelineEntry())
  return { ok: true, data: entries }
}

export async function getStats(
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateStats>> {
  const cameras: FrigateStats['cameras'] = {}
  const cpuUsages: FrigateStats['cpu_usages'] = {}
  const processes: FrigateStats['processes'] = {}

  for (const cam of MOCK_CAMERAS) {
    cameras[cam] = {
      audio_dBFS: randomFloat(-40, -10),
      audio_rms: randomFloat(-50, -20),
      camera_fps: randomFloat(4, 6, 1),
      capture_pid: randomInt(1000, 9999),
      detection_enabled: 1,
      detection_fps: randomFloat(4, 6, 1),
      ffmpeg_pid: randomInt(1000, 9999),
      pid: randomInt(1000, 9999),
      process_fps: randomFloat(4, 6, 1),
      skipped_fps: 0,
    }
    cpuUsages[`${cam}_capture`] = {
      cmdline: `ffmpeg -i rtsp://${cam}`,
      cpu: `${randomFloat(1, 10)}`,
      cpu_average: `${randomFloat(1, 8)}`,
      mem: `${randomFloat(0.5, 3)}`,
    }
    processes[`${cam}_capture`] = { pid: randomInt(1000, 9999) }
  }

  return {
    ok: true,
    data: {
      cameras,
      cpu_usages: cpuUsages,
      detection_fps: randomFloat(10, 30, 1),
      detectors: {
        cpu: {
          detection_start: 0,
          inference_speed: randomFloat(10, 50, 1),
          pid: randomInt(1000, 9999),
        },
      },
      gpu_usages: {},
      processes,
      service: {
        last_updated: Date.now() / 1000,
        latest_version: '0.14.0',
        storage: {
          '/': {
            free: randomFloat(10, 100, 1),
            mount_type: 'ext4',
            total: 200,
            used: randomFloat(50, 150, 1),
          },
        },
        temperatures: {},
        uptime: randomInt(3600, 864000),
        version: '0.14.0',
      },
    },
  }
}

export async function getConfig(
  _timeoutMs?: number,
): Promise<FrigateResult<FrigateConfig>> {
  const camerasConfig: Record<string, ReturnType<typeof generateCameraConfig>> =
    {}
  for (const cam of MOCK_CAMERAS) {
    camerasConfig[cam] = generateCameraConfig(cam)
  }

  return {
    ok: true,
    data: {
      cameras: camerasConfig,
      audio: {},
      birdseye: {
        enabled: true,
        height: 720,
        width: 1280,
        mode: 'objects',
        quality: 8,
        restream: false,
      },
      database: { path: '/db/frigate.db' },
      detect: { enabled: true },
      detectors: {
        cpu: { type: 'cpu', device: 'cpu', model: { path: null } },
      },
      ffmpeg: {},
      go2rtc: {},
      live: { height: 720, quality: 8, stream_name: '' },
      logger: { default: 'info', logs: {} },
      model: {
        height: 320,
        width: 320,
        input_pixel_format: 'rgb',
        input_tensor: 'nhwc',
        labelmap: {},
        labelmap_path: null,
        model_type: 'ssd',
        path: null,
      },
      motion: null,
      mqtt: {
        enabled: true,
        host: 'localhost',
        port: 1883,
        topic_prefix: 'frigate',
        client_id: 'frigate',
        user: null,
      },
      objects: { track: ['person', 'car', 'dog', 'cat'] },
      plus: { enabled: false },
      record: { enabled: true },
      rtmp: { enabled: false },
      snapshots: { enabled: true },
      telemetry: {
        network_interfaces: [],
        stats: {},
        version_check: true,
      },
      timestamp_style: { position: 'tl' },
      ui: {
        date_style: 'short',
        live_mode: 'mse',
        strftime_fmt: null,
        time_format: 'browser',
        time_style: 'medium',
        timezone: null,
        use_experimental: false,
      },
      environment_vars: {},
    },
  }
}

export async function getCameras(
  _timeoutMs?: number,
): Promise<FrigateResult<string[]>> {
  return { ok: true, data: [...MOCK_CAMERAS].sort() }
}

export async function getLatestSnapshot(
  _cameraName: string,
  _timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return { ok: true, data: PLACEHOLDER_IMAGE }
}
