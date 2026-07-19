import { createFileRoute } from '@tanstack/react-router'
import { resolveIsAuthenticated } from '#/features/shared/server/session'
import {
  handleLiveStreamRequest,
  parseOptionalPositiveInt,
} from '#/features/live/server/live-stream-proxy'

export const Route = createFileRoute('/api/live/$name/stream')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const isAuthenticated = await resolveIsAuthenticated()
        const url = new URL(request.url)
        const fps = parseOptionalPositiveInt(url.searchParams.get('fps'))
        const height = parseOptionalPositiveInt(url.searchParams.get('h'))

        return handleLiveStreamRequest(params.name, isAuthenticated, {
          signal: request.signal,
          fps,
          height,
        })
      },
    },
  },
})
