import { createFileRoute } from '@tanstack/react-router'
import { resolveIsAuthenticated } from '#/features/shared/server/session'
import { handleSnapshotRequest } from '#/features/camera-details/server/snapshot-proxy'

export const Route = createFileRoute('/api/events/$id/snapshot')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const isAuthenticated = await resolveIsAuthenticated()
        const url = new URL(request.url)
        const download = url.searchParams.get('download') === 'true'
        const bbox = url.searchParams.get('bbox') === 'true'

        return handleSnapshotRequest(params.id, isAuthenticated, download, bbox)
      },
    },
  },
})
