import { createFileRoute } from '@tanstack/react-router'
import { getAppSession } from '#/features/shared/server/session'
import { handleGetAdminStatus } from '#/features/auth/server/admin-status-handlers'

export const Route = createFileRoute('/api/auth/admin-status')({
  server: {
    handlers: {
      GET: async () => {
        try {
          let userId: string | null = null
          try {
            const session = await getAppSession()
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          const result = await handleGetAdminStatus(userId)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: {
              'Content-Type': 'application/json',
              // A cached isAdmin: true must never survive a logout/login as
              // a different user, or an admin's demotion.
              'Cache-Control': 'no-store',
            },
          })
        } catch (err) {
          console.error('[auth/admin-status GET] Unhandled error:', err)
          return new Response(JSON.stringify({ error: 'internal_error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
