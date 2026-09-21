import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleUnsubscribe } from '#/features/push-notifications/server/push-handlers'

export const Route = createFileRoute('/api/push/unsubscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let userId: string | null = null
          try {
            const session = await useSession<SessionData>(getSessionConfig())
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          // Only read the body once a session is present: an unauthenticated
          // caller is rejected by the handler's 401 no matter what the body
          // holds, so reading it beforehand is wasted work and needless
          // exposure to a large or slow request body. `undefined` flows
          // through to the same 401. With a session, a JSON parse failure is
          // still passed through as `undefined` instead of short-circuited
          // here, so a malformed body only ever surfaces as a 400 via the
          // handler's existing 401 -> 400 order — without duplicating the
          // auth check in the route.
          let body: unknown
          if (userId) {
            try {
              body = await request.json()
            } catch {
              body = undefined
            }
          }

          const result = await handleUnsubscribe(userId, body)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[push/unsubscribe] Unhandled error:', err)
          const message =
            err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
