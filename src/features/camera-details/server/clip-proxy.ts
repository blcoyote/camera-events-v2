import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getEventClipStream } from '#/features/shared/server/frigate/client'

/**
 * Pure handler logic for the event clip proxy route.
 *
 * Serves the clip inline by default with `Accept-Ranges: bytes` so
 * browsers (notably iOS Safari standalone PWA) can issue HTTP Range
 * requests for mid-clip seek. Adds `Content-Disposition: attachment`
 * only when the caller passes `download: true`. Forwards an optional
 * Range header to upstream Frigate unchanged.
 */
export async function handleClipRequest(
  eventId: string,
  isAuthenticated: boolean,
  options?: { download?: boolean; rangeHeader?: string },
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidEventId(eventId)) {
    return new Response(null, { status: 400 })
  }

  const result = await getEventClipStream(eventId, {
    rangeHeader: options?.rangeHeader,
  })
  if (!result.ok) {
    // ok:false means a true network failure (no response from Frigate).
    // Per AC8, surface as Bad Gateway. Upstream HTTP statuses (4xx/5xx)
    // arrive with ok:true so the proxy can mirror them — see below.
    return new Response(null, { status: 502 })
  }

  // Mirror upstream non-2xx statuses (AC20). Cancel the body to avoid
  // holding an open upstream connection while serving the error.
  if (result.data.status < 200 || result.data.status >= 300) {
    result.data.body?.cancel().catch(() => {})
    return new Response(null, { status: result.data.status })
  }

  const headers = new Headers()
  const ct = result.data.headers.get('Content-Type')
  headers.set('Content-Type', ct ?? 'video/mp4')
  const cl = result.data.headers.get('Content-Length')
  if (cl) headers.set('Content-Length', cl)
  const cr = result.data.headers.get('Content-Range')
  if (cr) headers.set('Content-Range', cr)
  const ar = result.data.headers.get('Accept-Ranges')
  if (ar) headers.set('Accept-Ranges', ar)
  else if (result.data.status === 200) headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=3600')
  if (options?.download === true) {
    headers.set(
      'Content-Disposition',
      `attachment; filename="event-${eventId}.mp4"`,
    )
  }

  return new Response(result.data.body, {
    status: result.data.status,
    headers,
  })
}
