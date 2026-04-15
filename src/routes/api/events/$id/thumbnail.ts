import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleThumbnailRequest } from '#/features/camera-events/server/thumbnail-proxy'

export const Route = createFileRoute('/api/events/$id/thumbnail')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let isAuthenticated = false
        try {
          const session = await useSession<SessionData>(getSessionConfig())
          isAuthenticated = !!session.data.sub
        } catch {
          // Corrupted session — treat as unauthenticated
        }

        return handleThumbnailRequest(params.id, isAuthenticated)
      },
    },
  },
})
