import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getEventClip } from '#/features/shared/server/frigate/client'

/**
 * Pure handler logic for the event clip proxy route.
 * Extracted for testability — the actual route file delegates to this.
 */
export async function handleClipRequest(
  eventId: string,
  isAuthenticated: boolean,
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidEventId(eventId)) {
    return new Response(null, { status: 400 })
  }

  const result = await getEventClip(eventId)
  if (!result.ok) {
    return new Response(null, { status: 502 })
  }

  return new Response(result.data, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="event-${eventId}.mp4"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
