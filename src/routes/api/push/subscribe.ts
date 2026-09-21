import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleSubscribe } from '#/features/push-notifications/server/push-handlers'

export const Route = createFileRoute('/api/push/subscribe')({
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

          // Only read the body once a session is present. An unauthenticated
          // caller gets the handler's 401 regardless of what the body
          // contains, so parsing it first would be wasted work and needless
          // exposure to a large or slow request body before rejecting it.
          // `undefined` flows through to the same 401. Once there is a
          // session, a JSON parse failure is still passed through as
          // `undefined` rather than short-circuited here, so a malformed
          // body only ever surfaces as a 400 via the handler's existing
          // 401 -> 503 -> 400 order — without duplicating the auth check.
          let body: unknown
          if (userId) {
            try {
              body = await request.json()
            } catch {
              body = undefined
            }
          }

          const result = await handleSubscribe(userId, body)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[push/subscribe] Unhandled error:', err)
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
