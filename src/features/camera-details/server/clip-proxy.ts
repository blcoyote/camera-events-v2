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
    return new Response(null, { status: 502 })
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
