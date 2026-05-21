import { createFileRoute } from '@tanstack/react-router'
import { resolveIsAuthenticated } from '#/features/shared/server/session'
import { handleThumbnailRequest } from '#/features/camera-details/server/thumbnail-proxy'

export const Route = createFileRoute('/api/events/$id/thumbnail')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const isAuthenticated = await resolveIsAuthenticated()
        return handleThumbnailRequest(params.id, isAuthenticated)
      },
    },
  },
})
