import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/server/session'
import type { SessionData } from '#/server/session'
import { handleThumbnailRequest } from '../-thumbnail-proxy'

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
