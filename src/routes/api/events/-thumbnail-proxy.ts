import { isValidEventId } from '#/server/frigate/validation'
import { getEventThumbnail } from '#/server/frigate/client'

/**
 * Pure handler logic for the event thumbnail proxy route.
 * Extracted for testability — the actual route file delegates to this.
 */
export async function handleThumbnailRequest(
  eventId: string,
  isAuthenticated: boolean,
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidEventId(eventId)) {
    return new Response(null, { status: 400 })
  }

  const result = await getEventThumbnail(eventId)
  if (!result.ok) {
    return new Response(null, { status: 502 })
  }

  return new Response(result.data, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
