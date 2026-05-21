import { createFileRoute } from '@tanstack/react-router'
import { resolveIsAuthenticated } from '#/features/shared/server/session'
import { handleClipRequest } from '#/features/camera-details/server/clip-proxy'

export const Route = createFileRoute('/api/events/$id/clip')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const isAuthenticated = await resolveIsAuthenticated()
        const url = new URL(request.url)
        const download = url.searchParams.get('download') === 'true'
        const rangeHeader = request.headers.get('Range') ?? undefined

        return handleClipRequest(params.id, isAuthenticated, {
          download,
          rangeHeader,
        })
      },
    },
  },
})
