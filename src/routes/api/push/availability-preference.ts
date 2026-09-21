import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import {
  handleGetAvailabilityPreference,
  handleSetAvailabilityPreference,
} from '#/features/push-notifications/server/push-handlers'

export const Route = createFileRoute('/api/push/availability-preference')({
  server: {
    handlers: {
      GET: async () => {
        try {
          let userId: string | null = null
          try {
            const session = await useSession<SessionData>(getSessionConfig())
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          const result = await handleGetAvailabilityPreference(userId)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error(
            '[push/availability-preference GET] Unhandled error:',
            err,
          )
          const message =
            err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      PUT: async ({ request }) => {
        try {
          let userId: string | null = null
          try {
            const session = await useSession<SessionData>(getSessionConfig())
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          // Do not return 400 here on a JSON parse failure: that would let an
          // unauthenticated caller's invalid body short-circuit ahead of the
          // handler's own 401 check. Passing `undefined` through instead lets
          // the handler run its existing 401 -> 400 order, so a malformed
          // body only ever surfaces as a 400 once the caller has already
          // been proven to be authenticated — without duplicating the auth
          // check here in the route.
          let body: unknown
          try {
            body = await request.json()
          } catch {
            body = undefined
          }

          const result = await handleSetAvailabilityPreference(userId, body)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error(
            '[push/availability-preference PUT] Unhandled error:',
            err,
          )
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
