import '@tanstack/react-start/server-only'
import { getFrigateUrl, DEFAULT_TIMEOUT_MS } from './config'
import type { FrigateResult } from './config'
import { frigateCache } from './cache'
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

function loadMock() {
  return import('./mock-client')
}

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

async function frigateWrite(
  method: 'POST' | 'DELETE',
  path: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FrigateResult<void>> {
  try {
    const url = buildUrl(path)
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        status: response.status,
      }
    }
    return { ok: true, data: undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
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
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getEvents(params, timeoutMs)
  return frigateGet('/api/events', params as QueryParams, timeoutMs)
}

export async function getEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateEvent>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getEvent(eventId, timeoutMs)
  return frigateGet(`/api/events/${eventId}`, undefined, timeoutMs)
}

export async function getEventThumbnail(
  eventId: string,
  params?: GetEventMediaParams,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getEventThumbnail(eventId, params, timeoutMs)
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
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getEventSnapshot(eventId, params, timeoutMs)
  return frigateBinary(
    `/api/events/${eventId}/snapshot.jpg`,
    params as QueryParams,
    timeoutMs,
  )
}

/**
 * Streams an event clip from Frigate without buffering. Returns the
 * upstream Response stream so the proxy can forward HTTP Range requests
 * (required for iOS Safari inline video playback) and propagate
 * Content-Length / Content-Range. Callers must pipe `data.body` into
 * their own Response — the body is not consumed here.
 */
export interface FrigateClipStreamResponse {
  status: number
  body: ReadableStream<Uint8Array> | null
  headers: Headers
}

export async function getEventClipStream(
  eventId: string,
  options?: { rangeHeader?: string },
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FrigateResult<FrigateClipStreamResponse>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getEventClipStream(eventId, options, timeoutMs)

  try {
    const url = buildUrl(`/api/events/${eventId}/clip.mp4`)
    const headers = new Headers()
    if (options?.rangeHeader !== undefined) {
      headers.set('Range', options.rangeHeader)
    }
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Reserve `ok: false` for true network failures (caught below). When
    // Frigate responds at all — even with 4xx/5xx — we hand the status back
    // so the proxy can mirror it (e.g. 416 for a malformed Range, per AC20).
    return {
      ok: true,
      data: {
        status: response.status,
        body: response.body,
        headers: response.headers,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export async function getEventSummary(
  params?: GetEventSummaryParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateEventSummary>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getEventSummary(params, timeoutMs)
  return frigateGet('/api/events/summary', params as QueryParams, timeoutMs)
}

export async function retainEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<void>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).retainEvent(eventId, timeoutMs)
  return frigateWrite('POST', `/api/events/${eventId}/retain`, timeoutMs)
}

export async function unretainEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<void>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).unretainEvent(eventId, timeoutMs)
  return frigateWrite('DELETE', `/api/events/${eventId}/retain`, timeoutMs)
}

// ─── Review endpoints ───

export async function getReviews(
  params?: GetReviewsParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReview[]>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getReviews(params, timeoutMs)
  return frigateGet('/api/review', params as QueryParams, timeoutMs)
}

export async function getReviewByEvent(
  eventId: string,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReview>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getReviewByEvent(eventId, timeoutMs)
  return frigateGet(`/api/review/event/${eventId}`, undefined, timeoutMs)
}

export async function getReviewSummary(
  params?: GetReviewSummaryParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateReviewSummary>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getReviewSummary(params, timeoutMs)
  return frigateGet('/api/review/summary', params as QueryParams, timeoutMs)
}

// ─── Timeline, Stats, Config ───

export async function getTimeline(
  params?: GetTimelineParams,
  timeoutMs?: number,
): Promise<FrigateResult<FrigateTimelineEntry[]>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getTimeline(params, timeoutMs)
  return frigateGet('/api/timeline', params as QueryParams, timeoutMs)
}

export async function getStats(
  timeoutMs?: number,
): Promise<FrigateResult<FrigateStats>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getStats(timeoutMs)
  return frigateGet('/api/stats', undefined, timeoutMs)
}

export async function getConfig(
  timeoutMs?: number,
): Promise<FrigateResult<FrigateConfig>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getConfig(timeoutMs)
  return frigateGet('/api/config', undefined, timeoutMs)
}

// ─── Camera endpoints ───

export async function getLatestSnapshot(
  cameraName: string,
  timeoutMs?: number,
): Promise<FrigateResult<ArrayBuffer>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getLatestSnapshot(cameraName, timeoutMs)
  return frigateBinary(`/api/${cameraName}/latest.jpg`, undefined, timeoutMs)
}

/**
 * Returns a sorted list of camera names from the Frigate config.
 */
export async function getCameras(
  timeoutMs?: number,
): Promise<FrigateResult<string[]>> {
  if (process.env.FRIGATE_MOCK === 'true')
    return (await loadMock()).getCameras(timeoutMs)
  const result = await getConfig(timeoutMs)
  if (!result.ok) return result
  return { ok: true, data: Object.keys(result.data.cameras ?? {}).sort() }
}
