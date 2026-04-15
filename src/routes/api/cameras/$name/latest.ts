import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleSnapshotRequest } from '#/features/cameras/server/snapshot-proxy'

export const Route = createFileRoute('/api/cameras/$name/latest')({
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

        return handleSnapshotRequest(params.name, isAuthenticated)
      },
    },
  },
})
