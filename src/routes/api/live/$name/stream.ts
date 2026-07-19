import { createFileRoute } from '@tanstack/react-router'
import { resolveIsAuthenticated } from '#/features/shared/server/session'
import { handleHlsPlaylistRequest } from '#/features/live/server/live-hls-proxy'

export const Route = createFileRoute('/api/live/$name/stream')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const isAuthenticated = await resolveIsAuthenticated()

        return handleHlsPlaylistRequest(params.name, isAuthenticated, {
          signal: request.signal,
        })
      },
    },
  },
})
