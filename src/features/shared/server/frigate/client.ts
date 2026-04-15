import { getFrigateUrl, DEFAULT_TIMEOUT_MS } from './config'
import type { FrigateResult } from './config'
import { frigateCache } from './cache'
import * as mockFrigate from './mock-client'
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
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        status: response.status,
      }
    }
    const data = await extract(response)
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

async function frigateGet<T>(
  path: string,
  params?: QueryParams,
  timeoutMs?: number,
): Promise<FrigateResult<T>> {
  const url = buildUrl(path, params)

  const cached = frigateCache.get(url)
  if (cached !== undefined) {
    return cached as FrigateResult<T>
  }

  const result = await frigateFetch(
    path,
    params,
    (res) => res.json() as Promise<T>,
    timeoutMs,
  )

  if (result.ok) {
    frigateCache.set(url, result)
  }

  return result
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
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getEvents(params, timeoutMs)
  return frigateGet('/api/events', params as QueryParams, timeoutMs)
}

export async function getEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateEvent>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getEvent(eventId, timeoutMs)
  return frigateGet(`/api/events/${eventId}`, undefined, timeoutMs)
}

export async function getEventThumbnail(
  eventId: string,
  params?: GetEventMediaParams,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getEventThumbnail(eventId, params, timeoutMs)
  return frigateBinary(
    `/api/events/${eventId}/thumbnail.jpg`,
    params as QueryParams,
    timeoutMs,
  )
}

export async function getEventSnapshot(
  eventId: string,
  params?: GetEventMediaParams,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getEventSnapshot(eventId, params, timeoutMs)
  return frigateBinary(
    `/api/events/${eventId}/snapshot.jpg`,
    params as QueryParams,
    timeoutMs,
  )
}

export async function getEventClip(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getEventClip(eventId, timeoutMs)
  return frigateBinary(`/api/events/${eventId}/clip.mp4`, undefined, timeoutMs)
}

export async function getEventSummary(
  params?: GetEventSummaryParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateEventSummary>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getEventSummary(params, timeoutMs)
  return frigateGet('/api/events/summary', params as QueryParams, timeoutMs)
}

// ─── Review endpoints ───

export async function getReviews(
  params?: GetReviewsParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReview[]>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getReviews(params, timeoutMs)
  return frigateGet('/api/review', params as QueryParams, timeoutMs)
}

export async function getReviewByEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReview>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getReviewByEvent(eventId, timeoutMs)
  return frigateGet(`/api/review/event/${eventId}`, undefined, timeoutMs)
}

export async function getReviewSummary(
  params?: GetReviewSummaryParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReviewSummary>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getReviewSummary(params, timeoutMs)
  return frigateGet('/api/review/summary', params as QueryParams, timeoutMs)
}

// ─── Timeline, Stats, Config ───

export async function getTimeline(
  params?: GetTimelineParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateTimelineEntry[]>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getTimeline(params, timeoutMs)
  return frigateGet('/api/timeline', params as QueryParams, timeoutMs)
}

export async function getStats(
  timeoutMs?: number,
): Promise<FrigateResult<FrigateStats>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getStats(timeoutMs)
  return frigateGet('/api/stats', undefined, timeoutMs)
}

export async function getConfig(
  timeoutMs?: number,
): Promise<FrigateResult<FrigateConfig>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getConfig(timeoutMs)
  return frigateGet('/api/config', undefined, timeoutMs)
}

// ─── Camera endpoints ───

export async function getLatestSnapshot(
  cameraName: string,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getLatestSnapshot(cameraName, timeoutMs)
  return frigateBinary(`/api/${cameraName}/latest.jpg`, undefined, timeoutMs)
}

/**
 * Returns a sorted list of camera names from the Frigate config.
 */
export async function getCameras(
  timeoutMs?: number,
): Promise<FrigateResult<string[]>> {
  if (process.env.FRIGATE_MOCK === 'true') return mockFrigate.getCameras(timeoutMs)
  const result = await getConfig(timeoutMs)
  if (!result.ok) return result
  return { ok: true, data: Object.keys(result.data.cameras ?? {}).sort() }
}

export { clearFrigateCache } from './cache'
