import { isValidCameraName } from '#/features/shared/server/frigate/validation'
import {
  getCameraHlsPlaylist,
  getCameraHlsSegment,
} from '#/features/shared/server/frigate/client'
import { rewriteHlsPlaylist } from '#/features/live/utils/rewriteHlsPlaylist'
import { isValidHlsSegmentRef } from '#/features/live/server/hls-validation'

/**
 * Pure handler logic for the HLS media playlist proxy route.
 *
 * Fetches the go2rtc media playlist for a camera and rewrites every
 * segment/init/key reference so it points back at this app's auth-guarded
 * segment proxy (see `handleHlsSegmentRequest`), rather than directly at
 * go2rtc. Mirrors the conventions of `handleClipRequest` (auth check,
 * camera-name validation, 502 on network failure, mirror upstream non-2xx).
 */
export async function handleHlsPlaylistRequest(
  cameraName: string,
  isAuthenticated: boolean,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidCameraName(cameraName)) {
    return new Response(null, { status: 400 })
  }

  const result = await getCameraHlsPlaylist(cameraName, {
    signal: options?.signal,
  })
  if (!result.ok) {
    // ok:false means a true network failure (no response from go2rtc).
    return new Response(null, { status: 502 })
  }

  // Mirror upstream non-2xx statuses. The client returns an empty `text` for
  // these, so there is no body to forward.
  if (result.data.status < 200 || result.data.status >= 300) {
    return new Response(null, { status: result.data.status })
  }

  const rewritten = rewriteHlsPlaylist(result.data.text, cameraName)

  return new Response(rewritten, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Pure handler logic for the HLS segment proxy route.
 *
 * Streams a single init/media segment from go2rtc through to the browser.
 * `segmentRef` is attacker-controllable (it round-trips through the
 * rewritten playlist), so it is validated with `isValidHlsSegmentRef` before
 * being used to build the upstream request. Mirrors the conventions of
 * `handleClipRequest` (auth check, validation, 502 on network failure,
 * mirror upstream non-2xx, Range pass-through).
 */
export async function handleHlsSegmentRequest(
  cameraName: string,
  segmentRef: string,
  isAuthenticated: boolean,
  options?: { signal?: AbortSignal; rangeHeader?: string },
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidCameraName(cameraName)) {
    return new Response(null, { status: 400 })
  }

  if (!isValidHlsSegmentRef(segmentRef)) {
    return new Response(null, { status: 400 })
  }

  const result = await getCameraHlsSegment(cameraName, segmentRef, {
    signal: options?.signal,
    rangeHeader: options?.rangeHeader,
  })
  if (!result.ok) {
    // ok:false means a true network failure (no response from go2rtc).
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
  headers.set('Content-Type', upstream.get('Content-Type') ?? 'video/mp4')
  const contentLength = upstream.get('Content-Length')
  if (contentLength) headers.set('Content-Length', contentLength)
  const contentRange = upstream.get('Content-Range')
  if (contentRange) headers.set('Content-Range', contentRange)
  const acceptRanges = upstream.get('Accept-Ranges')
  if (acceptRanges) headers.set('Accept-Ranges', acceptRanges)
  else if (result.data.status === 200) headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'no-store')

  return new Response(result.data.body, {
    status: result.data.status,
    headers,
  })
}
