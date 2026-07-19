import { createFileRoute } from '@tanstack/react-router'
import { resolveIsAuthenticated } from '#/features/shared/server/session'
import { handleHlsSegmentRequest } from '#/features/live/server/live-hls-proxy'

export const Route = createFileRoute('/api/live/$name/segment')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const ref = new URL(request.url).searchParams.get('ref') ?? ''
        const rangeHeader = request.headers.get('Range') ?? undefined
        const isAuthenticated = await resolveIsAuthenticated()

        return handleHlsSegmentRequest(params.name, ref, isAuthenticated, {
          signal: request.signal,
          rangeHeader,
        })
      },
    },
  },
})
