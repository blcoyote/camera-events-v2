import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getEventSnapshot } from '#/features/shared/server/frigate/client'

/**
 * Pure handler logic for the event snapshot proxy route.
 * Extracted for testability — the actual route file delegates to this.
 */
export async function handleSnapshotRequest(
  eventId: string,
  isAuthenticated: boolean,
  download: boolean = false,
  showBoundingBox: boolean = false,
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidEventId(eventId)) {
    return new Response(null, { status: 400 })
  }

  // Frigate's own query param is `bbox=true` — that name stays at the URL
  // boundary; internally we use the descriptive UI-facing name.
  const result = await getEventSnapshot(
    eventId,
    showBoundingBox ? { bbox: true } : undefined,
  )
  if (!result.ok) {
    return new Response(null, { status: 502 })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=3600',
  }

  if (download) {
    headers['Content-Disposition'] =
      `attachment; filename="event-${eventId}.jpg"`
  }

  return new Response(result.data, { status: 200, headers })
}
