import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import {
  handleGetNotificationMute,
  handleSetNotificationMute,
} from '#/features/push-notifications/server/admin-mute-handlers'

export const Route = createFileRoute('/api/push/mute')({
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

          const result = await handleGetNotificationMute(userId)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[push/mute GET] Unhandled error:', err)
          const message =
            err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      POST: async ({ request }) => {
        try {
          let userId: string | null = null
          try {
            const session = await useSession<SessionData>(getSessionConfig())
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          // Do not return 400 here on a JSON parse failure: that would let an
          // unauthenticated (or non-admin) caller's invalid body short-circuit
          // ahead of the handler's own 401/403 checks. Passing `undefined`
          // through instead lets the handler run its existing 401 -> 403 ->
          // 400 order, so a malformed body only ever surfaces as a 400 once
          // the caller has already been proven to be an authenticated admin —
          // without duplicating the auth check here in the route.
          let body: unknown
          try {
            body = await request.json()
          } catch {
            body = undefined
          }

          const result = await handleSetNotificationMute(userId, body)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[push/mute POST] Unhandled error:', err)
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
