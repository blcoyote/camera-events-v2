import { createFileRoute } from '@tanstack/react-router'
import { getAppSession } from '#/features/shared/server/session'
import { handleSnapshotRequest } from '#/features/cameras/server/snapshot-proxy'

export const Route = createFileRoute('/api/cameras/$name/latest')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let isAuthenticated = false
        try {
          const session = await getAppSession()
          isAuthenticated = !!session.data.sub
        } catch {
          // Corrupted session — treat as unauthenticated
        }

        return handleSnapshotRequest(params.name, isAuthenticated)
      },
    },
  },
})
