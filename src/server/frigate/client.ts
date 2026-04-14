import { getFrigateUrl, DEFAULT_TIMEOUT_MS } from './config'
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

type QueryParams = Record<string, string | number | boolean | undefined>

/**
 * Build a full Frigate API URL from a path and optional query params.
 * Undefined/null param values are omitted.
 */
function buildUrl(path: string, params?: QueryParams): string {
  const base = getFrigateUrl()
  const url = new URL(path, base)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

/**
 * Internal: perform a GET request to Frigate and extract the response body.
 * The `extract` callback determines how the Response is parsed (JSON vs binary).
 */
async function frigateFetch<T>(
  path: string,
  params: QueryParams | undefined,
  extract: (res: Response) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FrigateResult<T>> {
  try {
    const url = buildUrl(path, params)
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}`, status: response.status }
    }
    const data = await extract(response)
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

function frigateGet<T>(
  path: string,
  params?: QueryParams,
  timeoutMs?: number,
): Promise<FrigateResult<T>> {
  return frigateFetch(path, params, (res) => res.json() as Promise<T>, timeoutMs)
}

function frigateBinary(
  path: string,
  params?: QueryParams,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return frigateFetch(path, params, (res) => res.arrayBuffer(), timeoutMs)
}

// ─── Event endpoints ───

export async function getEvents(
  params?: GetEventsParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateEvent[]>> {
  return frigateGet('/api/events', params as QueryParams, timeoutMs)
}

export async function getEventThumbnail(
  eventId: string,
  params?: GetEventMediaParams,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return frigateBinary(`/api/events/${eventId}/thumbnail.jpg`, params as QueryParams, timeoutMs)
}

export async function getEventSnapshot(
  eventId: string,
  params?: GetEventMediaParams,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return frigateBinary(`/api/events/${eventId}/snapshot.jpg`, params as QueryParams, timeoutMs)
}

export async function getEventSummary(
  params?: GetEventSummaryParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateEventSummary>> {
  return frigateGet('/api/events/summary', params as QueryParams, timeoutMs)
}

// ─── Review endpoints ───

export async function getReviews(
  params?: GetReviewsParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReview[]>> {
  return frigateGet('/api/review', params as QueryParams, timeoutMs)
}

export async function getReviewByEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReview>> {
  return frigateGet(`/api/review/event/${eventId}`, undefined, timeoutMs)
}

export async function getReviewSummary(
  params?: GetReviewSummaryParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReviewSummary>> {
  return frigateGet('/api/review/summary', params as QueryParams, timeoutMs)
}

// ─── Timeline, Stats, Config ───

export async function getTimeline(
  params?: GetTimelineParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateTimelineEntry[]>> {
  return frigateGet('/api/timeline', params as QueryParams, timeoutMs)
}

export async function getStats(
  timeoutMs?: number,
): Promise<FrigateResult<FrigateStats>> {
  return frigateGet('/api/stats', undefined, timeoutMs)
}

export async function getConfig(
  timeoutMs?: number,
): Promise<FrigateResult<FrigateConfig>> {
  return frigateGet('/api/config', undefined, timeoutMs)
}

// ─── Camera endpoints ───

export async function getLatestSnapshot(
  cameraName: string,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  return frigateBinary(`/api/${cameraName}/latest.jpg`, undefined, timeoutMs)
}

/**
 * Returns a sorted list of camera names from the Frigate config.
 */
export async function getCameras(
  timeoutMs?: number,
): Promise<FrigateResult<string[]>> {
  const result = await getConfig(timeoutMs)
  if (!result.ok) return result
  const cameras = result.data.cameras
  if (!cameras || typeof cameras !== 'object') {
    return { ok: true, data: [] }
  }
  return { ok: true, data: Object.keys(cameras).sort() }
}
