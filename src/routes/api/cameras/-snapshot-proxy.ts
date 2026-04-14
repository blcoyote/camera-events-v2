import { isValidCameraName } from '#/server/frigate/validation'
import { getLatestSnapshot } from '#/server/frigate/client'

/**
 * Pure handler logic for the snapshot proxy route.
 * Extracted for testability — the actual route file delegates to this.
 */
export async function handleSnapshotRequest(
  cameraName: string,
  isAuthenticated: boolean,
): Promise<Response> {
  if (!isAuthenticated) {
    return new Response(null, { status: 401 })
  }

  if (!isValidCameraName(cameraName)) {
    return new Response(null, { status: 400 })
  }

  const result = await getLatestSnapshot(cameraName)
  if (!result.ok) {
    return new Response(null, { status: 502 })
  }

  return new Response(result.data, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store',
    },
  })
}
