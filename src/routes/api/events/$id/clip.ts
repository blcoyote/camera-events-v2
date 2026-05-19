import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleClipRequest } from '#/features/camera-details/server/clip-proxy'

export const Route = createFileRoute('/api/events/$id/clip')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        let isAuthenticated = false
        try {
          const session = await useSession<SessionData>(getSessionConfig())
          isAuthenticated = !!session.data.sub
        } catch {
          // Corrupted session — treat as unauthenticated
        }

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
