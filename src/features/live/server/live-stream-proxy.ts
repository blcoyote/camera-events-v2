import { isValidCameraName } from '#/features/shared/server/frigate/validation'
import { getCameraLiveStream } from '#/features/shared/server/frigate/client'

/**
 * Pure handler logic for the camera live-stream proxy route.
 *
 * Streams Frigate's infinite MJPEG (`multipart/x-mixed-replace`) live view
 * through to the browser without buffering. Mirrors the conventions of
 * `handleClipRequest` (auth check, camera-name validation, 502 on network
 * failure, mirror upstream non-2xx). No Content-Length is ever set since the
 * stream has no known end.
 */
export async function handleLiveStreamRequest(
  cameraName: string,
  isAuthenticated: boolean,
  options?: { signal?: AbortSignal; fps?: number; height?: number },
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidCameraName(cameraName)) {
    return new Response(null, { status: 400 })
  }

  const result = await getCameraLiveStream(cameraName, {
    signal: options?.signal,
    fps: options?.fps,
    height: options?.height,
  })
  if (!result.ok) {
    // ok:false means a true network failure (no response from Frigate).
    return new Response(null, { status: 502 })
  }

  // Mirror upstream non-2xx statuses. Cancel the body to avoid holding an
  // open upstream connection while serving the error.
  if (result.data.status < 200 || result.data.status >= 300) {
    result.data.body?.cancel().catch(() => {})
    return new Response(null, { status: result.data.status })
  }

  const headers = new Headers()
  const upstream = result.data.headers
  headers.set(
    'Content-Type',
    upstream.get('Content-Type') ?? 'multipart/x-mixed-replace',
  )
  headers.set('Cache-Control', 'no-store')
  // Deliberately no Content-Length — this is an infinite stream.

  return new Response(result.data.body, {
    status: result.data.status,
    headers,
  })
}

/**
 * Parses an optional query-string integer into a positive int, or
 * `undefined` when the value is missing, non-numeric, zero, or negative.
 * Decimal strings are truncated (`parseInt` behavior), e.g. `'12.5'` -> 12.
 */
export function parseOptionalPositiveInt(
  value: string | null,
): number | undefined {
  if (value === null) return undefined
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return undefined
  return parsed
}
