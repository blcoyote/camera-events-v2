import { isValidEventId } from '#/server/frigate/validation'
import { getEventSnapshot } from '#/server/frigate/client'

/**
 * Pure handler logic for the event snapshot proxy route.
 * Extracted for testability — the actual route file delegates to this.
 */
export async function handleSnapshotRequest(
  eventId: string,
  isAuthenticated: boolean,
  download: boolean = false,
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidEventId(eventId)) {
    return new Response(null, { status: 400 })
  }

  const result = await getEventSnapshot(eventId)
  if (!result.ok) {
    return new Response(null, { status: 502 })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=3600',
  }

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="event-${eventId}.jpg"`
  }

  return new Response(result.data, { status: 200, headers })
}
